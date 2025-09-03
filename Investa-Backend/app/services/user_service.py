"""
User Management Service
Handles user CRUD operations and statistics
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId
from app.models.user import User, UserCreate, UserUpdate, UserResponse
import logging

logger = logging.getLogger(__name__)

class UserService:
    """User management service"""
    
    def __init__(self, mongo_db):
        self.db = mongo_db
        self.users_collection = self.db.users
    
    def create_user(self, user_data: UserCreate) -> Optional[UserResponse]:
        """Create new user or return existing one"""
        try:
            existing_user = self.get_user_by_firebase_uid(user_data.firebase_uid)
            if existing_user:
                return existing_user
            
            user_doc = {
                'firebase_uid': user_data.firebase_uid,
                'email': user_data.email,
                'display_name': user_data.display_name,
                'risk_preference': user_data.risk_preference,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': True,
                'profile_completed': True
            }
            
            result = self.users_collection.insert_one(user_doc)
            
            if result.inserted_id:
                return self.get_user_by_id(str(result.inserted_id))
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional[UserResponse]:
        """Get user by database ID"""
        try:
            user_doc = self.users_collection.find_one({'_id': ObjectId(user_id)})
            if user_doc:
                user_doc['id'] = str(user_doc['_id'])
                del user_doc['_id']
                return UserResponse(**user_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by ID: {str(e)}")
            return None
    
    def get_user_by_firebase_uid(self, firebase_uid: str) -> Optional[UserResponse]:
        """Get user by Firebase UID"""
        try:
            user_doc = self.users_collection.find_one({'firebase_uid': firebase_uid})
            if user_doc:
                user_doc['id'] = str(user_doc['_id'])
                del user_doc['_id']
                return UserResponse(**user_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by Firebase UID: {str(e)}")
            return None
    
    def update_user(self, user_id: str, update_data: UserUpdate) -> Optional[UserResponse]:
        """Update user data"""
        try:
            update_doc = update_data.dict(exclude_unset=True)
            update_doc['updated_at'] = datetime.utcnow()
            
            result = self.users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': update_doc}
            )
            
            if result.modified_count > 0:
                return self.get_user_by_id(user_id)
            
            return None
            
        except Exception as e:
            logger.error(f"Error updating user: {str(e)}")
            return None
    
    def get_user_stats(self, firebase_uid: str) -> Optional[Dict[str, Any]]:
        """Get user statistics and metrics"""
        try:
            # First, get the user's MongoDB ObjectId
            user = self.get_user_by_firebase_uid(firebase_uid)
            if not user:
                logger.error(f"User not found for Firebase UID: {firebase_uid}")
                return None
            
            user_object_id = user.id
            
            # Get room memberships
            rooms_collection = self.db.rooms
            room_members_collection = self.db.room_members
            
            # Count investment rooms (all rooms user has joined and invested in)
            total_rooms = room_members_collection.count_documents({
                'user_id': user_object_id,
                'status': 'active'
            })
            
            # Count created rooms
            created_rooms = rooms_collection.count_documents({
                'creator_id': user_object_id
            })
            
            # Get total contributions using MongoDB ObjectId
            contributions_collection = self.db.contributions
            total_contributed = contributions_collection.aggregate([
                {'$match': {'user_id': user_object_id, 'status': 'completed'}},
                {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
            ])
            
            total_contributed_amount = 0
            for doc in total_contributed:
                total_contributed_amount = doc['total']
                break
            
            # Get wallet data for returns using MongoDB ObjectId
            wallets_collection = self.db.wallets
            wallet = wallets_collection.find_one({'user_id': user_object_id})
            
            wallet_balance = 0.0
            total_returns = 0.0
            if wallet:
                wallet_balance = float(wallet.get('balance', 0))
                total_returns = float(wallet.get('total_returns', 0))
            
            # Also count completed/ended rooms
            completed_rooms = room_members_collection.count_documents({
                'user_id': user_object_id,
                'status': 'completed'
            })
            
            return {
                'investment_rooms': total_rooms + completed_rooms,  # Total rooms user has invested in
                'created_rooms': created_rooms,
                'total_invested': float(total_contributed_amount),
                'total_returns': total_returns,
                'wallet_balance': wallet_balance,
                'active_rooms': total_rooms,
                'completed_rooms': completed_rooms
            }
            
        except Exception as e:
            logger.error(f"Error getting user stats: {str(e)}")
            return None
    
    def deactivate_user(self, user_id: str) -> bool:
        """Deactivate user account"""
        try:
            result = self.users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'is_active': False,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error deactivating user: {str(e)}")
            return False
