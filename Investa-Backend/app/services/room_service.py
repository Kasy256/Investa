"""
Room service for managing investment room operations
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from bson import ObjectId
from app.models.room import (
    InvestmentRoom, RoomMember, RoomCreate, RoomUpdate,
    RoomMemberCreate, RoomMemberUpdate, RoomResponse,
    RoomMemberResponse, RoomWithMembers
)
import logging
import string
import random

logger = logging.getLogger(__name__)


class RoomService:
    """Service for managing investment room operations"""
    
    def __init__(self, mongo_db):
        self.db = mongo_db
        self.rooms_collection = self.db.rooms
        self.room_members_collection = self.db.room_members
    
    def _generate_room_code(self) -> str:
        """Generate unique room code"""
        return f"ROOM-{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"
    
    def create_room(self, room_data: RoomCreate) -> Optional[RoomResponse]:
        """
        Create a new investment room
        
        Args:
            room_data: Room creation data
            
        Returns:
            Created room data or None if failed
        """
        try:
            # Generate unique room code
            room_code = self._generate_room_code()
            
            # Create room document
            room_doc = {
                'name': room_data.name,
                'description': room_data.description,
                'goal_amount': float(room_data.goal_amount),
                'collected_amount': 0.0,
                'max_members': room_data.max_members,
                'current_members': 0,  # Will increment when creator is added as a member
                'risk_level': room_data.risk_level,
                'investment_type': room_data.investment_type,
                'status': 'open',
                'visibility': room_data.visibility,
                'room_code': room_code,
                'creator_id': room_data.creator_id,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'investment_start_date': None,
                'investment_end_date': None
            }
            
            result = self.rooms_collection.insert_one(room_doc)
            
            if result.inserted_id:
                # Add creator as room member
                self.add_room_member(str(result.inserted_id), room_data.creator_id, is_creator=True)
                
                return self.get_room_by_id(str(result.inserted_id))
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating room: {str(e)}")
            return None
    
    def get_room_by_id(self, room_id: str) -> Optional[RoomResponse]:
        """
        Get room by ID
        
        Args:
            room_id: Room ID
            
        Returns:
            Room data or None if not found
        """
        try:
            room_doc = self.rooms_collection.find_one({'_id': ObjectId(room_id)})
            if room_doc:
                room_doc['id'] = str(room_doc['_id'])
                del room_doc['_id']
                return RoomResponse(**room_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting room by ID: {str(e)}")
            return None
    
    def get_room_by_code(self, room_code: str) -> Optional[RoomResponse]:
        """
        Get room by room code
        
        Args:
            room_code: Room code
            
        Returns:
            Room data or None if not found
        """
        try:
            room_doc = self.rooms_collection.find_one({'room_code': room_code})
            if room_doc:
                room_doc['id'] = str(room_doc['_id'])
                del room_doc['_id']
                return RoomResponse(**room_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting room by code: {str(e)}")
            return None
    
    def get_user_rooms(self, user_id: str) -> List[RoomResponse]:
        """
        Get rooms where user is a member
        
        Args:
            user_id: User ID
            
        Returns:
            List of room data
        """
        try:
            # Get room IDs where user is a member
            member_rooms = self.room_members_collection.find({
                'user_id': user_id,
                'status': 'active'
            })
            
            room_ids = [ObjectId(member['room_id']) for member in member_rooms]
            
            # Get room details
            cursor = self.rooms_collection.find({'_id': {'$in': room_ids}})
            
            rooms = []
            for doc in cursor:
                doc['id'] = str(doc['_id'])
                del doc['_id']
                rooms.append(RoomResponse(**doc))
            
            return rooms
            
        except Exception as e:
            logger.error(f"Error getting user rooms: {str(e)}")
            return []
    
    def get_public_rooms(self, limit: int = 20, skip: int = 0) -> List[RoomResponse]:
        """
        Get public rooms
        
        Args:
            limit: Number of rooms to return
            skip: Number of rooms to skip
            
        Returns:
            List of public room data
        """
        try:
            cursor = self.rooms_collection.find({
                'visibility': 'public',
                'status': 'open'
            }).sort('created_at', -1).skip(skip).limit(limit)
            
            rooms = []
            for doc in cursor:
                doc['id'] = str(doc['_id'])
                del doc['_id']
                rooms.append(RoomResponse(**doc))
            
            return rooms
            
        except Exception as e:
            logger.error(f"Error getting public rooms: {str(e)}")
            return []
    
    def update_room(self, room_id: str, update_data: RoomUpdate) -> Optional[RoomResponse]:
        """
        Update room data
        
        Args:
            room_id: Room ID
            update_data: Update data
            
        Returns:
            Updated room data or None if failed
        """
        try:
            update_doc = update_data.dict(exclude_unset=True)
            update_doc['updated_at'] = datetime.utcnow()
            
            result = self.rooms_collection.update_one(
                {'_id': ObjectId(room_id)},
                {'$set': update_doc}
            )
            
            if result.modified_count > 0:
                return self.get_room_by_id(room_id)
            
            return None
            
        except Exception as e:
            logger.error(f"Error updating room: {str(e)}")
            return None
    
    def delete_room(self, room_id: str, user_id: str) -> bool:
        """
        Delete room (only by creator)
        
        Args:
            room_id: Room ID
            user_id: User ID (must be creator)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if user is the creator
            room = self.get_room_by_id(room_id)
            if not room or room.creator_id != user_id:
                return False
            
            # Delete room and all members
            self.rooms_collection.delete_one({'_id': ObjectId(room_id)})
            self.room_members_collection.delete_many({'room_id': room_id})
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting room: {str(e)}")
            return False
    
    def add_room_member(self, room_id: str, user_id: str, is_creator: bool = False) -> Optional[RoomMemberResponse]:
        """
        Add member to room
        
        Args:
            room_id: Room ID
            user_id: User ID
            is_creator: Whether the member is the creator
            
        Returns:
            Created member data or None if failed
        """
        try:
            # Check if room exists and has space
            room = self.get_room_by_id(room_id)
            if not room:
                return None
            
            if room.current_members >= room.max_members:
                return None
            
            # Check if user is already a member
            existing_member = self.room_members_collection.find_one({
                'room_id': room_id,
                'user_id': user_id
            })
            
            if existing_member:
                return None
            
            # Create member document
            member_doc = {
                'room_id': room_id,
                'user_id': user_id,
                'contribution_amount': 0.0,
                'is_creator': is_creator,
                'joined_at': datetime.utcnow(),
                'status': 'active'
            }
            
            result = self.room_members_collection.insert_one(member_doc)
            
            if result.inserted_id:
                # Update room member count
                self.rooms_collection.update_one(
                    {'_id': ObjectId(room_id)},
                    {'$inc': {'current_members': 1}}
                )
                
                return self.get_room_member_by_id(str(result.inserted_id))
            
            return None
            
        except Exception as e:
            logger.error(f"Error adding room member: {str(e)}")
            return None
    
    def remove_room_member(self, room_id: str, user_id: str) -> bool:
        """
        Remove member from room
        
        Args:
            room_id: Room ID
            user_id: User ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if user is the creator (creators can't leave, only delete room)
            room = self.get_room_by_id(room_id)
            if room and room.creator_id == user_id:
                return False
            
            # Remove member
            result = self.room_members_collection.update_one(
                {'room_id': room_id, 'user_id': user_id},
                {'$set': {'status': 'left'}}
            )
            
            if result.modified_count > 0:
                # Update room member count
                self.rooms_collection.update_one(
                    {'_id': ObjectId(room_id)},
                    {'$inc': {'current_members': -1}}
                )
                
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error removing room member: {str(e)}")
            return False
    
    def get_room_member_by_id(self, member_id: str) -> Optional[RoomMemberResponse]:
        """
        Get room member by ID
        
        Args:
            member_id: Member ID
            
        Returns:
            Member data or None if not found
        """
        try:
            member_doc = self.room_members_collection.find_one({'_id': ObjectId(member_id)})
            if member_doc:
                member_doc['id'] = str(member_doc['_id'])
                del member_doc['_id']
                # Coerce numeric types for serialization
                if 'contribution_amount' in member_doc:
                    try:
                        member_doc['contribution_amount'] = float(member_doc['contribution_amount'])
                    except Exception:
                        member_doc['contribution_amount'] = 0.0
                return RoomMemberResponse(**member_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting room member by ID: {str(e)}")
            return None
    
    def get_room_members(self, room_id: str) -> List[RoomMemberResponse]:
        """
        Get all members of a room
        
        Args:
            room_id: Room ID
            
        Returns:
            List of member data
        """
        try:
            cursor = self.room_members_collection.find({
                'room_id': room_id,
                'status': 'active'
            })
            
            members = []
            for doc in cursor:
                doc['id'] = str(doc['_id'])
                del doc['_id']
                if 'contribution_amount' in doc:
                    try:
                        doc['contribution_amount'] = float(doc['contribution_amount'])
                    except Exception:
                        doc['contribution_amount'] = 0.0
                members.append(RoomMemberResponse(**doc))
            
            return members
            
        except Exception as e:
            logger.error(f"Error getting room members: {str(e)}")
            return []
    
    def update_room_collected_amount(self, room_id: str, amount: Decimal) -> bool:
        """
        Update room collected amount
        
        Args:
            room_id: Room ID
            amount: Amount to add to collected amount
            
        Returns:
            True if successful, False otherwise
        """
        try:
            result = self.rooms_collection.update_one(
                {'_id': ObjectId(room_id)},
                {
                    '$inc': {'collected_amount': float(amount)},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            
            if result.modified_count > 0:
                # Fetch updated room to evaluate status transition
                room_doc = self.rooms_collection.find_one({'_id': ObjectId(room_id)})
                if room_doc:
                    goal = float(room_doc.get('goal_amount', 0.0) or 0.0)
                    collected = float(room_doc.get('collected_amount', 0.0) or 0.0)
                    status = room_doc.get('status', 'open')
                    if goal > 0 and collected >= goal and status == 'open':
                        # Mark room ready for investment
                        self.rooms_collection.update_one(
                            {'_id': ObjectId(room_id)},
                            {'$set': {'status': 'ready', 'updated_at': datetime.utcnow()}}
                        )
                return True
            return False
            
        except Exception as e:
            logger.error(f"Error updating room collected amount: {str(e)}")
            return False
