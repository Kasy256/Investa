"""
Contribution routes
"""

from flask import Blueprint, request, jsonify, current_app
from app.services.contribution_service import ContributionService
from app.services.user_service import UserService
from app.middleware.auth_middleware import require_auth, get_current_user_id
import logging

logger = logging.getLogger(__name__)

contributions_bp = Blueprint('contributions', __name__)


@contributions_bp.route('', methods=['POST'])
@require_auth
def create_contribution():
    """
    Create a new contribution
    
    Request body:
        {
            "room_id": "room_id_here",
            "amount": 500.00
        }
    
    Returns:
        Created contribution data
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Validate required fields
        if 'room_id' not in data or 'amount' not in data:
            return jsonify({'error': 'room_id and amount are required'}), 400
        
        amount = float(data['amount'])
        room_id = data['room_id']
        
        # Validate amount
        if amount < 100 or amount > 1000000:
            return jsonify({'error': 'Amount must be between ₦100 and ₦1,000,000'}), 400
        
        # Get user from database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Generate transaction reference
        import uuid
        transaction_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
        
        # Create contribution
        from app.models.contribution import ContributionCreate
        contribution_data = ContributionCreate(
            room_id=room_id,
            user_id=user.id,
            amount=amount,
            transaction_id=transaction_id,
            payment_method='wallet'
        )
        
        contribution_service = ContributionService(current_app.mongo.db)
        contribution = contribution_service.create_contribution(contribution_data)
        
        if not contribution:
            return jsonify({'error': 'Failed to create contribution'}), 500
        
        return jsonify({
            'success': True,
            'contribution': contribution.dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating contribution: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@contributions_bp.route('', methods=['GET'])
@require_auth
def get_contributions():
    """
    Get user contributions
    
    Query parameters:
        - limit: Number of contributions to return (default: 50)
        - skip: Number of contributions to skip (default: 0)
        - status: Filter by status (optional)
        - room_id: Filter by room ID (optional)
    
    Returns:
        List of contributions
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user from database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get query parameters
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        status = request.args.get('status')
        room_id = request.args.get('room_id')
        
        contribution_service = ContributionService(current_app.mongo.db)
        
        if room_id:
            # Get room contributions
            contributions = contribution_service.get_room_contributions(room_id, limit=limit, skip=skip)
        else:
            # Get user contributions
            contributions = contribution_service.get_user_contributions(
                user.id, limit=limit, skip=skip, status=status
            )
        
        return jsonify({
            'success': True,
            'contributions': [contrib.dict() for contrib in contributions],
            'pagination': {
                'limit': limit,
                'skip': skip,
                'count': len(contributions)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting contributions: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@contributions_bp.route('/<contribution_id>', methods=['GET'])
@require_auth
def get_contribution(contribution_id):
    """
    Get contribution by ID
    
    Returns:
        Contribution data
    """
    try:
        contribution_service = ContributionService(current_app.mongo.db)
        contribution = contribution_service.get_contribution_by_id(contribution_id)
        
        if not contribution:
            return jsonify({'error': 'Contribution not found'}), 404
        
        return jsonify({
            'success': True,
            'contribution': contribution.dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting contribution: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@contributions_bp.route('/stats', methods=['GET'])
@require_auth
def get_contribution_stats():
    """
    Get user contribution statistics
    
    Returns:
        Contribution statistics
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user from database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        contribution_service = ContributionService(current_app.mongo.db)
        stats = contribution_service.get_contribution_stats(user.id)
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting contribution stats: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
