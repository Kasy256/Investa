"""
Routes Package
API endpoint definitions and handlers
"""

from .auth import auth_bp
from .users import users_bp
from .wallet import wallet_bp
from .rooms import rooms_bp
from .contributions import contributions_bp
from .analytics import analytics_bp
from .paystack import paystack_bp
from .investments import investments_bp

__all__ = [
    'auth_bp',
    'users_bp',
    'wallet_bp', 
    'rooms_bp',
    'contributions_bp',
    'analytics_bp',
    'paystack_bp',
    'investments_bp'
]
