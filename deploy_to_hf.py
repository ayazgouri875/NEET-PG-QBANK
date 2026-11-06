#!/usr/bin/env python3
"""
Automated 1-Click Deployment to Hugging Face Spaces.
Uploads the complete NEET PG Master application (code, 119MB SQLite DB, 1.8GB clinical media)
directly to your free Hugging Face Space without needing credit cards or complex setups.
"""

import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

try:
    from huggingface_hub import HfApi, login
except ImportError:
    print("\n[!] 'huggingface_hub' is required. Please install it first:")
    print("    pip install huggingface_hub\n")
    sys.exit(1)


def main():
    print("=" * 65)
    print("  NEET PG Master - 1-Click Deployment to Hugging Face Spaces")
    print("=" * 65)
    print("Free • 16GB RAM • 50GB Disk • 0 Credit Card Required\n")

    # 1. Prompt for Space identifier
    space_id = input("Enter your Hugging Face Space ID (e.g. username/neet-pg-master): ").strip()
    if not space_id or "/" not in space_id:
        print("[!] Invalid format. Please use 'your-username/space-name'.")
        sys.exit(1)

    # 2. Prompt for Write Access Token
    hf_token = input("Enter your Hugging Face WRITE Token (from hf.co/settings/tokens): ").strip()
    if not hf_token:
        print("[!] Token cannot be empty. Get one with 'Write' role at https://huggingface.co/settings/tokens")
        sys.exit(1)

    print("\nConnecting to Hugging Face...")
    api = HfApi(token=hf_token)

    try:
        space_info = api.space_info(repo_id=space_id)
        print(f"[✓] Space verified: {space_info.id} (SDK: {space_info.sdk or 'Docker'})")
    except Exception as e:
        print(f"[!] Warning checking Space: {e}")
        proceed = input("Do you still want to attempt upload? (y/N): ").lower().strip()
        if proceed != 'y':
            sys.exit(1)

    print("\nUploading project files, 19,225 MCQs, and clinical images to Hugging Face...")
    print("This may take 3-6 minutes depending on your internet upload speed.\n")

    ignore_patterns = [
        ".git/*",
        ".venv/*",
        "*.pyc",
        "__pycache__/*",
        "admin/node_modules/*",
        "admin/dist/*",
        "data/imports/*.apkg",
        "data/extracted_media/*",
        "data/extracted_meta/*",
        ".DS_Store",
    ]

    try:
        api.upload_folder(
            folder_path=str(ROOT_DIR),
            repo_id=space_id,
            repo_type="space",
            token=hf_token,
            ignore_patterns=ignore_patterns,
        )
        print("\n" + "=" * 65)
        print("[SUCCESS] All files uploaded successfully!")
        print(f"Your application is now building at: https://huggingface.co/spaces/{space_id}")
        print("Once the build completes (2-3 mins), your app will be LIVE at:")
        username, repo_name = space_id.split("/", 1)
        print(f"👉 https://{username.replace('_', '-')}-{repo_name.replace('_', '-')}.hf.space")
        print("=" * 65)
    except Exception as e:
        print(f"\n[!] Upload error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
