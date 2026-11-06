#!/usr/bin/env python3
"""APKG Question Preview Tool.

Extracts and displays 20 stratified sample medical MCQs from the APKG archive,
demonstrating field mapping, HTML cleaning, option deduction, and clinical image extraction.

Usage:
    python importer/preview_questions.py [--file /path/to/archive.apkg] [--count 20]
"""

import argparse
import json
import os
from pathlib import Path
import sys

# Ensure repository root is on sys.path
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from backend.app.importer.extractor import APKGExtractor, FieldMappingConfig


def resolve_apkg_path(cli_path: str | None) -> Path:
    if cli_path:
        p = Path(cli_path)
        if p.exists():
            return p
        raise FileNotFoundError(f"APKG file not found at: {cli_path}")

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


def generate_markdown_preview(sample_dicts: list[dict], output_file: Path) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("# NEET PG Question Bank - 20 Sample Questions Preview\n\n")
        f.write("> [!NOTE]\n")
        f.write("> Generated from source Anki APKG collection. Verified field mappings, medical formatting, options, and explanations.\n\n")
        f.write(f"**Total Samples**: {len(sample_dicts)}\n\n")

        for idx, q in enumerate(sample_dicts, 1):
            q_identifier = q['mcq_id'] if q.get('mcq_id') else f"NID-{q['source_nid']}"
            f.write(f"## Sample #{idx}: [{q_identifier}] {q['subject']} ({q['category']})\n\n")
            f.write(f"- **Topic**: {q['topic']} | **Subtopic**: {q['subtopic']}\n")
            f.write(f"- **Deck**: `{q['deck_path']}`\n")
            if q["pyq_year"]:
                f.write(f"- **Exam / PYQ Year**: {q['pyq_year']}\n")
            f.write(f"- **Clinical Scenario**: {'🩺 Yes' if q['is_clinical'] else 'No'}\n")
            f.write(f"- **Associated Images**: {len(q['images'])}\n\n")

            f.write("### Question:\n")
            f.write(f"{q['question_text']}\n\n")

            if q["images"]:
                f.write("**Question Images:**\n")
                for img in q["images"]:
                    f.write(f"- `[{img['type'].upper()}]` `{img['filename']}` (Local: `{img['extracted_path'] or 'pending'}`)\n")
                f.write("\n")

            f.write("### Options:\n")
            for opt in q["options"]:
                status = "✅ **(CORRECT)**" if opt["is_correct"] else ""
                f.write(f"- **({opt['label']})** {opt['text']} {status}\n")
            f.write("\n")

            f.write("### Explanation:\n")
            # Truncate explanation to 400 characters for markdown preview readability
            exp_snippet = q["explanation_text"][:400] + ("..." if len(q["explanation_text"]) > 400 else "")
            f.write(f"> {exp_snippet}\n\n")
            if q["references"]:
                f.write(f"**References**: {q['references']}\n\n")
            f.write("---\n\n")


def main():
    parser = argparse.ArgumentParser(description="Preview sample questions from NEET PG APKG.")
    parser.add_argument("--file", "-f", help="Path to APKG archive")
    parser.add_argument("--count", "-c", type=int, default=20, help="Number of sample questions")
    parser.add_argument("--json-out", default="data/preview/sample_20.json", help="Path for JSON preview output")
    parser.add_argument("--md-out", default="data/preview/sample_20.md", help="Path for Markdown preview output")
    args = parser.parse_args()

    try:
        apkg_path = resolve_apkg_path(args.file)
        print(f"Loading APKG extractor from: {apkg_path} ...")

        extractor = APKGExtractor(apkg_path=apkg_path, media_output_dir="data/extracted_media")
        print(f"Extracting {args.count} stratified sample questions...")
        samples = extractor.extract_sample_records(sample_count=args.count, extract_images=True)

        sample_dicts = [s.to_dict() for s in samples]

        # Save JSON
        json_p = Path(args.json_out)
        json_p.parent.mkdir(parents=True, exist_ok=True)
        with open(json_p, "w", encoding="utf-8") as f:
            json.dump(sample_dicts, f, indent=2)
        print(f"✅ Saved JSON preview to: {json_p}")

        # Save Markdown
        md_p = Path(args.md_out)
        generate_markdown_preview(sample_dicts, md_p)
        print(f"✅ Saved Markdown preview to: {md_p}")

        # Print console summary of first 3 samples
        print("\n" + "=" * 80)
        print("🔍 FIRST 3 SAMPLE PREVIEW (Console Summary)")
        print("=" * 80)
        for idx, s in enumerate(samples[:3], 1):
            print(f"\n[{idx}/{len(samples)}] {s.subject} ({s.category}) | {s.topic} > {s.subtopic}")
            print(f"MCQ ID: {s.mcq_id} | Anki NID: {s.source_nid}")
            print(f"Question: {s.question_text[:120]}...")
            print("Options:")
            for opt in s.options:
                mark = " [CORRECT]" if opt.is_correct else ""
                print(f"  ({opt.label}) {opt.text[:60]}{mark}")
            print(f"Explanation: {s.explanation_text[:140]}...")
            if s.images:
                print(f"Images ({len(s.images)}): {[img.filename for img in s.images]}")
        print("=" * 80)
        print(f"All {len(samples)} sample records are ready for inspection in {args.md_out} and {args.json_out}")

    except Exception as e:
        print(f"❌ Error during preview generation: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
