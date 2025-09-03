"""
Wallet models for the Investa application
"""

from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field
from bson import ObjectId


class UserWallet(BaseModel):
    """User wallet model"""
    
    id: Optional[str] = Field(None, alias="_id")
    user_id: str = Field(..., description="Reference to User")
    balance: Decimal = Field(default=Decimal('0.00'), description="Available balance")
    total_deposited: Decimal = Field(default=Decimal('0.00'), description="Total amount deposited")
    total_withdrawn: Decimal = Field(default=Decimal('0.00'), description="Total amount withdrawn")
    total_returns: Decimal = Field(default=Decimal('0.00'), description="Total returns earned")
    currency: str = Field(default="KES", description="Currency code")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }
        schema_extra = {
            "example": {
                "user_id": "user_id_here",
                "balance": 12500.50,
                "total_deposited": 20000.00,
                "total_withdrawn": 5000.00,
                "total_returns": 2500.50,
                "currency": "NGN"
            }
        }


class WalletTransaction(BaseModel):
    """Wallet transaction model"""
    
    id: Optional[str] = Field(None, alias="_id")
    user_id: str = Field(..., description="Reference to User")
    wallet_id: str = Field(..., description="Reference to UserWallet")
    type: str = Field(..., description="Transaction type: deposit, withdrawal, contribution, return")
    amount: Decimal = Field(..., description="Transaction amount")
    status: str = Field(default="pending", description="Transaction status")
    reference: str = Field(..., description="Transaction reference")
    description: str = Field(..., description="Transaction description")
    room_id: Optional[str] = Field(None, description="Reference to InvestmentRoom (for contributions/returns)")
    room_name: Optional[str] = Field(None, description="Room name (for display)")
    paystack_reference: Optional[str] = Field(None, description="Paystack transaction reference")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = Field(None)
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v)
        }
        schema_extra = {
            "example": {
                "user_id": "user_id_here",
                "wallet_id": "wallet_id_here",
                "type": "deposit",
                "amount": 1000.00,
                "status": "completed",
                "reference": "TXN-001",
                "description": "Wallet top-up via Paystack",
                "paystack_reference": "paystack_ref_here"
            }
        }


class WalletCreate(BaseModel):
    """Wallet creation model"""
    user_id: str


class WalletUpdate(BaseModel):
    """Wallet update model"""
    balance: Optional[Decimal] = None
    total_deposited: Optional[Decimal] = None
    total_withdrawn: Optional[Decimal] = None
    total_returns: Optional[Decimal] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WalletTransactionCreate(BaseModel):
    """Wallet transaction creation model"""
    user_id: str
    wallet_id: str
    type: str
    amount: Decimal
    reference: str
    description: str
    room_id: Optional[str] = None
    room_name: Optional[str] = None
    paystack_reference: Optional[str] = None


class WalletTransactionUpdate(BaseModel):
    """Wallet transaction update model"""
    status: Optional[str] = None
    completed_at: Optional[datetime] = None


class WalletResponse(BaseModel):
    """Wallet response model"""
    id: str
    user_id: str
    balance: float
    total_deposited: float
    total_withdrawn: float
    total_returns: float
    currency: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class WalletTransactionResponse(BaseModel):
    """Wallet transaction response model"""
    id: str
    user_id: str
    wallet_id: str
    type: str
    amount: float
    status: str
    reference: str
    description: str
    room_id: Optional[str] = None
    room_name: Optional[str] = None
    paystack_reference: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
