#!/usr/bin/env python3
"""Execute full or test batch APKG import into the relational database.

Usage:
    python importer/run_import.py [--file /path/to/archive.apkg] [--batch-size 500] [--limit 1000]
"""

import argparse
import os
from pathlib import Path
import sys
import time

# Ensure repository root is on sys.path
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from backend.app.core.database import SessionLocal, init_db
from backend.app.importer.importer import BatchAPKGImporter, ImportProgress


def resolve_apkg_path(cli_path: str | None) -> Path:
    if cli_path:
        p = Path(cli_path)
        if p.exists():
            return p
        raise FileNotFoundError(f"APKG file not found: {cli_path}")

    env_path = os.environ.get("APKG_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)

    default_p = Path("data/imports/neet_pg.apkg")
    if default_p.exists():
        return default_p

    candidates = list(Path("data/imports").glob("*.apkg"))
    if candidates:
        return candidates[0]

    raise FileNotFoundError("No .apkg file found. Please provide --file <path>.")


def progress_tracker(progress: ImportProgress) -> None:
    pct = (progress.processed / progress.total_notes) * 100 if progress.total_notes else 0
    rate = progress.processed / progress.elapsed_seconds if progress.elapsed_seconds > 0 else 0
    bar = "█" * int(pct // 4) + "-" * (25 - int(pct // 4))
    print(
        f"\r[{bar}] {pct:>5.1f}% | Processed: {progress.processed:,}/{progress.total_notes:,} | "
        f"Imported: {progress.imported:,} | Dups: {progress.duplicates:,} | "
        f"Speed: {rate:>5.0f} rec/s",
        end="",
        flush=True,
    )


def main():
    parser = argparse.ArgumentParser(description="Run APKG database import pipeline.")
    parser.add_argument("--file", "-f", help="Direct path to .apkg file")
    parser.add_argument("--batch-size", "-b", type=int, default=500, help="Transaction batch size")
    parser.add_argument("--limit", "-l", type=int, default=None, help="Optional record limit for testing")
    parser.add_argument("--extract-media", action="store_true", help="Extract all referenced media files during import")
    args = parser.parse_args()

    try:
        apkg_path = resolve_apkg_path(args.file)
        print("=" * 80)
        print(" 🚀 STARTING NEET PG QUESTION BANK DATABASE IMPORT")
        print("=" * 80)
        print(f"Archive Target : {apkg_path}")
        print(f"Batch Size     : {args.batch_size}")
        print(f"Record Limit   : {args.limit if args.limit else 'All (Full Collection)'}")
        print(f"Extract Media  : {args.extract_media}")
        print("-" * 80)

        init_db()
        db = SessionLocal()

        try:
            importer = BatchAPKGImporter(
                db=db,
                apkg_path=apkg_path,
                batch_size=args.batch_size,
                extract_images=args.extract_media,
            )

            job = importer.run_import(
                limit=args.limit,
                progress_callback=progress_tracker,
            )

            print("\n" + "-" * 80)
            print("✅ IMPORT COMPLETED SUCCESSFULLY!")
            print(f"Job ID             : {job.id}")
            print(f"Status             : {job.status.value}")
            print(f"Total Notes        : {job.total_notes_in_source:,}")
            print(f"Imported Questions : {job.imported_records:,}")
            print(f"Duplicate MCQs     : {job.duplicate_records:,} (PYQ tagged & linked)")
            print(f"Failed Records     : {job.failed_records}")
            print("=" * 80)

        finally:
            db.close()

    except Exception as e:
        print(f"\n❌ Import execution failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

