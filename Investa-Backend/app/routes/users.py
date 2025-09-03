"""
User Management Routes
Profile management and user statistics
"""

from flask import Blueprint, request, jsonify, current_app
from app.services.user_service import UserService
from app.middleware.auth_middleware import require_auth, get_current_user_id
import logging

logger = logging.getLogger(__name__)

users_bp = Blueprint('users', __name__)

@users_bp.route('/profile', methods=['GET'])
@require_auth
def get_profile():
    """Get user profile"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'user': user.dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting profile: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile():
    """Update user profile"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        user_service = UserService(current_app.mongo.db)
        from app.models.user import UserUpdate
        
        update_data = UserUpdate(
            display_name=data.get('display_name'),
            risk_preference=data.get('risk_preference')
        )
        
        updated_user = user_service.update_user(user_id, update_data)
        
        if not updated_user:
            return jsonify({'error': 'Failed to update profile'}), 500
        
        return jsonify({
            'success': True,
            'user': updated_user.dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/stats', methods=['GET'])
@require_auth
def get_user_stats():
    """Get user statistics"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        user_service = UserService(current_app.mongo.db)
        stats = user_service.get_user_stats(user_id)
        
        if not stats:
            return jsonify({'error': 'Failed to get user stats'}), 500
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/deactivate', methods=['POST'])
@require_auth
def deactivate_account():
    """Deactivate user account"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        user_service = UserService(current_app.mongo.db)
        success = user_service.deactivate_user(user_id)
        
        if not success:
            return jsonify({'error': 'Failed to deactivate account'}), 500
        
        return jsonify({
            'success': True,
            'message': 'Account deactivated successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deactivating account: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
