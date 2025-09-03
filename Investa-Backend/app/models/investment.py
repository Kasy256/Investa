"""
Investment voting models for demo recommendations
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class VoteCreate(BaseModel):
    room_id: str
    recommendation_id: str
    vote: str = Field(..., description="approve or reject")


class VoteResponse(BaseModel):
    id: str
    room_id: str
    recommendation_id: str
    user_id: str
    vote: str
    created_at: datetime
    updated_at: datetime


class VoteAggregate(BaseModel):
    room_id: str
    recommendation_id: Optional[str] = None
    approve: int = 0
    reject: int = 0
    total: int = 0

"""
Investment transaction models for the Investa application
"""

from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field
from bson import ObjectId


class InvestmentTransaction(BaseModel):
    """Investment transaction model"""
    
    id: Optional[str] = Field(None, alias="_id")
    room_id: str = Field(..., description="Reference to InvestmentRoom")
    type: str = Field(..., description="Transaction type: buy, sell, dividend, interest")
    asset_name: str = Field(..., description="Asset name")
    asset_type: str = Field(..., description="Asset type: stock, crypto, bond, etf")
    quantity: Decimal = Field(..., description="Asset quantity")
    price_per_unit: Decimal = Field(..., description="Price per unit")
    total_amount: Decimal = Field(..., description="Total transaction amount")
    transaction_date: datetime = Field(..., description="Transaction date")
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
                "room_id": "room_id_here",
                "type": "buy",
                "asset_name": "Apple Inc.",
                "asset_type": "stock",
                "quantity": 10.0,
                "price_per_unit": 150.00,
                "total_amount": 1500.00,
                "transaction_date": "2024-01-15T10:30:00Z"
            }
        }


class InvestmentTransactionCreate(BaseModel):
    """Investment transaction creation model"""
    room_id: str
    type: str
    asset_name: str
    asset_type: str
    quantity: Decimal
    price_per_unit: Decimal
    total_amount: Decimal
    transaction_date: datetime


class InvestmentTransactionUpdate(BaseModel):
    """Investment transaction update model"""
    type: Optional[str] = None
    asset_name: Optional[str] = None
    asset_type: Optional[str] = None
    quantity: Optional[Decimal] = None
    price_per_unit: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    transaction_date: Optional[datetime] = None


class InvestmentTransactionResponse(BaseModel):
    """Investment transaction response model"""
    id: str
    room_id: str
    type: str
    asset_name: str
    asset_type: str
    quantity: float
    price_per_unit: float
    total_amount: float
    transaction_date: datetime
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
