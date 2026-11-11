"""Pydantic schemas for production authentication, email verification, password reset, and sessions."""

from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field

from backend.app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    target_exam_year: int | None = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str | None = Field(default=None, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
    remember_me: bool = False


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    target_exam_year: int | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str | None = Field(default=None, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str | None = None
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str | None = Field(default=None, max_length=128)
    # Optional legacy OTP fields
    email: EmailStr | None = None
    otp_code: str | None = Field(default=None, min_length=6, max_length=6)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class RegistrationResponse(BaseModel):
    status: str
    message: str
    email: str
    email_verified: bool = False


class StatusMessageResponse(BaseModel):
    status: str
    message: str


class GoogleLoginRequest(BaseModel):
    id_token: str | None = None
    credential: str | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class SendRegistrationOTPRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=150)
    target_exam_year: int | None = 2026


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)


class ResendOTPRequest(BaseModel):
    email: EmailStr


class OTPResponse(BaseModel):
    status: str
    message: str
    email: str


class AuthConfigOut(BaseModel):
    google_enabled: bool
    google_client_id: str | None = None
    email_verification_enabled: bool
    email_otp_enabled: bool


class UserOut(UserBase):
    id: int
    role: UserRole
    is_active: bool
    email_verified: bool = False
    is_verified: bool = False
    last_login_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int = 1800
    user: UserOut


class SessionOut(BaseModel):
    id: int
    user_agent: str | None = None
    ip_address: str | None = None
    created_at: datetime
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenPayload(BaseModel):
    sub: str | None = None
    role: str | None = None
    jti: str | None = None
    type: str | None = None
    ver: int | None = None
    exp: int | None = None
