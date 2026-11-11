"""Application Configuration Settings."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(BASE_DIR / ".env", override=True)

DATA_DIR = BASE_DIR / "data"
MEDIA_DIR = DATA_DIR / "media" / "images"
IMPORTS_DIR = DATA_DIR / "imports"

# Ensure runtime directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
IMPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Database
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/neet_pg.db")

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "neet-pg-qbank-super-secret-jwt-key-2026-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(os.getenv("LOGIN_LOCKOUT_MINUTES", "15"))
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# App Settings
PROJECT_NAME = "NEET PG Master"
API_V1_STR = "/api/v1"
DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

# Trusted CORS Origins (comma-separated in env, defaults to local dev + FRONTEND_URL)
_default_origins = f"{FRONTEND_URL},http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

# Cookie & CSRF Settings
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "").lower() in ("true", "1") or FRONTEND_URL.startswith("https://")
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()

# Email Service Settings (Resend API preferred, SMTP fallback optional)
RESEND_API_KEY = (os.getenv("RESEND_API_KEY") or "").strip()
EMAIL_FROM = (os.getenv("EMAIL_FROM") or os.getenv("SMTP_FROM_EMAIL") or "NEET PG Master <onboarding@resend.dev>").strip()
ADMIN_NOTIFICATION_EMAIL = (os.getenv("ADMIN_NOTIFICATION_EMAIL") or "").strip()
EMAIL_VERIFICATION_EXPIRE_HOURS = int(os.getenv("EMAIL_VERIFICATION_EXPIRE_HOURS") or "24")
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES") or "30")

# Legacy / Optional SMTP Fallback Settings
SMTP_HOST = (os.getenv("SMTP_HOST") or "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT") or "587")
SMTP_USER = (os.getenv("SMTP_USER") or "").strip()
SMTP_PASSWORD = (os.getenv("SMTP_PASSWORD") or "").replace(" ", "").strip()
SMTP_FROM_EMAIL = (os.getenv("SMTP_FROM_EMAIL") or SMTP_USER or EMAIL_FROM).strip()
SMTP_FROM_NAME = (os.getenv("SMTP_FROM_NAME") or "NEET PG Master").strip()
OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES") or "10")

