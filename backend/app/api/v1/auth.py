"""Production Authentication Endpoints: Registration, Email Verification, Login, Cookies, Password Recovery, and Sessions."""

from datetime import datetime, timedelta, timezone
import json
import logging
import secrets
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.app.api.deps import (
    get_current_user,
    get_db,
    security_scheme,
    verify_csrf_if_cookie_auth,
)
from backend.app.core import config
from backend.app.core.rate_limit import auth_rate_limiter, get_client_ip
from backend.app.core.security import (
    create_access_token,
    create_opaque_token,
    create_refresh_token,
    decode_access_token,
    get_password_hash,
    hash_token,
    needs_password_rehash,
    validate_password_strength,
    verify_password,
)
from backend.app.models.user import (
    EmailOTP,
    EmailVerificationToken,
    PasswordResetToken,
    RefreshToken,
    RevokedToken,
    User,
    UserRole,
)
from backend.app.schemas.user import (
    AuthConfigOut,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LogoutRequest,
    OTPResponse,
    RefreshTokenRequest,
    RegistrationResponse,
    ResendOTPRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SendRegistrationOTPRequest,
    SessionOut,
    StatusMessageResponse,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    UserProfileUpdate,
    VerifyOTPRequest,
)
from backend.app.services.email_service import (
    send_admin_registration_notification,
    send_otp_email,
    send_password_reset_email,
    send_verification_email,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    remember_me: bool = True,
) -> None:
    """Attaches HttpOnly access & refresh cookies plus a double-submit CSRF cookie."""
    access_max_age = config.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    refresh_max_age = config.REFRESH_TOKEN_EXPIRE_DAYS * 86400 if remember_me else None
    csrf_value = secrets.token_urlsafe(32)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite=config.COOKIE_SAMESITE,
        max_age=access_max_age if remember_me else None,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite=config.COOKIE_SAMESITE,
        max_age=refresh_max_age,
        path="/api/v1/auth",
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_value,
        httponly=False,
        secure=config.COOKIE_SECURE,
        samesite=config.COOKIE_SAMESITE,
        max_age=refresh_max_age,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Clears authentication and CSRF cookies from the client browser."""
    response.delete_cookie(key="access_token", path="/", samesite=config.COOKIE_SAMESITE)
    response.delete_cookie(key="refresh_token", path="/api/v1/auth", samesite=config.COOKIE_SAMESITE)
    response.delete_cookie(key="refresh_token", path="/", samesite=config.COOKIE_SAMESITE)
    response.delete_cookie(key="csrf_token", path="/", samesite=config.COOKIE_SAMESITE)


def _issue_auth_tokens(
    user: User,
    db: Session,
    response: Response,
    request: Request | None = None,
    remember_me: bool = True,
) -> Token:
    """Mints access + refresh tokens, persists hashed refresh session, and sets HttpOnly cookies."""
    now = _now_utc()
    user.last_login_at = now

    raw_refresh, refresh_jti, refresh_exp = create_refresh_token()
    if not remember_me:
        # Session logins still expire server-side within 24 hours
        refresh_exp = min(refresh_exp, now + timedelta(hours=24))

    ua = request.headers.get("user-agent", "")[:255] if request else None
    ip = get_client_ip(request) if request else None

    rt = RefreshToken(
        user_id=user.id,
        jti=refresh_jti,
        token_hash=hash_token(raw_refresh),
        user_agent=ua or None,
        ip_address=ip,
        expires_at=refresh_exp,
    )
    db.add(rt)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )
    _set_auth_cookies(response, access_token, raw_refresh, remember_me=remember_me)

    return Token(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
        expires_in=config.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
    )


def _verify_google_id_token(raw_token: str) -> dict:
    """Verifies a Google OAuth2 ID token against Google's tokeninfo endpoint."""
    if not config.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google Sign-In is not configured on this server.",
        )

    query = urlencode({"id_token": raw_token})
    url = f"https://oauth2.googleapis.com/tokeninfo?{query}"
    try:
        with urlopen(url, timeout=8) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except HTTPError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google authentication credential.",
        )
    except URLError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify Google Sign-In at this time.",
        )

    if info.get("aud") != config.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google credential audience mismatch.",
        )
    if str(info.get("email_verified", "")).lower() != "true" or not info.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email is not verified.",
        )
    return info


@router.get("/config", response_model=AuthConfigOut)
def get_auth_config():
    """Returns public authentication capabilities without exposing secrets."""
    email_ready = bool(config.RESEND_API_KEY or (config.SMTP_USER and config.SMTP_PASSWORD))
    return AuthConfigOut(
        google_enabled=bool(config.GOOGLE_CLIENT_ID),
        google_client_id=config.GOOGLE_CLIENT_ID or None,
        email_verification_enabled=email_ready,
        email_otp_enabled=email_ready,
    )


@router.post("/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Registers a new unverified student account, generates a single-use verification token,
    dispatches a verification link via Resend, and sends an optional admin notification.
    """
    auth_rate_limiter.check("register", get_client_ip(request), max_requests=15, window_seconds=300)

    clean_email = user_in.email.strip().lower()
    clean_name = user_in.full_name.strip()

    if len(clean_name) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full name must be at least 2 characters.")

    if user_in.confirm_password is not None and user_in.password != user_in.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")

    valid_pw, pw_err = validate_password_strength(user_in.password)
    if not valid_pw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_err)

    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in instead.",
        )

    now = _now_utc()
    user = User(
        email=clean_email,
        password_hash=get_password_hash(user_in.password),
        full_name=clean_name,
        target_exam_year=user_in.target_exam_year or 2026,
        role=UserRole.STUDENT,
        is_active=True,
        email_verified=False,
        is_verified=False,
    )
    db.add(user)
    db.flush()  # Obtain user.id before commit

    raw_token, token_digest = create_opaque_token()
    expires_at = now + timedelta(hours=config.EMAIL_VERIFICATION_EXPIRE_HOURS)
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=token_digest,
            expires_at=expires_at,
        )
    )

    verification_url = f"{config.FRONTEND_URL}/verify-email?token={raw_token}"
    sent, err_msg = send_verification_email(
        to_email=clean_email,
        user_name=clean_name,
        verification_url=verification_url,
        expire_hours=config.EMAIL_VERIFICATION_EXPIRE_HOURS,
    )
    if not sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=err_msg or "Unable to send verification email. Registration aborted.",
        )

    db.commit()
    db.refresh(user)

    # Optional Admin Registration Alert (never blocks user registration or leaks secrets)
    if config.ADMIN_NOTIFICATION_EMAIL:
        ok, admin_err = send_admin_registration_notification(
            user_name=user.full_name,
            user_email=user.email,
            registered_at=user.created_at or now,
        )
        if not ok:
            logger.warning("Admin registration notification skipped/failed: %s", admin_err)

    return RegistrationResponse(
        status="verification_required",
        message=f"Registration successful! We sent a verification link to {clean_email}. Please verify your email before signing in.",
        email=clean_email,
        email_verified=False,
    )


@router.get("/verify-email", response_model=StatusMessageResponse)
def verify_email(
    token: str = Query(..., min_length=10),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """Validates a single-use email verification token and marks the user's email as verified."""
    if request:
        auth_rate_limiter.check("verify_email", get_client_ip(request), max_requests=30, window_seconds=300)

    token_digest = hash_token(token.strip())
    record = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == token_digest)
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email verification token.",
        )

    if record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has already been used.",
        )

    now = _now_utc()
    if record.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new verification email.",
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated user account not found.")

    record.used_at = now
    user.email_verified = True
    user.is_verified = True
    db.commit()

    return StatusMessageResponse(
        status="verified",
        message="Your email has been verified successfully. You may now sign in.",
    )


@router.post("/resend-verification", response_model=StatusMessageResponse)
def resend_verification(
    req: ResendVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Sends a fresh single-use verification email without revealing whether the account exists."""
    auth_rate_limiter.check("resend_verification", get_client_ip(request), max_requests=6, window_seconds=300)

    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if user and user.is_active and not user.email_verified:
        now = _now_utc()
        db.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
        ).update({"used_at": now})

        raw_token, token_digest = create_opaque_token()
        expires_at = now + timedelta(hours=config.EMAIL_VERIFICATION_EXPIRE_HOURS)
        db.add(
            EmailVerificationToken(
                user_id=user.id,
                token_hash=token_digest,
                expires_at=expires_at,
            )
        )
        verification_url = f"{config.FRONTEND_URL}/verify-email?token={raw_token}"
        sent, err_msg = send_verification_email(
            to_email=user.email,
            user_name=user.full_name,
            verification_url=verification_url,
            expire_hours=config.EMAIL_VERIFICATION_EXPIRE_HOURS,
        )
        if not sent:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=err_msg or "Failed to dispatch verification email.",
            )
        db.commit()

    return StatusMessageResponse(
        status="ok",
        message="If an unverified account exists for that email address, a new verification link has been sent.",
    )


@router.post("/login", response_model=Token)
def login(login_in: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    """Authenticates verified users with rate limiting, lockout protection, Argon2id, and HttpOnly cookies."""
    auth_rate_limiter.check("login", get_client_ip(request), max_requests=25, window_seconds=60)

    clean_email = login_in.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    now = _now_utc()

    if user and user.locked_until and user.locked_until > now:
        remaining_mins = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account temporarily locked due to repeated failed attempts. Try again in {remaining_mins} minute(s).",
        )

    if not user or not verify_password(login_in.password, user.password_hash):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= config.LOGIN_MAX_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=config.LOGIN_LOCKOUT_MINUTES)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before signing in.",
        )

    # Transparently upgrade legacy bcrypt hashes to Argon2id on login
    if needs_password_rehash(user.password_hash):
        user.password_hash = get_password_hash(login_in.password)

    user.failed_login_attempts = 0
    user.locked_until = None
    return _issue_auth_tokens(user, db, response, request, remember_me=login_in.remember_me)


@router.post("/refresh", response_model=Token)
def refresh_session(
    request: Request,
    response: Response,
    req: RefreshTokenRequest | None = None,
    db: Session = Depends(get_db),
):
    """Rotates a valid refresh token (from HttpOnly cookie or body) for a fresh token pair."""
    auth_rate_limiter.check("refresh", get_client_ip(request), max_requests=40, window_seconds=60)

    cookie_rt = request.cookies.get("refresh_token")
    raw_refresh = (req.refresh_token if req and req.refresh_token else None) or cookie_rt

    if cookie_rt and not (req and req.refresh_token):
        verify_csrf_if_cookie_auth(request)

    if not raw_refresh:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing. Please sign in again.",
        )

    token_digest = hash_token(raw_refresh)
    rt = db.query(RefreshToken).filter(RefreshToken.token_hash == token_digest).first()
    if not rt:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token. Please sign in again.",
        )

    now = _now_utc()
    if rt.revoked_at is not None:
        # Replay detection: revoke all refresh sessions for this user immediately
        db.query(RefreshToken).filter(
            RefreshToken.user_id == rt.user_id,
            RefreshToken.revoked_at.is_(None),
        ).update({"revoked_at": now})
        db.commit()
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session security violation detected. Please sign in again.",
        )

    if rt.expires_at < now:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
        )

    user = db.query(User).filter(User.id == rt.user_id).first()
    if not user or not user.is_active or not user.email_verified:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account unavailable.",
        )

    rt.revoked_at = now
    remember_me = (rt.expires_at - rt.created_at) > timedelta(days=2)
    return _issue_auth_tokens(user, db, response, request, remember_me=remember_me)


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    request: Request,
    response: Response,
    req: LogoutRequest | None = None,
    auth: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
):
    """Revokes refresh session, blacklists current access token JTI, and clears auth cookies."""
    now = _now_utc()

    cookie_rt = request.cookies.get("refresh_token")
    raw_refresh = (req.refresh_token if req and req.refresh_token else None) or cookie_rt
    if raw_refresh:
        digest = hash_token(raw_refresh)
        rt = db.query(RefreshToken).filter(RefreshToken.token_hash == digest).first()
        if rt and rt.revoked_at is None:
            rt.revoked_at = now

    raw_access = (auth.credentials if auth else None) or request.cookies.get("access_token")
    if raw_access:
        payload = decode_access_token(raw_access)
        if payload and payload.get("jti"):
            jti = str(payload["jti"])
            exp_ts = payload.get("exp")
            expires_at = (
                datetime.fromtimestamp(exp_ts, tz=timezone.utc).replace(tzinfo=None)
                if isinstance(exp_ts, (int, float))
                else now + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
            )
            if not db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
                db.add(RevokedToken(jti=jti, expires_at=expires_at, revoked_at=now))

    db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
    db.commit()
    _clear_auth_cookies(response)
    return {"status": "logged_out"}


@router.post("/logout-all", status_code=status.HTTP_200_OK)
def logout_all_devices(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Invalidates all active access and refresh tokens across all devices."""
    now = _now_utc()
    current_user.token_version += 1
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": now})
    db.commit()
    _clear_auth_cookies(response)
    return {"status": "all_sessions_revoked"}


@router.get("/sessions", response_model=list[SessionOut])
def list_active_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists active non-revoked sessions for the authenticated user."""
    now = _now_utc()
    return (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .order_by(RefreshToken.created_at.desc())
        .all()
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def revoke_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revokes a specific refresh session belonging to the authenticated user."""
    rt = (
        db.query(RefreshToken)
        .filter(RefreshToken.id == session_id, RefreshToken.user_id == current_user.id)
        .first()
    )
    if not rt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    if rt.revoked_at is None:
        rt.revoked_at = _now_utc()
        db.commit()
    return {"status": "revoked"}


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return current_user


@router.patch("/me", response_model=UserOut)
def update_current_user_profile(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates the authenticated user's full name or target exam year."""
    if profile_in.full_name is not None:
        current_user.full_name = profile_in.full_name.strip()
    if profile_in.target_exam_year is not None:
        current_user.target_exam_year = profile_in.target_exam_year
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=Token)
def change_password(
    req: ChangePasswordRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Changes password (Argon2id), revokes prior sessions, and returns fresh tokens."""
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if req.confirm_password is not None and req.new_password != req.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New passwords do not match.")

    valid_pw, pw_err = validate_password_strength(req.new_password)
    if not valid_pw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_err)

    if req.current_password == req.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from your current password.",
        )

    now = _now_utc()
    current_user.password_hash = get_password_hash(req.new_password)
    current_user.token_version += 1
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": now})

    return _issue_auth_tokens(current_user, db, response, request)


@router.post("/forgot-password", response_model=StatusMessageResponse)
def forgot_password(
    req: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Sends a single-use Reset Password link to the registered email via Resend.
    Always returns a generic success message to prevent email enumeration.
    """
    auth_rate_limiter.check("forgot_password", get_client_ip(request), max_requests=6, window_seconds=300)

    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email, User.is_active == True).first()

    if user:
        now = _now_utc()
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ).update({"used_at": now})

        raw_token, token_digest = create_opaque_token()
        expires_at = now + timedelta(minutes=config.PASSWORD_RESET_EXPIRE_MINUTES)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=token_digest,
                expires_at=expires_at,
            )
        )

        reset_url = f"{config.FRONTEND_URL}/reset-password?token={raw_token}"
        sent, err_msg = send_password_reset_email(
            to_email=user.email,
            user_name=user.full_name,
            reset_url=reset_url,
            expire_minutes=config.PASSWORD_RESET_EXPIRE_MINUTES,
        )
        if not sent:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=err_msg or "Failed to dispatch password reset email.",
            )
        db.commit()

    return StatusMessageResponse(
        status="ok",
        message="If an account exists for that email address, a password reset link has been sent.",
    )


@router.post("/reset-password", response_model=StatusMessageResponse)
def reset_password(
    req: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Validates a single-use password reset token, updates Argon2id hash, and revokes all sessions."""
    auth_rate_limiter.check("reset_password", get_client_ip(request), max_requests=10, window_seconds=300)

    if req.confirm_password is not None and req.new_password != req.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")

    valid_pw, pw_err = validate_password_strength(req.new_password)
    if not valid_pw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_err)

    now = _now_utc()
    user: User | None = None

    if req.token:
        token_digest = hash_token(req.token.strip())
        reset_record = (
            db.query(PasswordResetToken)
            .filter(PasswordResetToken.token_hash == token_digest)
            .first()
        )
        if not reset_record:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid password reset token.")
        if reset_record.used_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This password reset link has already been used.",
            )
        if reset_record.expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset link has expired. Please request a new one.",
            )

        user = db.query(User).filter(User.id == reset_record.user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
        reset_record.used_at = now
    elif req.email and req.otp_code:
        clean_email = req.email.strip().lower()
        otp_record = (
            db.query(EmailOTP)
            .filter(
                EmailOTP.email == clean_email,
                EmailOTP.purpose == "password_reset",
                EmailOTP.otp_code == req.otp_code.strip(),
                EmailOTP.is_used == False,
            )
            .order_by(EmailOTP.id.desc())
            .first()
        )
        if not otp_record or otp_record.expires_at < now:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")
        user = db.query(User).filter(User.email == clean_email).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
        otp_record.is_used = True
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid password reset token is required.",
        )

    user.password_hash = get_password_hash(req.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.token_version += 1
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": now})
    db.commit()
    _clear_auth_cookies(response)

    return StatusMessageResponse(
        status="password_reset",
        message="Password reset successful. You may now sign in with your new password.",
    )


@router.post("/google", response_model=Token)
def login_with_google(
    login_in: GoogleLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticates a user with a cryptographically verified Google OAuth2 ID token."""
    raw_token = login_in.id_token or login_in.credential
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A verified Google ID token is required.",
        )

    info = _verify_google_id_token(raw_token)
    clean_email = info["email"].strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user:
        user = User(
            email=clean_email,
            password_hash=get_password_hash(secrets.token_urlsafe(32)),
            full_name=info.get("name") or "Medical Aspirant",
            target_exam_year=2026,
            role=UserRole.STUDENT,
            is_active=True,
            email_verified=True,
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

    return _issue_auth_tokens(user, db, response, request)


# Legacy OTP registration endpoints kept compatible with existing mobile/OTP clients
@router.post("/register-otp", response_model=OTPResponse, status_code=status.HTTP_200_OK)
def request_registration_otp(
    req: SendRegistrationOTPRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Optional OTP registration step."""
    auth_rate_limiter.check("register_otp", get_client_ip(request), max_requests=10, window_seconds=300)

    clean_email = req.email.strip().lower()
    valid_pw, pw_err = validate_password_strength(req.password)
    if not valid_pw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_err)

    existing = db.query(User).filter(User.email == clean_email).first()
    if existing and existing.email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in instead.",
        )

    db.query(EmailOTP).filter(
        EmailOTP.email == clean_email,
        EmailOTP.purpose == "registration",
        EmailOTP.is_used == False,
    ).update({"is_used": True})

    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = _now_utc() + timedelta(minutes=config.OTP_EXPIRE_MINUTES)
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

    sent, error_msg = send_otp_email(clean_email, otp_code, req.full_name)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_msg or "Failed to deliver verification email.",
        )

    return OTPResponse(
        status="otp_sent",
        message=f"A 6-digit verification code has been dispatched to {clean_email}.",
        email=clean_email,
    )


@router.post("/verify-otp", response_model=Token, status_code=status.HTTP_200_OK)
def verify_registration_otp(
    req: VerifyOTPRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Verifies optional 6-digit OTP and issues authenticated session cookies + tokens."""
    auth_rate_limiter.check("verify_otp", get_client_ip(request), max_requests=15, window_seconds=300)

    clean_email = req.email.strip().lower()
    clean_code = req.otp_code.strip()

    otp_record = (
        db.query(EmailOTP)
        .filter(
            EmailOTP.email == clean_email,
            EmailOTP.purpose == "registration",
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

    if otp_record.expires_at < _now_utc():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new OTP.",
        )

    user = db.query(User).filter(User.email == clean_email).first()
    if user and user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered and verified. Please sign in.",
        )

    otp_record.is_used = True

    if user:
        if otp_record.password_hash:
            user.password_hash = otp_record.password_hash
        if otp_record.full_name:
            user.full_name = otp_record.full_name
        user.is_active = True
        user.email_verified = True
        user.is_verified = True
    else:
        user = User(
            email=clean_email,
            password_hash=otp_record.password_hash or get_password_hash(secrets.token_urlsafe(24)),
            full_name=otp_record.full_name or "Medical Aspirant",
            target_exam_year=otp_record.target_exam_year or 2026,
            role=UserRole.STUDENT,
            is_active=True,
            email_verified=True,
            is_verified=True,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    return _issue_auth_tokens(user, db, response, request)


@router.post("/resend-otp", response_model=OTPResponse, status_code=status.HTTP_200_OK)
def resend_otp(req: ResendOTPRequest, request: Request, db: Session = Depends(get_db)):
    """Resends optional 6-digit registration verification OTP."""
    auth_rate_limiter.check("resend_otp", get_client_ip(request), max_requests=6, window_seconds=300)

    clean_email = req.email.strip().lower()
    last_otp = (
        db.query(EmailOTP)
        .filter(EmailOTP.email == clean_email, EmailOTP.purpose == "registration")
        .order_by(EmailOTP.id.desc())
        .first()
    )
    if not last_otp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending registration found for this email.",
        )

    db.query(EmailOTP).filter(
        EmailOTP.email == clean_email,
        EmailOTP.purpose == "registration",
        EmailOTP.is_used == False,
    ).update({"is_used": True})

    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = _now_utc() + timedelta(minutes=config.OTP_EXPIRE_MINUTES)

    new_otp = EmailOTP(
        email=clean_email,
        otp_code=otp_code,
        purpose="registration",
        full_name=last_otp.full_name,
        password_hash=last_otp.password_hash,
        target_exam_year=last_otp.target_exam_year,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(new_otp)
    db.commit()

    sent, error_msg = send_otp_email(clean_email, otp_code, last_otp.full_name)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_msg or "Failed to deliver verification email.",
        )

    return OTPResponse(
        status="otp_sent",
        message=f"A fresh verification code has been dispatched to {clean_email}.",
        email=clean_email,
    )
