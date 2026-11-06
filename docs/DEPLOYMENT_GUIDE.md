# NEET PG Question Bank Platform - Production Deployment Guide

## 1. Overview & Production Topology

The NEET PG Question Bank platform is structured into containerized microservices orchestrated via Docker Compose or Kubernetes:

```mermaid
flowchart LR
    Client["📱 Flutter Mobile App / 💻 React Admin"] --> CDN["Cloudflare / CDN Edge"]
    CDN --> Nginx["Nginx Reverse Proxy (SSL / Gzip)"]
    Nginx --> FastAPI["FastAPI Application Server (4 Workers)"]
    FastAPI --> Postgres[("🐘 PostgreSQL 16 (Primary DB)")]
    FastAPI --> S3[("🖼️ S3 / MinIO (16,500+ Clinical Images)")]
```

---

## 2. Docker Compose Quickstart

### Step 1: Environment Variables Configuration
Create a `.env` file in the root directory:
```bash
POSTGRES_USER=neetpg_user
POSTGRES_PASSWORD=secure_master_password_2026
POSTGRES_DB=neetpg_qbank
DATABASE_URL=postgresql://neetpg_user:secure_master_password_2026@postgres:5432/neetpg_qbank
SECRET_KEY=generate_a_64_character_random_hex_string_here
DEBUG=False
```

### Step 2: Build and Launch Containers
```bash
docker-compose up --build -d
```

### Step 3: Run Database Import inside Container
```bash
docker-compose exec backend python importer/run_import.py --file data/imports/neet_pg.apkg --batch-size 1000
```

---

## 3. Services Ports & Endpoints

| Service | Host Port | Internal Port | Purpose |
| :--- | :--- | :--- | :--- |
| **FastAPI Backend** | `8000` | `8000` | REST API (`/api/v1/`) & Swagger Docs (`/docs`) |
| **React Admin Dashboard** | `3000` | `80` | Web administration panel |
| **PostgreSQL Database** | `5432` | `5432` | Primary relational database |

---

## 4. Production Database Backup Strategy

### Automated Nightly Backup Cron
Add to the host crontab:
```cron
0 2 * * * docker-compose -f /opt/neetpg/docker-compose.yml exec -T postgres pg_dump -U neetpg_user neetpg_qbank | gzip > /var/backups/neetpg_$(date +\%F).sql.gz
```

### Retention Policy
- Retain daily backups for 30 days.
- Retain monthly backups for 12 months.

