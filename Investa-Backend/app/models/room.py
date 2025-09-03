"""
Investment room models for the Investa application
"""

from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from bson import ObjectId


class InvestmentRoom(BaseModel):
    """Investment room model"""
    
    id: Optional[str] = Field(None, alias="_id")
    name: str = Field(..., description="Room name")
    description: str = Field(..., description="Room description")
    goal_amount: Decimal = Field(..., description="Investment goal amount")
    collected_amount: Decimal = Field(default=Decimal('0.00'), description="Amount collected so far")
    max_members: int = Field(..., description="Maximum number of members")
    current_members: int = Field(default=0, description="Current number of members")
    risk_level: str = Field(..., description="Risk level: conservative, moderate, aggressive")
    investment_type: str = Field(..., description="Investment type: stocks, crypto, bonds, etf, mixed")
    status: str = Field(default="open", description="Room status: open, ready, investing, closed")
    visibility: str = Field(default="public", description="Room visibility: public, private")
    room_code: str = Field(..., description="Unique room identifier")
    creator_id: str = Field(..., description="Reference to User (creator)")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    investment_start_date: Optional[datetime] = Field(None)
    investment_end_date: Optional[datetime] = Field(None)
    
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
                "name": "Tech Stocks Growth",
                "description": "A diversified portfolio focusing on growth technology stocks",
                "goal_amount": 5000.00,
                "max_members": 10,
                "risk_level": "moderate",
                "investment_type": "stocks",
                "visibility": "public",
                "room_code": "ROOM-001",
                "creator_id": "user_id_here"
            }
        }


class RoomMember(BaseModel):
    """Room member model"""
    
    id: Optional[str] = Field(None, alias="_id")
    room_id: str = Field(..., description="Reference to InvestmentRoom")
    user_id: str = Field(..., description="Reference to User")
    contribution_amount: Decimal = Field(default=Decimal('0.00'), description="Amount contributed by member")
    is_creator: bool = Field(default=False, description="Whether member is the room creator")
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="active", description="Member status: active, left, removed")
    
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
                "contribution_amount": 500.00,
                "is_creator": False,
                "status": "active"
            }
        }


class RoomCreate(BaseModel):
    """Room creation model"""
    name: str
    description: str
    goal_amount: Decimal
    max_members: int
    risk_level: str
    investment_type: str
    visibility: str = "public"
    creator_id: str


class RoomUpdate(BaseModel):
    """Room update model"""
    name: Optional[str] = None
    description: Optional[str] = None
    goal_amount: Optional[Decimal] = None
    max_members: Optional[int] = None
    risk_level: Optional[str] = None
    investment_type: Optional[str] = None
    visibility: Optional[str] = None
    status: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RoomMemberCreate(BaseModel):
    """Room member creation model"""
    room_id: str
    user_id: str
    is_creator: bool = False


class RoomMemberUpdate(BaseModel):
    """Room member update model"""
    contribution_amount: Optional[Decimal] = None
    status: Optional[str] = None


class RoomResponse(BaseModel):
    """Room response model"""
    id: str
    name: str
    description: str
    goal_amount: float
    collected_amount: float
    max_members: int
    current_members: int
    risk_level: str
    investment_type: str
    status: str
    visibility: str
    room_code: str
    creator_id: str
    created_at: datetime
    updated_at: datetime
    investment_start_date: Optional[datetime] = None
    investment_end_date: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class RoomMemberResponse(BaseModel):
    """Room member response model"""
    id: str
    room_id: str
    user_id: str
    contribution_amount: float
    is_creator: bool
    joined_at: datetime
    status: str
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class RoomWithMembers(RoomResponse):
    """Room response with members"""
    members: List[RoomMemberResponse] = []
