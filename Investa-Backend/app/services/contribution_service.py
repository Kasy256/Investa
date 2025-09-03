"""
Contribution service for managing contribution operations
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from bson import ObjectId
from app.models.contribution import (
    Contribution, ContributionCreate, ContributionUpdate, ContributionResponse
)
from app.services.wallet_service import WalletService
from app.services.room_service import RoomService
import logging

logger = logging.getLogger(__name__)


class ContributionService:
    """Service for managing contribution operations"""
    
    def __init__(self, mongo_db):
        self.db = mongo_db
        self.contributions_collection = self.db.contributions
        self.wallet_service = WalletService(mongo_db)
        self.room_service = RoomService(mongo_db)
    
    def create_contribution(self, contribution_data: ContributionCreate) -> Optional[ContributionResponse]:
        """
        Create a new contribution
        
        Args:
            contribution_data: Contribution creation data
            
        Returns:
            Created contribution data or None if failed
        """
        try:
            # Check if user is a member of the room
            room = self.room_service.get_room_by_id(contribution_data.room_id)
            if not room:
                return None
            
            # Check if room is still open for contributions
            if room.status != 'open':
                return None
            
            # Check if user has sufficient wallet balance
            wallet = self.wallet_service.get_wallet_by_user_id(contribution_data.user_id)
            if not wallet or Decimal(str(wallet.balance)) < contribution_data.amount:
                return None
            
            # Create contribution document
            contribution_doc = {
                'room_id': contribution_data.room_id,
                'user_id': contribution_data.user_id,
                'amount': float(contribution_data.amount),
                'status': 'pending',
                'transaction_id': contribution_data.transaction_id,
                'payment_method': contribution_data.payment_method,
                'failure_reason': None,
                'created_at': datetime.utcnow(),
                'completed_at': None
            }
            
            result = self.contributions_collection.insert_one(contribution_doc)
            
            if result.inserted_id:
                # Process the contribution
                success = self._process_contribution(str(result.inserted_id))
                
                if success:
                    return self.get_contribution_by_id(str(result.inserted_id))
                else:
                    # Mark contribution as failed
                    self.update_contribution_status(str(result.inserted_id), 'failed', 'Insufficient balance')
                    return None
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating contribution: {str(e)}")
            return None
    
    def _process_contribution(self, contribution_id: str) -> bool:
        """
        Process a contribution (internal method)
        
        Args:
            contribution_id: Contribution ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            contribution = self.get_contribution_by_id(contribution_id)
            if not contribution:
                return False
            
            # Get user's wallet
            wallet = self.wallet_service.get_wallet_by_user_id(contribution.user_id)
            if not wallet:
                return False
            
            # Check if user has sufficient balance
            if Decimal(str(wallet.balance)) < Decimal(str(contribution.amount)):
                return False
            
            # Update wallet balance (deduct contribution amount)
            wallet_updated = self.wallet_service.update_wallet_balance(
                wallet.id, Decimal(str(contribution.amount)), 'contribution'
            )
            
            if not wallet_updated:
                return False
            
            # Create wallet transaction record
            from app.models.wallet import WalletTransactionCreate
            tx = self.wallet_service.create_transaction(WalletTransactionCreate(
                user_id=contribution.user_id,
                wallet_id=wallet.id,
                type='contribution',
                amount=Decimal(str(contribution.amount)),
                reference=contribution.transaction_id,
                description=f'Contribution to {contribution.room_id}',
                room_id=contribution.room_id,
                room_name=None
            ))
            if tx:
                from datetime import datetime as _dt
                self.wallet_service.update_transaction_status(tx.id, 'completed', _dt.utcnow())
            
            # Update room collected amount
            room_updated = self.room_service.update_room_collected_amount(
                contribution.room_id, Decimal(str(contribution.amount))
            )
            
            if not room_updated:
                # Rollback wallet transaction
                self.wallet_service.update_wallet_balance(
                    wallet.id, Decimal(str(contribution.amount)), 'deposit'  # Add back
                )
                return False
            
            # Update contribution status to completed
            self.update_contribution_status(contribution_id, 'completed')
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing contribution: {str(e)}")
            return False
    
    def get_contribution_by_id(self, contribution_id: str) -> Optional[ContributionResponse]:
        """
        Get contribution by ID
        
        Args:
            contribution_id: Contribution ID
            
        Returns:
            Contribution data or None if not found
        """
        try:
            contribution_doc = self.contributions_collection.find_one({'_id': ObjectId(contribution_id)})
            if contribution_doc:
                contribution_doc['id'] = str(contribution_doc['_id'])
                del contribution_doc['_id']
                return ContributionResponse(**contribution_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting contribution by ID: {str(e)}")
            return None
    
    def get_user_contributions(self, user_id: str, limit: int = 50, skip: int = 0,
                                   status: Optional[str] = None) -> List[ContributionResponse]:
        """
        Get user contributions with pagination and filtering
        
        Args:
            user_id: User ID
            limit: Number of contributions to return
            skip: Number of contributions to skip
            status: Filter by status
            
        Returns:
            List of contribution data
        """
        try:
            query = {'user_id': user_id}
            if status:
                query['status'] = status
            
            cursor = self.contributions_collection.find(query).sort('created_at', -1).skip(skip).limit(limit)
            
            contributions = []
            for doc in cursor:
                doc['id'] = str(doc['_id'])
                del doc['_id']
                contributions.append(ContributionResponse(**doc))
            
            return contributions
            
        except Exception as e:
            logger.error(f"Error getting user contributions: {str(e)}")
            return []
    
    def get_room_contributions(self, room_id: str, limit: int = 50, skip: int = 0) -> List[ContributionResponse]:
        """
        Get room contributions with pagination
        
        Args:
            room_id: Room ID
            limit: Number of contributions to return
            skip: Number of contributions to skip
            
        Returns:
            List of contribution data
        """
        try:
            cursor = self.contributions_collection.find({'room_id': room_id}).sort('created_at', -1).skip(skip).limit(limit)
            
            contributions = []
            for doc in cursor:
                doc['id'] = str(doc['_id'])
                del doc['_id']
                contributions.append(ContributionResponse(**doc))
            
            return contributions
            
        except Exception as e:
            logger.error(f"Error getting room contributions: {str(e)}")
            return []
    
    def update_contribution_status(self, contribution_id: str, status: str, 
                                       failure_reason: Optional[str] = None) -> bool:
        """
        Update contribution status
        
        Args:
            contribution_id: Contribution ID
            status: New status
            failure_reason: Failure reason if status is failed
            
        Returns:
            True if successful, False otherwise
        """
        try:
            update_doc = {'status': status}
            if failure_reason:
                update_doc['failure_reason'] = failure_reason
            
            if status == 'completed':
                update_doc['completed_at'] = datetime.utcnow()
            
            result = self.contributions_collection.update_one(
                {'_id': ObjectId(contribution_id)},
                {'$set': update_doc}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating contribution status: {str(e)}")
            return False
    
    def get_contribution_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Get user contribution statistics
        
        Args:
            user_id: User ID
            
        Returns:
            Contribution statistics
        """
        try:
            # Get total contributed amount
            total_contributed = self.contributions_collection.aggregate([
                {'$match': {'user_id': user_id, 'status': 'completed'}},
                {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
            ])
            
            total_amount = 0
            for doc in total_contributed:
                total_amount = doc['total']
                break
            
            # Get contribution count by status
            status_counts = self.contributions_collection.aggregate([
                {'$match': {'user_id': user_id}},
                {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
            ])
            
            status_stats = {}
            for doc in status_counts:
                status_stats[doc['_id']] = doc['count']
            
            # Get unique rooms contributed to
            unique_rooms = len(self.contributions_collection.distinct('room_id', {'user_id': user_id}))
            
            return {
                'total_contributed': float(total_amount),
                'status_counts': status_stats,
                'unique_rooms': unique_rooms
            }
            
        except Exception as e:
            logger.error(f"Error getting contribution stats: {str(e)}")
            return {}
