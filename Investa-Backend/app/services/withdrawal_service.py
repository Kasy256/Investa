"""
Withdrawal service for managing withdrawal operations
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from bson import ObjectId
from app.models.withdrawal import (
    WithdrawalRequest, WithdrawalCreate, WithdrawalUpdate, WithdrawalResponse
)
from app.services.wallet_service import WalletService
import logging

logger = logging.getLogger(__name__)


class WithdrawalService:
    """Service for managing withdrawal operations"""
    
    def __init__(self, mongo_db):
        self.db = mongo_db
        self.withdrawals_collection = self.db.withdrawals
        self.wallet_service = WalletService(mongo_db)
    
    def create_withdrawal(self, withdrawal_data: WithdrawalCreate) -> Optional[WithdrawalResponse]:
        """
        Create a new withdrawal request
        
        Args:
            withdrawal_data: Withdrawal creation data
            
        Returns:
            Created withdrawal data or None if failed
        """
        try:
            # Check if user has sufficient wallet balance
            wallet = self.wallet_service.get_wallet_by_user_id(withdrawal_data.user_id)
            if not wallet or Decimal(str(wallet.balance)) < withdrawal_data.amount:
                return None
            
            # Check minimum withdrawal amount
            if withdrawal_data.amount < Decimal('100.00'):
                return None
            
            # Check maximum withdrawal amount
            if withdrawal_data.amount > Decimal('1000000.00'):
                return None
            
            # Create withdrawal document
            withdrawal_doc = {
                'user_id': withdrawal_data.user_id,
                'amount': withdrawal_data.amount,
                'status': 'pending',
                'reference': withdrawal_data.reference,
                'reason': withdrawal_data.reason,
                'paystack_reference': None,
                'processed_at': None,
                'created_at': datetime.utcnow()
            }
            
            result = self.withdrawals_collection.insert_one(withdrawal_doc)
            
            if result.inserted_id:
                return self.get_withdrawal_by_id(str(result.inserted_id))
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating withdrawal: {str(e)}")
            return None
    
    def process_withdrawal(self, withdrawal_id: str, paystack_reference: str) -> bool:
        """
        Process a withdrawal request
        
        Args:
            withdrawal_id: Withdrawal ID
            paystack_reference: Paystack transfer reference
            
        Returns:
            True if successful, False otherwise
        """
        try:
            withdrawal = self.get_withdrawal_by_id(withdrawal_id)
            if not withdrawal:
                return False
            
            # Update withdrawal status to processing
            self.update_withdrawal_status(withdrawal_id, 'processing', paystack_reference)
            
            # Get user's wallet
            wallet = self.wallet_service.get_wallet_by_user_id(withdrawal.user_id)
            if not wallet:
                self.update_withdrawal_status(withdrawal_id, 'failed', paystack_reference)
                return False
            
            # Check if user still has sufficient balance
            if Decimal(str(wallet.balance)) < Decimal(str(withdrawal.amount)):
                self.update_withdrawal_status(withdrawal_id, 'failed', paystack_reference)
                return False
            
            # Update wallet balance (deduct withdrawal amount)
            wallet_updated = self.wallet_service.update_wallet_balance(
                wallet.id, Decimal(str(withdrawal.amount)), 'withdrawal'
            )
            
            if not wallet_updated:
                self.update_withdrawal_status(withdrawal_id, 'failed', paystack_reference)
                return False
            
            # Create wallet transaction record
            from app.models.wallet import WalletTransactionCreate
            transaction_data = WalletTransactionCreate(
                user_id=withdrawal.user_id,
                wallet_id=wallet.id,
                type='withdrawal',
                amount=Decimal(str(withdrawal.amount)),
                reference=withdrawal.reference,
                description='Withdrawal',
                room_id=None,
                room_name=None,
                paystack_reference=paystack_reference
            )
            transaction = self.wallet_service.create_transaction(transaction_data)
            
            # Mark transaction as completed
            if transaction:
                self.wallet_service.update_transaction_status(transaction.id, 'completed', datetime.utcnow())
            
            # Update withdrawal status to completed
            self.update_withdrawal_status(withdrawal_id, 'completed', paystack_reference, datetime.utcnow())
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing withdrawal: {str(e)}")
            return False
    
    def get_withdrawal_by_id(self, withdrawal_id: str) -> Optional[WithdrawalResponse]:
        """
        Get withdrawal by ID
        
        Args:
            withdrawal_id: Withdrawal ID
            
        Returns:
            Withdrawal data or None if not found
        """
        try:
            withdrawal_doc = self.withdrawals_collection.find_one({'_id': ObjectId(withdrawal_id)})
            if withdrawal_doc:
                withdrawal_doc['id'] = str(withdrawal_doc['_id'])
                del withdrawal_doc['_id']
                return WithdrawalResponse(**withdrawal_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting withdrawal by ID: {str(e)}")
            return None
    
    def get_user_withdrawals(self, user_id: str, limit: int = 50, skip: int = 0,
                                 status: Optional[str] = None) -> List[WithdrawalResponse]:
        """
        Get user withdrawals with pagination and filtering
        
        Args:
            user_id: User ID
            limit: Number of withdrawals to return
            skip: Number of withdrawals to skip
            status: Filter by status
            
        Returns:
            List of withdrawal data
        """
        try:
            query = {'user_id': user_id}
            if status:
                query['status'] = status
            
            cursor = self.withdrawals_collection.find(query).sort('created_at', -1).skip(skip).limit(limit)
            
            withdrawals = []
            for doc in cursor:
                doc['id'] = str(doc['_id'])
                del doc['_id']
                withdrawals.append(WithdrawalResponse(**doc))
            
            return withdrawals
            
        except Exception as e:
            logger.error(f"Error getting user withdrawals: {str(e)}")
            return []
    
    def update_withdrawal_status(self, withdrawal_id: str, status: str, 
                                     paystack_reference: Optional[str] = None,
                                     processed_at: Optional[datetime] = None) -> bool:
        """
        Update withdrawal status
        
        Args:
            withdrawal_id: Withdrawal ID
            status: New status
            paystack_reference: Paystack reference
            processed_at: Processing timestamp
            
        Returns:
            True if successful, False otherwise
        """
        try:
            update_doc = {'status': status}
            
            if paystack_reference:
                update_doc['paystack_reference'] = paystack_reference
            
            if processed_at:
                update_doc['processed_at'] = processed_at
            
            result = self.withdrawals_collection.update_one(
                {'_id': ObjectId(withdrawal_id)},
                {'$set': update_doc}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating withdrawal status: {str(e)}")
            return False
    
    def cancel_withdrawal(self, withdrawal_id: str, user_id: str) -> bool:
        """
        Cancel a pending withdrawal
        
        Args:
            withdrawal_id: Withdrawal ID
            user_id: User ID (must be the owner)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            withdrawal = self.get_withdrawal_by_id(withdrawal_id)
            if not withdrawal or withdrawal.user_id != user_id:
                return False
            
            # Only pending withdrawals can be cancelled
            if withdrawal.status != 'pending':
                return False
            
            # Update status to cancelled
            result = self.withdrawals_collection.update_one(
                {'_id': ObjectId(withdrawal_id)},
                {'$set': {'status': 'cancelled'}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error cancelling withdrawal: {str(e)}")
            return False
    
    def get_withdrawal_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Get user withdrawal statistics
        
        Args:
            user_id: User ID
            
        Returns:
            Withdrawal statistics
        """
        try:
            # Get total withdrawn amount
            total_withdrawn = self.withdrawals_collection.aggregate([
                {'$match': {'user_id': user_id, 'status': 'completed'}},
                {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
            ])
            
            total_amount = 0
            for doc in total_withdrawn:
                total_amount = doc['total']
                break
            
            # Get withdrawal count by status
            status_counts = self.withdrawals_collection.aggregate([
                {'$match': {'user_id': user_id}},
                {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
            ])
            
            status_stats = {}
            for doc in status_counts:
                status_stats[doc['_id']] = doc['count']
            
            return {
                'total_withdrawn': float(total_amount),
                'status_counts': status_stats
            }
            
        except Exception as e:
            logger.error(f"Error getting withdrawal stats: {str(e)}")
            return {}
