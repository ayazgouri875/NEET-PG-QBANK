#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi
echo "Starting NEET PG FastAPI Backend on http://127.0.0.1:8000 ..."
python3 -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000

