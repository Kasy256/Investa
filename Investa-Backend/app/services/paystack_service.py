"""
Paystack service for handling payment operations
"""

import requests
import os
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class PaystackService:
    """Service for handling Paystack payment operations"""
    
    def __init__(self):
        self.secret_key = os.getenv('PAYSTACK_SECRET_KEY')
        self.public_key = os.getenv('PAYSTACK_PUBLIC_KEY')
        self.webhook_secret = os.getenv('PAYSTACK_WEBHOOK_SECRET')
        self.base_url = "https://api.paystack.co"
        
        if not self.secret_key:
            raise ValueError("PAYSTACK_SECRET_KEY environment variable is required")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Paystack API requests"""
        return {
            'Authorization': f'Bearer {self.secret_key}',
            'Content-Type': 'application/json'
        }
    
    def initialize_payment(self, email: str, amount: float, reference: str, 
                               callback_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Initialize a payment transaction
        
        Args:
            email: Customer email
            amount: Amount in kobo (Nigerian currency)
            reference: Transaction reference
            callback_url: Callback URL for payment completion
            
        Returns:
            Payment initialization response or None if failed
        """
        try:
            url = f"{self.base_url}/transaction/initialize"
            
            payload = {
                'email': email,
                'amount': int(amount * 100),  # Convert to kobo
                'reference': reference,
                'callback_url': callback_url or f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/payment/callback"
            }
            
            response = requests.post(url, json=payload, headers=self._get_headers())
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Paystack initialization failed: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error initializing payment: {str(e)}")
            return None
    
    def verify_payment(self, reference: str) -> Optional[Dict[str, Any]]:
        """
        Verify a payment transaction
        
        Args:
            reference: Transaction reference
            
        Returns:
            Payment verification response or None if failed
        """
        try:
            url = f"{self.base_url}/transaction/verify/{reference}"
            
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Paystack verification failed: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error verifying payment: {str(e)}")
            return None
    
    def create_transfer_recipient(self, account_number: str, bank_code: str, 
                                      account_name: str) -> Optional[Dict[str, Any]]:
        """
        Create a transfer recipient
        
        Args:
            account_number: Bank account number
            bank_code: Bank code
            account_name: Account holder name
            
        Returns:
            Transfer recipient response or None if failed
        """
        try:
            url = f"{self.base_url}/transferrecipient"
            
            payload = {
                'type': 'nuban',
                'name': account_name,
                'account_number': account_number,
                'bank_code': bank_code,
                'currency': 'NGN'
            }
            
            response = requests.post(url, json=payload, headers=self._get_headers())
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Paystack transfer recipient creation failed: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating transfer recipient: {str(e)}")
            return None
    
    def initiate_transfer(self, amount: float, recipient_code: str, 
                              reference: str, reason: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Initiate a transfer to a recipient
        
        Args:
            amount: Amount in kobo
            recipient_code: Transfer recipient code
            reference: Transfer reference
            reason: Transfer reason
            
        Returns:
            Transfer initiation response or None if failed
        """
        try:
            url = f"{self.base_url}/transfer"
            
            payload = {
                'source': 'balance',
                'amount': int(amount * 100),  # Convert to kobo
                'recipient': recipient_code,
                'reference': reference,
                'reason': reason or 'Withdrawal from Investa wallet'
            }
            
            response = requests.post(url, json=payload, headers=self._get_headers())
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Paystack transfer initiation failed: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error initiating transfer: {str(e)}")
            return None
    
    def get_transfer_status(self, transfer_code: str) -> Optional[Dict[str, Any]]:
        """
        Get transfer status
        
        Args:
            transfer_code: Transfer code
            
        Returns:
            Transfer status response or None if failed
        """
        try:
            url = f"{self.base_url}/transfer/{transfer_code}"
            
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Paystack transfer status check failed: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting transfer status: {str(e)}")
            return None
    
    def get_banks(self) -> Optional[Dict[str, Any]]:
        """
        Get list of supported banks
        
        Returns:
            List of banks or None if failed
        """
        try:
            url = f"{self.base_url}/bank"
            
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Paystack banks fetch failed: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting banks: {str(e)}")
            return None
    
    def resolve_account_number(self, account_number: str, bank_code: str) -> Optional[Dict[str, Any]]:
        """
        Resolve account number to get account name
        
        Args:
            account_number: Bank account number
            bank_code: Bank code
            
        Returns:
            Account resolution response or None if failed
        """
        try:
            url = f"{self.base_url}/bank/resolve"
            
            params = {
                'account_number': account_number,
                'bank_code': bank_code
            }
            
            response = requests.get(url, params=params, headers=self._get_headers())
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Paystack account resolution failed: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error resolving account number: {str(e)}")
            return None
    
    def verify_webhook_signature(self, payload: str, signature: str) -> bool:
        """
        Verify Paystack webhook signature
        
        Args:
            payload: Webhook payload
            signature: Webhook signature
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            import hmac
            import hashlib
            
            expected_signature = hmac.new(
                self.webhook_secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha512
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
            
        except Exception as e:
            logger.error(f"Error verifying webhook signature: {str(e)}")
            return False
