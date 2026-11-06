#!/usr/bin/env python3
"""Extract all media assets from APKG archive to data/media/images/.

Reads the internal 'media' JSON dictionary mapping zip entry IDs to original filenames,
and extracts them with high throughput.
"""

from pathlib import Path
import json
import os
import sys
import time
import zipfile

repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from backend.app.core.config import MEDIA_DIR, DATA_DIR


def extract_media(apkg_path: Path, output_dir: Path):
    if not apkg_path.exists():
        print(f"Error: APKG archive not found at {apkg_path}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Opening archive: {apkg_path} (Size: {apkg_path.stat().st_size / (1024*1024):.1f} MB)")
    print(f"Destination directory: {output_dir}")

    start_time = time.time()

    with zipfile.ZipFile(apkg_path, "r") as z:
        if "media" not in z.namelist():
            print("Error: 'media' file not found in APKG archive.")
            sys.exit(1)

        with z.open("media") as mf:
            media_map = json.load(mf)

        total_files = len(media_map)
        print(f"Found {total_files:,} media entries to extract.")

        extracted = 0
        skipped = 0
        bytes_written = 0

        for idx, (zip_key, original_filename) in enumerate(media_map.items(), 1):
            target_path = output_dir / original_filename

            # If already exists and size > 0, skip
            if target_path.exists() and target_path.stat().st_size > 0:
                skipped += 1
            else:
                try:
                    with z.open(zip_key) as src, open(target_path, "wb") as dst:
                        while chunk := src.read(512 * 1024):
                            dst.write(chunk)
                            bytes_written += len(chunk)
                    extracted += 1
                except KeyError:
                    # In rare cases, an entry in media map might not exist in zip
                    continue
                except Exception as e:
                    print(f"\nWarning: Failed to extract {zip_key} -> {original_filename}: {e}")

            if idx % 1000 == 0 or idx == total_files:
                elapsed = time.time() - start_time
                pct = (idx / total_files) * 100
                rate = idx / elapsed if elapsed > 0 else 0
                bar = "█" * int(pct // 4) + "-" * (25 - int(pct // 4))
                print(
                    f"\r[{bar}] {pct:>5.1f}% | Processed: {idx:,}/{total_files:,} | "
                    f"Extracted: {extracted:,} | Skipped: {skipped:,} | "
                    f"Speed: {rate:>5.0f} files/s",
                    end="",
                    flush=True,
                )

    total_time = time.time() - start_time
    print(f"\n\n Extraction completed in {total_time:.2f} seconds!")
    print(f"New extracted: {extracted:,}")
    print(f"Already present: {skipped:,}")
    print(f"Total files in {output_dir}: {len(list(output_dir.iterdir())):,}")


if __name__ == "__main__":
    apkg = DATA_DIR / "imports" / "neet_pg.apkg"
    extract_media(apkg, MEDIA_DIR)

