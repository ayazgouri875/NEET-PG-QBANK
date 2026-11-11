"""API Dependencies: Database sessions, Cookie/Bearer JWT auth, CSRF checks, and verification guards."""

from collections.abc import Generator
import secrets
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.app.core.database import SessionLocal
from backend.app.core.security import decode_access_token
from backend.app.models.user import RevokedToken, User, UserRole

security_scheme = HTTPBearer(auto_error=False)
_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def get_db() -> Generator[Session, None, None]:
    """Provides a transactional SQLAlchemy database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_csrf_if_cookie_auth(request: Request) -> None:
    """Enforces double-submit CSRF check on state-changing cookie-authenticated requests."""
    if request.method.upper() not in _UNSAFE_METHODS:
        return
    cookie_csrf = request.cookies.get("csrf_token")
    header_csrf = request.headers.get("x-csrf-token")
    if not cookie_csrf or not header_csrf or not secrets.compare_digest(cookie_csrf, header_csrf):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing or invalid.",
        )


def get_current_user(
    request: Request,
    auth: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validates Bearer header or HttpOnly access_token cookie, revocation, version, and email verification."""
    unauthorized_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    using_cookie = False
    raw_token: str | None = None
    if auth and auth.credentials:
        raw_token = auth.credentials
    elif request.cookies.get("access_token"):
        raw_token = request.cookies.get("access_token")
        using_cookie = True

    if not raw_token:
        raise unauthorized_exc

    if using_cookie:
        verify_csrf_if_cookie_auth(request)

    payload = decode_access_token(raw_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jti = payload.get("jti")
    if jti:
        revoked = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
        if revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been signed out. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise unauthorized_exc

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before accessing this resource.",
        )

    token_ver = payload.get("ver", 1)
    if token_ver != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensures the authenticated user holds administrative privileges."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required.",
        )
    return current_user
