"""Security utilities: Argon2id password hashing (with legacy bcrypt support), password policy, JWT & token helpers."""

from datetime import datetime, timedelta, timezone
import hashlib
import re
import secrets
from typing import Any
import uuid

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
import bcrypt
import jwt

from backend.app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    REFRESH_TOKEN_EXPIRE_DAYS,
    SECRET_KEY,
)

# Argon2id hasher adhering to OWASP recommended parameters
_argon2_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MiB
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against an Argon2id or legacy bcrypt hash."""
    if not plain_password or not hashed_password:
        return False

    if hashed_password.startswith("$argon2"):
        try:
            return _argon2_hasher.verify(hashed_password, plain_password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False

    if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except Exception:
            return False

    return False


def needs_password_rehash(hashed_password: str) -> bool:
    """Returns True if a stored hash is legacy bcrypt or uses outdated Argon2id parameters."""
    if not hashed_password.startswith("$argon2"):
        return True
    try:
        return _argon2_hasher.check_needs_rehash(hashed_password)
    except Exception:
        return True


def get_password_hash(password: str) -> str:
    """Hashes a plaintext password using Argon2id."""
    return _argon2_hasher.hash(password)


def validate_password_strength(password: str) -> tuple[bool, str | None]:
    """Enforces strong password policy: >= 8 chars, uppercase, lowercase, and number."""
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if len(password) > 128:
        return False, "Password must be 128 characters or fewer."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number."
    return True, None


def hash_token(raw_token: str) -> str:
    """Produces a deterministic SHA-256 hex digest for storing opaque verification/reset/refresh tokens."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_opaque_token() -> tuple[str, str]:
    """Generates a cryptographically secure random URL-safe token paired with its SHA-256 hash."""
    raw_token = secrets.token_urlsafe(32)
    return raw_token, hash_token(raw_token)


def create_access_token(
    subject: str | Any,
    role: str = "student",
    token_version: int = 1,
    expires_delta: timedelta | None = None,
) -> str:
    """Creates a short-lived signed JWT access token with unique JTI and token_version."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

    to_encode = {
        "exp": expire,
        "iat": now,
        "jti": uuid.uuid4().hex,
        "type": "access",
        "sub": str(subject),
        "role": role,
        "ver": token_version,
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token() -> tuple[str, str, datetime]:
    """Generates a cryptographically random refresh token, its JTI, and naive UTC expiry."""
    raw_token = secrets.token_urlsafe(48)
    jti = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, jti, expires_at


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decodes and validates a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.PyJWTError:
        return None
