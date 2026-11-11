"""Database Session and Connection Management."""

from collections.abc import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import DATABASE_URL
from backend.app.models.base import Base

# Configure engine based on dialect
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Creates all database tables defined in SQLAlchemy models and runs lightweight migrations."""
    # Ensure all model classes are imported before create_all
    import backend.app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    migrations = [
        "ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 1",
        "ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 1 NOT NULL",
        "ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1 NOT NULL",
        "ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE users ADD COLUMN locked_until DATETIME",
        "ALTER TABLE users ADD COLUMN last_login_at DATETIME",
    ]
    for stmt in migrations:
        with engine.begin() as conn:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass  # Column already exists or handled by create_all


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

