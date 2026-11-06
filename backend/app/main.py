"""FastAPI Main Application Entry Point."""

from contextlib import asynccontextmanager
from pathlib import Path
import sys

# Ensure repository root is on sys.path regardless of execution directory
_repo_root = str(Path(__file__).resolve().parent.parent.parent)
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.api.v1 import admin, analytics, auth, bookmarks, questions, subjects, tests
from backend.app.core.config import API_V1_STR, DATA_DIR, MEDIA_DIR, PROJECT_NAME
from backend.app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is ready on startup
    init_db()
    yield


app = FastAPI(
    title=PROJECT_NAME,
    description="High-performance NEET PG & INI-CET Question Bank Platform API inspired by Marrow.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware for Flutter Client and React Admin Dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve clinical media files (images, diagrams)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media/images", StaticFiles(directory=str(MEDIA_DIR)), name="media")
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media_fallback")

# Include API Routers
app.include_router(auth.router, prefix=API_V1_STR)
app.include_router(subjects.router, prefix=API_V1_STR)
app.include_router(questions.router, prefix=API_V1_STR)
app.include_router(tests.router, prefix=API_V1_STR)
app.include_router(bookmarks.router, prefix=API_V1_STR)
app.include_router(analytics.router, prefix=API_V1_STR)
app.include_router(admin.router, prefix=API_V1_STR)


@app.get("/health", tags=["System"])
def health_check():
    """Health status endpoint."""
    return {"status": "healthy", "service": PROJECT_NAME, "version": "1.0.0"}


@app.get("/", tags=["System"])
def root():
    """API Root documentation redirect."""
    return {
        "message": f"Welcome to {PROJECT_NAME} API",
        "docs_url": "/docs",
        "api_v1": API_V1_STR,
    }

