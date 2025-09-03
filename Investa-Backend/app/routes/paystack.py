"""
Paystack integration routes
"""

from flask import Blueprint, request, jsonify
from app.services.paystack_service import PaystackService
from app.services.wallet_service import WalletService
from app.services.user_service import UserService
from app.middleware.auth_middleware import require_auth, get_current_user_id
import logging

logger = logging.getLogger(__name__)

paystack_bp = Blueprint('paystack', __name__)


@paystack_bp.route('/initialize', methods=['POST'])
@require_auth
def initialize_payment():
    """
    Initialize Paystack payment
    
    Request body:
        {
            "amount": 1000.00,
            "email": "user@example.com",
            "reference": "TXN-123456"
        }
    
    Returns:
        Payment initialization data
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        required_fields = ['amount', 'email', 'reference']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        amount = float(data['amount'])
        email = data['email']
        reference = data['reference']
        
        # Validate amount
        if amount < 100 or amount > 1000000:
            return jsonify({'error': 'Amount must be between ₦100 and ₦1,000,000'}), 400
        
        # Initialize payment with Paystack
        paystack_service = PaystackService()
        payment_data = paystack_service.initialize_payment(
            email=email,
            amount=amount,
            reference=reference
        )
        
        if not payment_data:
            return jsonify({'error': 'Failed to initialize payment'}), 500
        
        return jsonify({
            'success': True,
            'payment_data': payment_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error initializing payment: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@paystack_bp.route('/verify', methods=['POST'])
def verify_payment():
    """
    Verify Paystack payment (webhook endpoint)
    
    Request body:
        {
            "reference": "TXN-123456"
        }
    
    Returns:
        Payment verification result
    """
    try:
        data = request.get_json()
        if not data or 'reference' not in data:
            return jsonify({'error': 'Reference is required'}), 400
        
        reference = data['reference']
        
        # Verify payment with Paystack
        paystack_service = PaystackService()
        verification_data = paystack_service.verify_payment(reference)
        
        if not verification_data:
            return jsonify({'error': 'Failed to verify payment'}), 500
        
        # Check if payment was successful
        if verification_data.get('status') == 'success':
            # Update wallet balance and transaction status
            _process_successful_payment(verification_data)
        
        return jsonify({
            'success': True,
            'verification_data': verification_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error verifying payment: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@paystack_bp.route('/webhook', methods=['POST'])
def paystack_webhook():
    """
    Handle Paystack webhook events
    
    Returns:
        Success response
    """
    try:
        # Get webhook signature
        signature = request.headers.get('X-Paystack-Signature')
        if not signature:
            return jsonify({'error': 'Missing signature'}), 400
        
        # Get payload
        payload = request.get_data(as_text=True)
        
        # Verify webhook signature
        paystack_service = PaystackService()
        if not paystack_service.verify_webhook_signature(payload, signature):
            return jsonify({'error': 'Invalid signature'}), 400
        
        # Parse webhook data
        import json
        webhook_data = json.loads(payload)
        
        # Handle different webhook events
        event_type = webhook_data.get('event')
        
        if event_type == 'charge.success':
            _handle_successful_charge(webhook_data['data'])
        elif event_type == 'transfer.success':
            _handle_successful_transfer(webhook_data['data'])
        elif event_type == 'transfer.failed':
            _handle_failed_transfer(webhook_data['data'])
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        logger.error(f"Error handling webhook: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@paystack_bp.route('/transfer', methods=['POST'])
@require_auth
def initiate_transfer():
    """
    Initiate Paystack transfer (for withdrawals)
    
    Request body:
        {
            "amount": 1000.00,
            "account_number": "0123456789",
            "bank_code": "058",
            "account_name": "John Doe",
            "reference": "WTH-123456"
        }
    
    Returns:
        Transfer initiation data
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        required_fields = ['amount', 'account_number', 'bank_code', 'account_name', 'reference']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        amount = float(data['amount'])
        account_number = data['account_number']
        bank_code = data['bank_code']
        account_name = data['account_name']
        reference = data['reference']
        
        # Validate amount
        if amount < 100 or amount > 1000000:
            return jsonify({'error': 'Amount must be between ₦100 and ₦1,000,000'}), 400
        
        # Get user from database
        user_service = UserService(request.app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if user has sufficient balance
        wallet_service = WalletService(request.app.mongo.db)
        wallet = wallet_service.get_wallet_by_user_id(user.id)
        
        if not wallet or wallet.balance < amount:
            return jsonify({'error': 'Insufficient balance'}), 400
        
        # Create transfer recipient
        paystack_service = PaystackService()
        recipient_data = paystack_service.create_transfer_recipient(
            account_number=account_number,
            bank_code=bank_code,
            account_name=account_name
        )
        
        if not recipient_data:
            return jsonify({'error': 'Failed to create transfer recipient'}), 500
        
        recipient_code = recipient_data['data']['recipient_code']
        
        # Initiate transfer
        transfer_data = paystack_service.initiate_transfer(
            amount=amount,
            recipient_code=recipient_code,
            reference=reference
        )
        
        if not transfer_data:
            return jsonify({'error': 'Failed to initiate transfer'}), 500
        
        return jsonify({
            'success': True,
            'transfer_data': transfer_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error initiating transfer: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@paystack_bp.route('/banks', methods=['GET'])
def get_banks():
    """
    Get list of supported banks
    
    Returns:
        List of banks
    """
    try:
        paystack_service = PaystackService()
        banks_data = paystack_service.get_banks()
        
        if not banks_data:
            return jsonify({'error': 'Failed to get banks'}), 500
        
        return jsonify({
            'success': True,
            'banks': banks_data['data']
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting banks: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@paystack_bp.route('/resolve-account', methods=['POST'])
def resolve_account():
    """
    Resolve account number to get account name
    
    Request body:
        {
            "account_number": "0123456789",
            "bank_code": "058"
        }
    
    Returns:
        Account resolution data
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        if 'account_number' not in data or 'bank_code' not in data:
            return jsonify({'error': 'account_number and bank_code are required'}), 400
        
        account_number = data['account_number']
        bank_code = data['bank_code']
        
        paystack_service = PaystackService()
        resolution_data = paystack_service.resolve_account_number(
            account_number=account_number,
            bank_code=bank_code
        )
        
        if not resolution_data:
            return jsonify({'error': 'Failed to resolve account'}), 500
        
        return jsonify({
            'success': True,
            'account_data': resolution_data['data']
        }), 200
        
    except Exception as e:
        logger.error(f"Error resolving account: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


async def _process_successful_payment(verification_data):
    """Process successful payment and update wallet"""
    try:
        reference = verification_data['reference']
        amount = verification_data['amount'] / 100  # Convert from kobo to naira
        
        # Find transaction by reference
        wallet_service = WalletService(request.app.mongo.db)
        # This would need to be implemented to find transaction by reference
        # and update wallet balance accordingly
        
        logger.info(f"Processing successful payment: {reference} - {amount}")
        
    except Exception as e:
        logger.error(f"Error processing successful payment: {str(e)}")


async def _handle_successful_charge(charge_data):
    """Handle successful charge webhook"""
    try:
        reference = charge_data['reference']
        amount = charge_data['amount'] / 100
        
        # Update wallet balance and transaction status
        logger.info(f"Handling successful charge: {reference} - {amount}")
        
    except Exception as e:
        logger.error(f"Error handling successful charge: {str(e)}")


async def _handle_successful_transfer(transfer_data):
    """Handle successful transfer webhook"""
    try:
        reference = transfer_data['reference']
        
        # Update withdrawal status
        logger.info(f"Handling successful transfer: {reference}")
        
    except Exception as e:
        logger.error(f"Error handling successful transfer: {str(e)}")


async def _handle_failed_transfer(transfer_data):
    """Handle failed transfer webhook"""
    try:
        reference = transfer_data['reference']
        
        # Update withdrawal status and refund wallet
        logger.info(f"Handling failed transfer: {reference}")
        
    except Exception as e:
        logger.error(f"Error handling failed transfer: {str(e)}")
