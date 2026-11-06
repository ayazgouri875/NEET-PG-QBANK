"""Application Configuration Settings."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(BASE_DIR / ".env")

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
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# App Settings
PROJECT_NAME = "NEET PG Question Bank Platform"
API_V1_STR = "/api/v1"
DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1")

# Email / SMTP Settings (Gmail, Outlook, Amazon SES or custom SMTP)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER or "noreply@neetpgmaster.com")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "NEET PG Master")
OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "10"))

