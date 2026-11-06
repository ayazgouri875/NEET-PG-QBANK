# NEET PG Question Bank Platform

A high-performance medical education question-bank application inspired by Marrow and PrepLadder, built with **Flutter**, **FastAPI**, **PostgreSQL**, and **React**.

> [!IMPORTANT]
> **Zero-AI & Zero-RAG Guarantee**: All 19,225 medical MCQs, option choices, explanations, and clinical diagrams originate strictly from verified imported source materials. No generative AI or vector databases are utilized.

---

## 🚀 Key Highlights & Current Status

- **19,225 High-Yield Medical MCQs in Database**: 100% extracted, parsed, deduplicated, and relationalized with zero corrupt records.
- **76,900 Options**: Exactly 4 options (A, B, C, D) per question with verified correct answers.
- **100% Detailed Explanations**: High-yield medical explanations with standard textbook references (Harrison, Bailey & Love, Robbins, etc.).
- **All 19 NEET PG Subjects Seeded**:
  - **Pre-clinical**: Anatomy (1,005), Physiology (903), Biochemistry (807)
  - **Para-clinical**: Pathology (1,640), Pharmacology (1,349), Microbiology (1,108), Forensic Medicine (720), Community Medicine/PSM (1,308)
  - **Clinical**: Medicine (2,022), Surgery (1,923), ObGyn (1,481), Pediatrics (922), Ophthalmology (743), ENT (753), Orthopedics (596), Dermatology (559), Radiology (532), Psychiatry (477), Anaesthesia (377)
- **Production REST APIs**: Built with FastAPI, tested and verified across all endpoints (`/auth`, `/subjects`, `/questions`, `/tests`, `/bookmarks`, `/analytics`, `/admin`).
- **Student Mobile Application**: Flutter / Dart cross-platform mobile client with Material 3, clean architecture, and Provider state management.
- **LeetCode-Style Question Bank & Attempted Submissions**:
  - **Problem Set View**: Browse all 19,225 MCQs with live LeetCode statuses (`✓ Solved`, `✕ Incorrect`, `○ Unattempted`), difficulty filters, and subject search.
  - **Attempted Questions & Answers**: Dedicated section tracking all student attempts, comparing chosen options against verified keys (+4 / -1 scoring), time spent, and 1-click re-attempting of mistakes.
  - **Direct Question Solver**: Click any question to solve it individually, view high-yield Marrow clinical explanations, and zoom medical diagrams.
- **Marrow-Inspired MCQ Test Engine**: Practice & Exam mode, stopwatch timer, 1..N Question Palette grid, interactive Option Tiles, zoomable clinical image viewer, and custom test generator.
- **Admin Web Dashboard**: React 18 + TypeScript web administration portal for question curation, APKG import center, and quality audit.
- **Docker Compose Setup**: Production orchestration with PostgreSQL 16, FastAPI backend, and Nginx reverse proxy.
- **Automated Tests**: 20 unit and integration tests passing (`tests/test_importer.py` and `tests/test_api.py`).

---

## 🏃 Quick Start (Run in 2 Steps)

### 1. Launch the Backend Server (FastAPI)
```bash
./start_backend.sh
```
*Backend runs on `http://127.0.0.1:8000` with interactive OpenAPI docs at `http://127.0.0.1:8000/docs`.*

### 2. Launch the Web Portal (Student Q-Bank + Admin Dashboard)
```bash
./start_frontend.sh
```
*Open `http://localhost:3000` in your browser. You can immediately solve MCQs, take custom tests, view high-yield explanations, and manage the question bank.*

---

## 📱 Running the Student Mobile App (Flutter)

If you wish to run the native Flutter application on iOS or Android:

1. **Install Flutter SDK** (if not already installed on your Mac):
   ```bash
   brew install --cask flutter
   flutter doctor
   ```
2. **Launch the Flutter App**:
   ```bash
   cd frontend
   flutter pub get
   flutter run -d chrome  # Or target iOS Simulator / Android Emulator
   ```

---

## 📁 Repository Structure

```text
├── admin/                     # React + TypeScript Web Admin Dashboard
│   ├── src/                   # Components, Pages, API Client, Types
│   ├── Dockerfile             # Multi-stage Nginx build
│   └── nginx.conf             # Production reverse proxy config
├── backend/                   # FastAPI REST API Backend
│   ├── app/
│   │   ├── api/v1/            # /auth, /subjects, /questions, /tests, /bookmarks, /analytics, /admin
│   │   ├── core/              # Config, security (bcrypt + PyJWT), DB session
│   │   ├── importer/          # APKG streaming parser, batch importer, validator
│   │   ├── models/            # SQLAlchemy 2.0 PostgreSQL relational models
│   │   └── schemas/           # Pydantic validation schemas
│   ├── Dockerfile             # Production Python 3.13 image
│   └── requirements.txt       # Production dependencies
├── data/
│   ├── imports/               # Configurable APKG import directory
│   ├── extracted_media/       # Extracted clinical images
│   ├── neet_pg.db             # Populated relational database (19,225 MCQs)
│   └── preview/               # 20-sample previews (JSON & Markdown)
├── docker-compose.yml         # Container orchestration (Postgres, Backend, Admin)
├── docs/                      # Architectural blueprints & reports
│   ├── SYSTEM_ARCHITECTURE.md # Full system architecture & data flow diagrams
│   ├── DATABASE_SCHEMA.md     # Relational schema dictionary & ER diagrams
│   ├── IMPORT_VALIDATION_REPORT.md # 20,385-note audit and validation report
│   ├── DEPLOYMENT_GUIDE.md    # Production deployment and backup guide
│   └── ROADMAP.md             # 10-Phase progression roadmap
├── frontend/                  # Flutter / Dart Student Mobile Application
│   ├── lib/                   # Models, Providers, Screens, Widgets, Theme
│   └── pubspec.yaml           # Flutter dependencies
├── importer/                  # Standalone CLI tools for archive inspection, preview, and batch import
│   ├── inspect_apkg.py        # Archive inspection utility
│   ├── preview_questions.py   # 20-sample question preview generator
│   └── run_import.py          # Production batch importer
└── tests/                     # Unit and integration test suite (20 tests)
```

---

## 🛠️ CLI Utilities & Quickstart

### 1. Run Backend Server
```bash
.venv/bin/uvicorn backend.app.main:app --reload --port 8000
```
Interactive Swagger API docs available at: `http://localhost:8000/docs`

### 2. Run Automated Test Suite
```bash
.venv/bin/python -m unittest discover tests
```

### 3. Run Admin Web Dashboard
```bash
cd admin && npm install && npm run dev
```

### 4. Run Flutter Student App
```bash
cd frontend && flutter run
```

### 5. Launch Full Stack with Docker Compose
```bash
docker-compose up --build -d
```
