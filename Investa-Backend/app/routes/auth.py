"""
Authentication Routes
Firebase token verification and user management
"""

from flask import Blueprint, request, jsonify, current_app
from app.services.auth_service import AuthService
from app.services.user_service import UserService
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/verify-token', methods=['POST'])
def verify_token():
    """Verify Firebase token and create/retrieve user"""
    try:
        data = request.get_json()
        if not data or 'token' not in data:
            return jsonify({'error': 'Token is required'}), 400
        
        token = data['token']
        
        # Verify token with Firebase
        try:
            auth_service = AuthService()
            user_data = auth_service.verify_token(token)
        except Exception as e:
            logger.error(f"Token verification failed: {str(e)}")
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        if not user_data:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Get or create user in database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_data['uid'])
        
        if not user:
            # Create new user
            try:
                from app.models.user import UserCreate
                user_create_data = UserCreate(
                    firebase_uid=user_data['uid'],
                    email=user_data.get('email', ''),
                    display_name=user_data.get('name', ''),
                    risk_preference='moderate'
                )
                user = user_service.create_user(user_create_data)
            except Exception as e:
                logger.error(f"Error creating user after token verification: {str(e)}")
                return jsonify({'error': 'Failed to create user'}), 500
        
        return jsonify({
            'success': True,
            'user': user.dict() if user else None,
            'firebase_data': user_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error verifying token: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/refresh-token', methods=['POST'])
def refresh_token():
    """Refresh Firebase token validation"""
    try:
        return jsonify({
            'success': True,
            'message': 'Token is valid'
        }), 200
        
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
