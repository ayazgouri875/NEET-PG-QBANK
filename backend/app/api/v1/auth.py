"""Authentication Endpoints: Registration with OTP, Login, Profile."""

from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.core import config
from backend.app.core.security import create_access_token, get_password_hash, verify_password
from backend.app.models.user import EmailOTP, User, UserRole
from backend.app.schemas.user import (
    GoogleLoginRequest,
    OTPResponse,
    ResendOTPRequest,
    SendRegistrationOTPRequest,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    VerifyOTPRequest,
)
from backend.app.services.email_service import send_otp_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register-otp", response_model=OTPResponse, status_code=status.HTTP_200_OK)
def request_registration_otp(req: SendRegistrationOTPRequest, db: Session = Depends(get_db)):
    """
    Step 1 of Registration: Generates a 6-digit verification OTP and dispatches
    it to the applicant's registered Gmail/email address.
    """
    clean_email = req.email.strip().lower()

    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    # Invalidate any previous unused OTPs for this email
    db.query(EmailOTP).filter(EmailOTP.email == clean_email, EmailOTP.is_used == False).update({"is_used": True})

    # Generate a cryptographically secure 6-digit OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=config.OTP_EXPIRE_MINUTES)
    pwd_hash = get_password_hash(req.password)

    otp_record = EmailOTP(
        email=clean_email,
        otp_code=otp_code,
        purpose="registration",
        full_name=req.full_name.strip(),
        password_hash=pwd_hash,
        target_exam_year=req.target_exam_year or 2026,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(otp_record)
    db.commit()

    # Dispatch email
    sent, error_msg = send_otp_email(clean_email, otp_code, req.full_name)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg or "Failed to deliver verification email. Please verify SMTP settings.",
        )

    return OTPResponse(
        status="otp_sent",
        message=f"A 6-digit verification code has been dispatched to {clean_email}.",
        email=clean_email,
    )


@router.post("/verify-otp", response_model=Token, status_code=status.HTTP_200_OK)
def verify_registration_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Step 2 of Registration: Verifies the 6-digit OTP code. Upon successful verification,
    creates/activates the student account and returns an authenticated JWT session.
    """
    clean_email = req.email.strip().lower()
    clean_code = req.otp_code.strip()

    # Find the matching OTP record
    otp_record = (
        db.query(EmailOTP)
        .filter(
            EmailOTP.email == clean_email,
            EmailOTP.otp_code == clean_code,
            EmailOTP.is_used == False,
        )
        .order_by(EmailOTP.id.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check the 6 digits and try again.",
        )

    if otp_record.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new OTP.",
        )

    # Mark OTP as used
    otp_record.is_used = True

    # Create or activate user
    user = db.query(User).filter(User.email == clean_email).first()
    if user:
        if otp_record.password_hash:
            user.password_hash = otp_record.password_hash
        if otp_record.full_name:
            user.full_name = otp_record.full_name
        user.is_active = True
        user.is_verified = True
    else:
        user = User(
            email=clean_email,
            password_hash=otp_record.password_hash or get_password_hash("MedicalStudent2026!"),
            full_name=otp_record.full_name or "Medical Aspirant",
            target_exam_year=otp_record.target_exam_year or 2026,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id, role=user.role.value)
    return Token(access_token=token, token_type="bearer", user=user)


@router.post("/resend-otp", response_model=OTPResponse, status_code=status.HTTP_200_OK)
def resend_otp(req: ResendOTPRequest, db: Session = Depends(get_db)):
    """Resends a fresh 6-digit verification OTP to the registered email."""
    clean_email = req.email.strip().lower()

    # Fetch last OTP record to retain name and password hash
    last_otp = (
        db.query(EmailOTP)
        .filter(EmailOTP.email == clean_email)
        .order_by(EmailOTP.id.desc())
        .first()
    )

    full_name = last_otp.full_name if last_otp else "Doctor"
    pwd_hash = last_otp.password_hash if last_otp else None
    target_year = last_otp.target_exam_year if last_otp else 2026

    # Invalidate previous OTPs
    db.query(EmailOTP).filter(EmailOTP.email == clean_email, EmailOTP.is_used == False).update({"is_used": True})

    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=config.OTP_EXPIRE_MINUTES)

    new_otp = EmailOTP(
        email=clean_email,
        otp_code=otp_code,
        purpose="registration",
        full_name=full_name,
        password_hash=pwd_hash,
        target_exam_year=target_year,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(new_otp)
    db.commit()

    sent, error_msg = send_otp_email(clean_email, otp_code, full_name)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg or "Failed to deliver verification email.",
        )

    return OTPResponse(
        status="otp_sent",
        message=f"A fresh verification code has been dispatched to {clean_email}.",
        email=clean_email,
    )


@router.post("/google", response_model=Token)
def login_with_google(login_in: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Authenticates or automatically registers a student via Google OAuth."""
    clean_email = login_in.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        user = User(
            email=clean_email,
            password_hash=get_password_hash("GoogleOAuthAutoProvisionedPass123!"),
            full_name=login_in.full_name or "Medical Aspirant",
            target_exam_year=2026,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    token = create_access_token(subject=user.id, role=user.role.value)
    return Token(access_token=token, token_type="bearer", user=user)


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Simple, direct registration or credential update for medical students."""
    clean_email = user_in.email.strip().lower()
    if len(user_in.password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters.",
        )

    user = db.query(User).filter(User.email == clean_email).first()
    if user:
        # Existing user: update password and info and log in
        user.password_hash = get_password_hash(user_in.password)
        if user_in.full_name:
            user.full_name = user_in.full_name
        if user_in.target_exam_year:
            user.target_exam_year = user_in.target_exam_year
        user.is_active = True
        user.is_verified = True
        db.commit()
        db.refresh(user)
    else:
        user = User(
            email=clean_email,
            password_hash=get_password_hash(user_in.password),
            full_name=user_in.full_name or "Medical Student",
            target_exam_year=user_in.target_exam_year or 2026,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(subject=user.id, role=user.role.value)
    return Token(access_token=token, token_type="bearer", user=user)


@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    """Authenticates a user with registered email and password."""
    clean_email = login_in.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials or create an account.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    token = create_access_token(subject=user.id, role=user.role.value)
    return Token(access_token=token, token_type="bearer", user=user)


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return current_user


