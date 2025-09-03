"""
Firebase Authentication Service
Handles user authentication and token verification
"""

import firebase_admin
from firebase_admin import auth as firebase_auth
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class AuthService:
    """Firebase authentication service"""
    
    def __init__(self):
        try:
            self.firebase_app = firebase_admin.get_app()
        except ValueError:
            self.firebase_app = None
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify Firebase ID token and extract user data"""
        try:
            decoded_token = firebase_auth.verify_id_token(token)
            
            return {
                'uid': decoded_token['uid'],
                'email': decoded_token.get('email'),
                'email_verified': decoded_token.get('email_verified', False),
                'name': decoded_token.get('name'),
                'picture': decoded_token.get('picture'),
                'firebase_claims': decoded_token
            }
            
        except firebase_auth.InvalidIdTokenError:
            logger.warning(f"Invalid ID token: {token[:20]}...")
            return None
        except firebase_auth.ExpiredIdTokenError:
            logger.warning(f"Expired ID token: {token[:20]}...")
            return None
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            return None
    
    def get_user_by_uid(self, uid: str) -> Optional[Dict[str, Any]]:
        """Get user data from Firebase by UID"""
        try:
            user_record = firebase_auth.get_user(uid)
            
            return {
                'uid': user_record.uid,
                'email': user_record.email,
                'email_verified': user_record.email_verified,
                'display_name': user_record.display_name,
                'photo_url': user_record.photo_url,
                'disabled': user_record.disabled,
                'created_at': user_record.user_metadata.creation_timestamp,
                'last_sign_in': user_record.user_metadata.last_sign_in_timestamp
            }
            
        except firebase_auth.UserNotFoundError:
            logger.warning(f"User not found: {uid}")
            return None
        except Exception as e:
            logger.error(f"Error getting user: {str(e)}")
            return None
    
    def create_custom_token(self, uid: str, additional_claims: Optional[Dict] = None) -> str:
        """Create custom Firebase token"""
        try:
            custom_token = firebase_auth.create_custom_token(uid, additional_claims or {})
            return custom_token.decode('utf-8')
        except Exception as e:
            logger.error(f"Error creating custom token: {str(e)}")
            raise
    
    def revoke_refresh_tokens(self, uid: str) -> bool:
        """Revoke all refresh tokens for a user"""
        try:
            firebase_auth.revoke_refresh_tokens(uid)
            return True
        except Exception as e:
            logger.error(f"Error revoking tokens: {str(e)}")
            return False
    
    def update_user_claims(self, uid: str, claims: Dict[str, Any]) -> bool:
        """Update custom claims for a user"""
        try:
            firebase_auth.set_custom_user_claims(uid, claims)
            return True
        except Exception as e:
            logger.error(f"Error updating claims: {str(e)}")
            return False
