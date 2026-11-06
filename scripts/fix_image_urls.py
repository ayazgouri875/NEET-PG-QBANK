#!/usr/bin/env python3
"""Prefix all relative img src attributes in questions and explanations with /media/images/."""

import sqlite3
from pathlib import Path
import re
import sys

repo_root = Path(__file__).resolve().parent.parent
db_path = repo_root / "data" / "neet_pg.db"

if not db_path.exists():
    print(f"Error: Database not found at {db_path}")
    sys.exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

img_regex = re.compile(r'src=[\"\'](?!(?:https?://|/|data:))([^\"\']+)[\"\']')

print("Fixing image URLs in questions table...")
c.execute("SELECT id, html_content FROM questions WHERE html_content LIKE '%<img%'")
q_rows = c.fetchall()
q_updated = 0
for q_id, html in q_rows:
    if html and img_regex.search(html):
        new_html = img_regex.sub(r'src="/media/images/\1"', html)
        c.execute("UPDATE questions SET html_content=? WHERE id=?", (new_html, q_id))
        q_updated += 1

print(f"Updated {q_updated:,} questions.")

print("Fixing image URLs in explanations table...")
c.execute("SELECT id, html_content FROM explanations WHERE html_content LIKE '%<img%'")
e_rows = c.fetchall()
e_updated = 0
for e_id, html in e_rows:
    if html and img_regex.search(html):
        new_html = img_regex.sub(r'src="/media/images/\1"', html)
        c.execute("UPDATE explanations SET html_content=? WHERE id=?", (new_html, e_id))
        e_updated += 1

print(f"Updated {e_updated:,} explanations.")

conn.commit()
conn.close()
print("All image URLs successfully updated in database!")

