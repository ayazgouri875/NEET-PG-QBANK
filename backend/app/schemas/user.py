"""Pydantic schemas for User authentication and profiles."""

from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

from backend.app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    target_exam_year: int | None = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    email: EmailStr
    full_name: str | None = "Medical Student"
    google_id: str | None = None


class SendRegistrationOTPRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    target_exam_year: int | None = 2026


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str


class ResendOTPRequest(BaseModel):
    email: EmailStr


class OTPResponse(BaseModel):
    status: str
    message: str
    email: str


class UserOut(UserBase):
    id: int
    role: UserRole
    is_active: bool
    is_verified: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenPayload(BaseModel):
    sub: str | None = None
    role: str | None = None
    exp: int | None = None

