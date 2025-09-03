"""
Wallet Management Routes
Balance, transactions, and withdrawal management
"""

from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from decimal import Decimal
from app.services.wallet_service import WalletService
from app.services.user_service import UserService
from app.services.withdrawal_service import WithdrawalService
from app.middleware.auth_middleware import require_auth, get_current_user_id
import logging
import uuid

logger = logging.getLogger(__name__)

wallet_bp = Blueprint('wallet', __name__)

@wallet_bp.route('/balance', methods=['GET'])
@require_auth
def get_wallet_balance():
    """Get user wallet balance"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        wallet_service = WalletService(current_app.mongo.db)
        wallet = wallet_service.get_wallet_by_user_id(user.id)
        
        if not wallet:
            wallet = wallet_service.create_wallet(user.id)
        
        if not wallet:
            return jsonify({'error': 'Failed to get wallet'}), 500
        
        return jsonify({
            'success': True,
            'wallet': wallet.dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting wallet balance: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@wallet_bp.route('/transactions', methods=['GET'])
@require_auth
def get_wallet_transactions():
    """Get user wallet transactions"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        transaction_type = request.args.get('type')
        
        wallet_service = WalletService(current_app.mongo.db)
        # Use user.id (MongoDB ObjectId) instead of user_id (Firebase UID)
        transactions = wallet_service.get_user_transactions(
            user.id, limit=limit, skip=skip, transaction_type=transaction_type
        )
        
        return jsonify({
            'success': True,
            'transactions': [txn.dict() for txn in transactions],
            'pagination': {
                'limit': limit,
                'skip': skip,
                'count': len(transactions)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting wallet transactions: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@wallet_bp.route('/topup', methods=['POST'])
@require_auth
def topup_wallet():
    """Top up wallet via Paystack"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data or 'amount' not in data:
            return jsonify({'error': 'Amount is required'}), 400
        
        amount = float(data['amount'])
        if amount < 100 or amount > 1000000:
            return jsonify({'error': 'Amount must be between KSh 100 and KSh 1,000,000'}), 400
        
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        wallet_service = WalletService(current_app.mongo.db)
        wallet = wallet_service.get_wallet_by_user_id(user.id)
        
        if not wallet:
            wallet = wallet_service.create_wallet(user.id)
        
        if not wallet:
            return jsonify({'error': 'Failed to get wallet'}), 500
        
        reference = f"TOP-{uuid.uuid4().hex[:8].upper()}"
        
        from app.models.wallet import WalletTransactionCreate
        transaction_data = WalletTransactionCreate(
            user_id=user.id,
            wallet_id=wallet.id,
            type='deposit',
            amount=amount,
            reference=reference,
            description='Wallet top-up via Paystack'
        )
        
        transaction = wallet_service.create_transaction(transaction_data)
        
        if not transaction:
            return jsonify({'error': 'Failed to create transaction'}), 500
        
        # Immediately reflect balance for test flow (no external verification wired here)
        updated = wallet_service.update_wallet_balance(wallet.id, Decimal(str(amount)), 'deposit')
        if updated:
            wallet_service.update_transaction_status(transaction.id, 'completed', datetime.utcnow())
            # refresh wallet
            wallet = wallet_service.get_wallet_by_id(wallet.id)

        return jsonify({
            'success': True,
            'transaction': transaction.dict(),
            'wallet': wallet.dict() if wallet else None,
            'message': 'Top-up transaction created successfully'
        }), 201
        
    except Exception as e:
        logger.error(f"Error topping up wallet: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@wallet_bp.route('/withdraw', methods=['POST'])
@require_auth
def request_withdrawal():
    """Request wallet withdrawal"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data or 'amount' not in data:
            return jsonify({'error': 'Amount is required'}), 400
        
        amount = float(data['amount'])
        reason = data.get('reason', '')
        
        if amount < 100 or amount > 1000000:
            return jsonify({'error': 'Amount must be between KSh 100 and KSh 1,000,000'}), 400
        
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        wallet_service = WalletService(current_app.mongo.db)
        wallet = wallet_service.get_wallet_by_user_id(user.id)
        
        if not wallet:
            return jsonify({'error': 'Wallet not found'}), 404
        
        if wallet.balance < amount:
            return jsonify({'error': 'Insufficient balance'}), 400
        
        reference = f"WTH-{uuid.uuid4().hex[:8].upper()}"
        
        withdrawal_service = WithdrawalService(current_app.mongo.db)
        
        from app.models.withdrawal import WithdrawalCreate
        withdrawal_data = WithdrawalCreate(
            user_id=user.id,
            amount=amount,
            reference=reference,
            reason=reason
        )
        
        withdrawal = withdrawal_service.create_withdrawal(withdrawal_data)
        
        if not withdrawal:
            return jsonify({'error': 'Failed to create withdrawal request'}), 500
        
        return jsonify({
            'success': True,
            'withdrawal': withdrawal.dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error requesting withdrawal: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@wallet_bp.route('/withdrawals', methods=['GET'])
@require_auth
def get_withdrawals():
    """Get user withdrawal history"""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        status = request.args.get('status')
        
        withdrawal_service = WithdrawalService(current_app.mongo.db)
        withdrawals = withdrawal_service.get_user_withdrawals(
            user.id, limit=limit, skip=skip, status=status
        )
        
        return jsonify({
            'success': True,
            'withdrawals': [wth.dict() for wth in withdrawals],
            'pagination': {
                'limit': limit,
                'skip': skip,
                'count': len(withdrawals)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting withdrawals: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


