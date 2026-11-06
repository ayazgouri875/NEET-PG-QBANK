#!/usr/bin/env python3
"""Command-line utility to inspect NEET PG APKG archives.

Usage:
    python importer/inspect_apkg.py [--file /path/to/archive.apkg] [--json-out report.json]
"""

import argparse
import json
import os
from pathlib import Path
import sys

# Ensure repository root is on sys.path
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from backend.app.importer.inspector import APKGInspector


def resolve_apkg_path(cli_path: str | None, cli_dir: str | None) -> Path:
    """Resolves APKG file from CLI args, env vars, or standard import directory."""
    if cli_path:
        p = Path(cli_path)
        if p.exists():
            return p
        raise FileNotFoundError(f"Specified APKG file not found: {cli_path}")

    env_path = os.environ.get("APKG_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)

    search_dir = Path(cli_dir) if cli_dir else Path(os.environ.get("APKG_DIR", "data/imports"))
    if search_dir.exists():
        candidates = list(search_dir.glob("*.apkg"))
        if candidates:
            # Pick largest or first candidate
            candidates.sort(key=lambda x: x.stat().st_size, reverse=True)
            return candidates[0]

    raise FileNotFoundError(
        f"No .apkg file found in '{search_dir}'. "
        "Please provide the file path using --file <path> or place your archive in 'data/imports/'."
    )


def print_inspection_summary(res_dict: dict) -> None:
    print("=" * 80)
    print(" 🏥 NEET PG APKG ARCHIVE INSPECTION REPORT")
    print("=" * 80)
    print(f"Archive File       : {res_dict['file_path']}")
    print(f"Archive Size       : {res_dict['file_size_mb']:,} MB ({res_dict['file_size_bytes']:,} bytes)")
    print(f"Database Format    : {res_dict['db_format']}")
    print(f"Media Files Mapped : {res_dict['media_count']:,}")
    print(f"Total Notes        : {res_dict['total_notes']:,}")
    print(f"Total Cards        : {res_dict['total_cards']:,}")
    print("-" * 80)

    print("📋 NOTE MODELS & FIELD STRUCTURE:")
    for m in res_dict["note_models"]:
        print(f"  Model ID: {m['id']} | Name: {m['name']} | Total Fields: {m['field_count']}")
        print(f"  Field Definitions: {', '.join(m['fields'])}")
    print("-" * 80)

    print("📚 SUBJECT BREAKDOWN (19 NEET PG SUBJECTS):")
    total_q = sum(res_dict["subject_distribution"].values())
    for subj, cnt in res_dict["subject_distribution"].items():
        pct = (cnt / total_q) * 100 if total_q else 0
        bar = "█" * int(pct // 2)
        print(f"  {subj:<30} : {cnt:>5,} questions ({pct:>5.1f}%) {bar}")
    print(f"  {'TOTAL':<30} : {total_q:>5,} questions")
    print("-" * 80)

    print("🔍 DATA INTEGRITY & DEDUPLICATION AUDIT:")
    print(f"  Unique MCQ IDs           : {res_dict['unique_mcq_ids']:,}")
    print(f"  Duplicate MCQ IDs        : {res_dict['duplicate_mcq_ids_count']:,} (cross-deck PYQ / subtopics)")
    print(f"  Unique Question Texts    : {res_dict['unique_questions_count']:,}")
    print(f"  Duplicate Question Texts : {res_dict['duplicate_questions_count']:,}")
    print(f"  Sample Duplicate MCQ IDs : {', '.join(res_dict['sample_duplicate_mcq_ids'][:8])}")
    print("-" * 80)

    print("🖼️ CLINICAL MEDIA AUDIT:")
    print(f"  Questions with Clinical Images   : {res_dict['has_images_in_questions']:,}")
    print(f"  Explanations with Diagram Images : {res_dict['has_images_in_explanations']:,}")
    print(f"  Unique Image Files Referenced   : {res_dict['unique_images_referenced']:,}")
    print("=" * 80)


def main():
    parser = argparse.ArgumentParser(description="Inspect Anki APKG question bank file.")
    parser.add_argument("--file", "-f", help="Direct path to .apkg file")
    parser.add_argument("--dir", "-d", help="Directory containing .apkg file")
    parser.add_argument("--json-out", "-j", help="Output path for JSON report")
    args = parser.parse_args()

    try:
        apkg_file = resolve_apkg_path(args.file, args.dir)
        print(f"Inspecting APKG package: {apkg_file} ...")
        inspector = APKGInspector(apkg_file)
        result = inspector.inspect()
        res_dict = result.to_dict()

        print_inspection_summary(res_dict)

        if args.json_out:
            out_p = Path(args.json_out)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            with open(out_p, "w", encoding="utf-8") as f:
                json.dump(res_dict, f, indent=2)
            print(f"JSON report saved to: {out_p}")

    except Exception as e:
        print(f"\n❌ Error during APKG inspection: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

