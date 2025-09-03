"""
Analytics models for the Investa application
"""

from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field
from bson import ObjectId


class Analytics(BaseModel):
    """Analytics model for demo simulation"""
    
    id: Optional[str] = Field(None, alias="_id")
    user_id: str = Field(..., description="Reference to User")
    room_id: Optional[str] = Field(None, description="Reference to InvestmentRoom (optional)")
    metric_type: str = Field(..., description="Metric type: portfolio_value, returns, performance")
    value: Decimal = Field(..., description="Metric value")
    date: datetime = Field(..., description="Date for the metric")
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
                "room_id": "room_id_here",
                "metric_type": "portfolio_value",
                "value": 12500.50,
                "date": "2024-01-15T00:00:00Z"
            }
        }


class AnalyticsCreate(BaseModel):
    """Analytics creation model"""
    user_id: str
    room_id: Optional[str] = None
    metric_type: str
    value: Decimal
    date: datetime


class AnalyticsResponse(BaseModel):
    """Analytics response model"""
    id: str
    user_id: str
    room_id: Optional[str] = None
    metric_type: str
    value: float
    date: datetime
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class PortfolioAnalytics(BaseModel):
    """Portfolio analytics response model"""
    total_portfolio_value: float
    total_invested: float
    total_returns: float
    returns_percentage: float
    active_rooms: int
    performance_data: list  # Time series data for charts


class RoomPerformance(BaseModel):
    """Room performance response model"""
    room_id: str
    room_name: str
    invested_amount: float
    current_value: float
    returns: float
    returns_percentage: float
    status: str = Field(default="active", description="Room status: active, closed, ended")
