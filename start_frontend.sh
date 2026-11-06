#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR/admin"
echo "Starting NEET PG Student & Admin Web Portal on http://localhost:3000 ..."
npm run dev

