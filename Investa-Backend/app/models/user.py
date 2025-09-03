"""
User model for the Investa application
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class User(BaseModel):
    """User model"""
    
    id: Optional[str] = Field(None, alias="_id")
    firebase_uid: str = Field(..., description="Firebase Authentication UID")
    email: str = Field(..., description="User email address")
    display_name: str = Field(..., description="User display name")
    risk_preference: str = Field(default="moderate", description="Investment risk preference")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)
    profile_completed: bool = Field(default=False)
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }
        schema_extra = {
            "example": {
                "firebase_uid": "firebase_uid_here",
                "email": "user@example.com",
                "display_name": "John Doe",
                "risk_preference": "moderate",
                "is_active": True,
                "profile_completed": True
            }
        }


class UserCreate(BaseModel):
    """User creation model"""
    firebase_uid: str
    email: str
    display_name: str
    risk_preference: str = "moderate"


class UserUpdate(BaseModel):
    """User update model"""
    display_name: Optional[str] = None
    risk_preference: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserResponse(BaseModel):
    """User response model"""
    id: str
    firebase_uid: str
    email: str
    display_name: str
    risk_preference: str
    created_at: datetime
    updated_at: datetime
    is_active: bool
    profile_completed: bool
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
