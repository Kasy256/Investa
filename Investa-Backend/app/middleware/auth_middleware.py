"""
Authentication Middleware
Firebase JWT token validation and user extraction
"""

from functools import wraps
from flask import request, jsonify, g
from app.services.auth_service import AuthService
import logging

logger = logging.getLogger(__name__)

def require_auth(f):
    """Decorator to require Firebase authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Get Authorization header
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({'error': 'Authorization header required'}), 401
            
            # Extract token
            if not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Invalid authorization format'}), 401
            
            token = auth_header.split(' ')[1]
            if not token:
                return jsonify({'error': 'Token is required'}), 401
            
            # Verify token with Firebase
            auth_service = AuthService()
            user_data = auth_service.verify_token(token)
            
            if not user_data:
                return jsonify({'error': 'Invalid or expired token'}), 401
            
            # Store user data in Flask g for access in route
            g.current_user = user_data
            g.current_user_id = user_data['uid']
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return jsonify({'error': 'Authentication failed'}), 500
    
    return decorated_function

def get_current_user_id():
    """Get current user ID from Flask g"""
    return getattr(g, 'current_user_id', None)

def get_current_user():
    """Get current user data from Flask g"""
    return getattr(g, 'current_user', None)

def optional_auth(f):
    """Decorator for optional authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                if token:
                    auth_service = AuthService()
                    user_data = auth_service.verify_token(token)
                    if user_data:
                        g.current_user = user_data
                        g.current_user_id = user_data['uid']
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"Optional auth error: {str(e)}")
            # Continue without authentication
            return f(*args, **kwargs)
    
    return decorated_function
