"""
Wallet Management Service
Handles wallet operations and transactions
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from bson import ObjectId
from app.models.wallet import (
    UserWallet, WalletTransaction, WalletCreate, WalletUpdate,
    WalletTransactionCreate, WalletTransactionUpdate,
    WalletResponse, WalletTransactionResponse
)
import logging

logger = logging.getLogger(__name__)

class WalletService:
    """Wallet management service"""
    
    def __init__(self, mongo_db):
        self.db = mongo_db
        self.wallets_collection = self.db.wallets
        self.transactions_collection = self.db.wallet_transactions
    
    def create_wallet(self, user_id: str) -> Optional[WalletResponse]:
        """Create new wallet for user"""
        try:
            existing_wallet = self.get_wallet_by_user_id(user_id)
            if existing_wallet:
                return existing_wallet
            
            wallet_doc = {
                'user_id': user_id,
                'balance': 0.0,
                'total_deposited': 0.0,
                'total_withdrawn': 0.0,
                'total_returns': 0.0,
                'currency': 'KES',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            result = self.wallets_collection.insert_one(wallet_doc)
            
            if result.inserted_id:
                return self.get_wallet_by_id(str(result.inserted_id))
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating wallet: {str(e)}")
            return None
    
    def get_wallet_by_id(self, wallet_id: str) -> Optional[WalletResponse]:
        """Get wallet by ID"""
        try:
            wallet_doc = self.wallets_collection.find_one({'_id': ObjectId(wallet_id)})
            if wallet_doc:
                wallet_doc['id'] = str(wallet_doc['_id'])
                del wallet_doc['_id']
                
                # Ensure user_id is a string
                if 'user_id' in wallet_doc and hasattr(wallet_doc['user_id'], '__str__'):
                    wallet_doc['user_id'] = str(wallet_doc['user_id'])
                
                return WalletResponse(**wallet_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting wallet by ID: {str(e)}")
            return None
    
    def get_wallet_by_user_id(self, user_id: str) -> Optional[WalletResponse]:
        """Get wallet by user ID"""
        try:
            wallet_doc = self.wallets_collection.find_one({'user_id': user_id})
            if wallet_doc:
                wallet_doc['id'] = str(wallet_doc['_id'])
                del wallet_doc['_id']
                
                # Ensure user_id is a string
                if 'user_id' in wallet_doc and hasattr(wallet_doc['user_id'], '__str__'):
                    wallet_doc['user_id'] = str(wallet_doc['user_id'])
                
                return WalletResponse(**wallet_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting wallet by user ID: {str(e)}")
            return None
    
    def update_wallet_balance(self, wallet_id: str, amount: Decimal, transaction_type: str) -> bool:
        """Update wallet balance based on transaction type"""
        try:
            wallet = self.get_wallet_by_id(wallet_id)
            if not wallet:
                return False
            
            # Calculate new balance
            current_balance = float(wallet.balance or 0.0)
            current_deposited = float(wallet.total_deposited or 0.0)
            current_withdrawn = float(wallet.total_withdrawn or 0.0)
            current_returns = float(wallet.total_returns or 0.0)

            amt = float(amount)

            new_balance = current_balance
            new_total_deposited = current_deposited
            new_total_withdrawn = current_withdrawn
            new_total_returns = current_returns

            if transaction_type in ['deposit', 'return']:
                new_balance = current_balance + amt
                if transaction_type == 'deposit':
                    new_total_deposited = current_deposited + amt
                else:
                    new_total_returns = current_returns + amt
            elif transaction_type in ['withdrawal', 'contribution']:
                new_balance = current_balance - amt
                if transaction_type == 'withdrawal':
                    new_total_withdrawn = current_withdrawn + amt
            else:
                return False
            
            # Prepare update document
            update_doc = {
                'balance': float(new_balance),
                'updated_at': datetime.utcnow()
            }
            
            if transaction_type == 'deposit':
                update_doc['total_deposited'] = float(new_total_deposited)
            elif transaction_type == 'withdrawal':
                update_doc['total_withdrawn'] = float(new_total_withdrawn)
            elif transaction_type == 'return':
                update_doc['total_returns'] = float(new_total_returns)
            
            result = self.wallets_collection.update_one(
                {'_id': ObjectId(wallet_id)},
                {'$set': update_doc}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating wallet balance: {str(e)}")
            return False
    
    def create_transaction(self, transaction_data: WalletTransactionCreate) -> Optional[WalletTransactionResponse]:
        """Create new wallet transaction"""
        try:
            transaction_doc = {
                'user_id': transaction_data.user_id,
                'wallet_id': transaction_data.wallet_id,
                'type': transaction_data.type,
                'amount': float(transaction_data.amount),
                'status': 'pending',
                'reference': transaction_data.reference,
                'description': transaction_data.description,
                'room_id': transaction_data.room_id,
                'room_name': transaction_data.room_name,
                'paystack_reference': transaction_data.paystack_reference,
                'created_at': datetime.utcnow(),
                'completed_at': None
            }
            
            # Idempotency: avoid duplicate by same reference
            existing = self.transactions_collection.find_one({'reference': transaction_doc['reference']})
            if existing:
                existing['id'] = str(existing['_id'])
                del existing['_id']
                
                # Ensure ObjectIds are converted to strings for Pydantic validation
                if 'wallet_id' in existing and hasattr(existing['wallet_id'], '__str__'):
                    existing['wallet_id'] = str(existing['wallet_id'])
                
                if 'user_id' in existing and hasattr(existing['user_id'], '__str__'):
                    existing['user_id'] = str(existing['user_id'])
                
                if 'room_id' in existing and existing['room_id'] and hasattr(existing['room_id'], '__str__'):
                    existing['room_id'] = str(existing['room_id'])
                
                return WalletTransactionResponse(**existing)

            result = self.transactions_collection.insert_one(transaction_doc)
            
            if result.inserted_id:
                return self.get_transaction_by_id(str(result.inserted_id))
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating transaction: {str(e)}")
            return None
    
    def get_transaction_by_id(self, transaction_id: str) -> Optional[WalletTransactionResponse]:
        """Get transaction by ID"""
        try:
            transaction_doc = self.transactions_collection.find_one({'_id': ObjectId(transaction_id)})
            if transaction_doc:
                transaction_doc['id'] = str(transaction_doc['_id'])
                del transaction_doc['_id']
                
                # Ensure wallet_id is a string
                if 'wallet_id' in transaction_doc and hasattr(transaction_doc['wallet_id'], '__str__'):
                    transaction_doc['wallet_id'] = str(transaction_doc['wallet_id'])
                
                # Ensure user_id is a string
                if 'user_id' in transaction_doc and hasattr(transaction_doc['user_id'], '__str__'):
                    transaction_doc['user_id'] = str(transaction_doc['user_id'])
                
                # Ensure room_id is a string if it exists
                if 'room_id' in transaction_doc and transaction_doc['room_id'] and hasattr(transaction_doc['room_id'], '__str__'):
                    transaction_doc['room_id'] = str(transaction_doc['room_id'])
                
                return WalletTransactionResponse(**transaction_doc)
            return None
            
        except Exception as e:
            logger.error(f"Error getting transaction by ID: {str(e)}")
            return None
    
    def get_user_transactions(self, user_id: str, limit: int = 50, skip: int = 0, 
                                  transaction_type: Optional[str] = None) -> List[WalletTransactionResponse]:
        """Get user transactions with pagination and filtering"""
        try:
            query = {'user_id': user_id}
            if transaction_type:
                query['type'] = transaction_type
            
            cursor = self.transactions_collection.find(query).sort('created_at', -1).skip(skip).limit(limit)
            all_docs = list(cursor)
            
            transactions = []
            for doc in all_docs:
                # Convert ObjectIds to strings for Pydantic validation
                doc['id'] = str(doc['_id'])
                del doc['_id']
                
                # Ensure wallet_id is a string
                if 'wallet_id' in doc and hasattr(doc['wallet_id'], '__str__'):
                    doc['wallet_id'] = str(doc['wallet_id'])
                
                # Ensure user_id is a string
                if 'user_id' in doc and hasattr(doc['user_id'], '__str__'):
                    doc['user_id'] = str(doc['user_id'])
                
                # Ensure room_id is a string if it exists
                if 'room_id' in doc and doc['room_id'] and hasattr(doc['room_id'], '__str__'):
                    doc['room_id'] = str(doc['room_id'])
                
                transactions.append(WalletTransactionResponse(**doc))
            
            return transactions
            
        except Exception as e:
            logger.error(f"Error getting user transactions: {str(e)}")
            return []
    
    def update_transaction_status(self, transaction_id: str, status: str, 
                                      completed_at: Optional[datetime] = None) -> bool:
        """Update transaction status"""
        try:
            update_doc = {'status': status}
            if completed_at:
                update_doc['completed_at'] = completed_at
            
            result = self.transactions_collection.update_one(
                {'_id': ObjectId(transaction_id)},
                {'$set': update_doc}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating transaction status: {str(e)}")
            return False
