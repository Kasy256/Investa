"""
Withdrawal models for the Investa application
"""

from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field
from bson import ObjectId


class WithdrawalRequest(BaseModel):
    """Withdrawal request model"""
    
    id: Optional[str] = Field(None, alias="_id")
    user_id: str = Field(..., description="Reference to User")
    amount: Decimal = Field(..., description="Withdrawal amount")
    status: str = Field(default="pending", description="Withdrawal status: pending, processing, completed, failed")
    reference: str = Field(..., description="Withdrawal reference")
    reason: Optional[str] = Field(None, description="Withdrawal reason")
    paystack_reference: Optional[str] = Field(None, description="Paystack transfer reference")
    processed_at: Optional[datetime] = Field(None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
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
                "amount": 1000.00,
                "status": "pending",
                "reference": "WTH-001",
                "reason": "Personal expenses"
            }
        }


class WithdrawalCreate(BaseModel):
    """Withdrawal creation model"""
    user_id: str
    amount: Decimal
    reference: str
    reason: Optional[str] = None


class WithdrawalUpdate(BaseModel):
    """Withdrawal update model"""
    status: Optional[str] = None
    paystack_reference: Optional[str] = None
    processed_at: Optional[datetime] = None


class WithdrawalResponse(BaseModel):
    """Withdrawal response model"""
    id: str
    user_id: str
    amount: float
    status: str
    reference: str
    reason: Optional[str] = None
    paystack_reference: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
