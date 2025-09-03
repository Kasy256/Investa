"""
Contribution models for the Investa application
"""

from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field
from bson import ObjectId


class Contribution(BaseModel):
    """Contribution model"""
    
    id: Optional[str] = Field(None, alias="_id")
    room_id: str = Field(..., description="Reference to InvestmentRoom")
    user_id: str = Field(..., description="Reference to User")
    amount: Decimal = Field(..., description="Contribution amount")
    status: str = Field(default="pending", description="Contribution status: pending, completed, failed")
    transaction_id: str = Field(..., description="Transaction reference")
    payment_method: str = Field(default="wallet", description="Payment method: wallet, card, bank")
    failure_reason: Optional[str] = Field(None, description="Failure reason if status is failed")
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
                "room_id": "room_id_here",
                "user_id": "user_id_here",
                "amount": 500.00,
                "status": "completed",
                "transaction_id": "TXN-001",
                "payment_method": "wallet"
            }
        }


class ContributionCreate(BaseModel):
    """Contribution creation model"""
    room_id: str
    user_id: str
    amount: Decimal
    transaction_id: str
    payment_method: str = "wallet"


class ContributionUpdate(BaseModel):
    """Contribution update model"""
    status: Optional[str] = None
    failure_reason: Optional[str] = None
    completed_at: Optional[datetime] = None


class ContributionResponse(BaseModel):
    """Contribution response model"""
    id: str
    room_id: str
    user_id: str
    amount: float
    status: str
    transaction_id: str
    payment_method: str
    failure_reason: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
