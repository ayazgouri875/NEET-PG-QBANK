# ====================================================================
# NEET PG Master - Unified Production Dockerfile (Hugging Face Spaces)
# ====================================================================

# --- Stage 1: Build React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/admin
COPY admin/package*.json ./
RUN npm install
COPY admin/ ./
RUN npm run build

# --- Stage 2: Production Python Runtime ---
FROM python:3.11-slim

WORKDIR /app

# Install minimal system tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy application source code
COPY backend/ ./backend/
COPY importer/ ./importer/

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/admin/dist ./admin/dist

# Copy 19,225 MCQ SQLite database and clinical media images
COPY data/neet_pg.db ./data/neet_pg.db
COPY data/media/images/ ./data/media/images/

# Configure user 1000 for Hugging Face Spaces compatibility
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Hugging Face Spaces listens on port 7860
EXPOSE 7860

ENV DATABASE_URL="sqlite:////app/data/neet_pg.db"
ENV SECRET_KEY="neet-pg-qbank-super-secret-jwt-key-2026-production"
ENV DEBUG="False"

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
