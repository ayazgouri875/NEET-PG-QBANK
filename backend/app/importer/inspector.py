"""APKG Archive Inspector.

Inspects Anki package (.apkg) archives without loading the archive into RAM.
Reads collection.anki2 or collection.anki21, extracts note types, field mappings,
deck taxonomy, question counts per subject, duplicate detection, and media references.
"""

from collections import Counter
from dataclasses import dataclass, field
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
from typing import Any
import zipfile


@dataclass
class InspectionResult:
    file_path: str
    file_size_bytes: int
    db_format: str  # e.g., 'collection.anki2'
    media_count: int
    note_models: list[dict[str, Any]]
    total_notes: int
    total_cards: int
    subject_distribution: dict[str, int]
    deck_count: int
    decks: list[str]
    unique_mcq_ids: int
    duplicate_mcq_ids_count: int
    unique_questions_count: int
    duplicate_questions_count: int
    sample_duplicate_mcq_ids: list[str]
    field_names: list[str]
    has_images_in_questions: int
    has_images_in_explanations: int
    unique_images_referenced: int
    status: str = "success"
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_path": self.file_path,
            "file_size_bytes": self.file_size_bytes,
            "file_size_mb": round(self.file_size_bytes / (1024 * 1024), 2),
            "db_format": self.db_format,
            "media_count": self.media_count,
            "total_notes": self.total_notes,
            "total_cards": self.total_cards,
            "note_models": self.note_models,
            "field_names": self.field_names,
            "deck_count": self.deck_count,
            "subject_distribution": self.subject_distribution,
            "unique_mcq_ids": self.unique_mcq_ids,
            "duplicate_mcq_ids_count": self.duplicate_mcq_ids_count,
            "unique_questions_count": self.unique_questions_count,
            "duplicate_questions_count": self.duplicate_questions_count,
            "sample_duplicate_mcq_ids": self.sample_duplicate_mcq_ids,
            "has_images_in_questions": self.has_images_in_questions,
            "has_images_in_explanations": self.has_images_in_explanations,
            "unique_images_referenced": self.unique_images_referenced,
            "status": self.status,
            "errors": self.errors,
        }


class APKGInspector:
    """Streams and analyzes APKG packages safely with minimal memory usage."""

    def __init__(self, apkg_path: str | Path):
        self.apkg_path = Path(apkg_path)

    def validate_file(self) -> None:
        if not self.apkg_path.exists():
            raise FileNotFoundError(f"APKG file not found at: {self.apkg_path}")
        if not zipfile.is_zipfile(self.apkg_path):
            raise ValueError(f"Target file is not a valid ZIP/APKG archive: {self.apkg_path}")

    def inspect(self) -> InspectionResult:
        self.validate_file()
        file_size = self.apkg_path.stat().st_size
        errors: list[str] = []

        with zipfile.ZipFile(self.apkg_path, "r") as z:
            names = set(z.namelist())
            
            # Identify SQLite database member
            db_member = None
            for candidate in ["collection.anki21", "collection.anki2"]:
                if candidate in names:
                    db_member = candidate
                    break
            
            if not db_member:
                raise ValueError("No collection.anki2 or collection.anki21 found in APKG archive.")

            # Read media index
            media_map: dict[str, str] = {}
            if "media" in names:
                try:
                    with z.open("media") as mf:
                        media_map = json.load(mf)
                except Exception as e:
                    errors.append(f"Failed to parse media index: {e}")

            # Extract SQLite database safely to a temporary file
            with tempfile.TemporaryDirectory() as tmp_dir:
                extracted_db_path = Path(tmp_dir) / db_member
                with z.open(db_member) as source_f, open(extracted_db_path, "wb") as target_f:
                    # Stream in 1MB chunks to ensure RAM usage is strictly constant
                    while chunk := source_f.read(1024 * 1024):
                        target_f.write(chunk)

                conn = sqlite3.connect(extracted_db_path)
                try:
                    cur = conn.cursor()

                    # Query collection table
                    col_row = cur.execute("SELECT models, decks, tags FROM col").fetchone()
                    models_data = json.loads(col_row[0]) if col_row and col_row[0] else {}
                    decks_data = json.loads(col_row[1]) if col_row and col_row[1] else {}

                    # Parse note models
                    note_models = []
                    all_fields = []
                    for mid, mdata in models_data.items():
                        fields = [f["name"] for f in mdata.get("flds", [])]
                        all_fields.extend(fields)
                        note_models.append({
                            "id": mid,
                            "name": mdata.get("name"),
                            "field_count": len(fields),
                            "fields": fields,
                        })

                    # Counts
                    total_notes = cur.execute("SELECT count(*) FROM notes").fetchone()[0]
                    total_cards = cur.execute("SELECT count(*) FROM cards").fetchone()[0]

                    # Cards to deck mapping
                    card_decks = cur.execute("SELECT did, count(*) FROM cards GROUP BY did").fetchall()
                    subject_counts: Counter[str] = Counter()
                    deck_names = []

                    for did, count in card_decks:
                        deck_info = decks_data.get(str(did), {})
                        dname = deck_info.get("name", "Unknown")
                        deck_names.append(dname)
                        parts = dname.split("::")
                        if len(parts) >= 3:
                            subject = parts[2].strip()
                        elif len(parts) == 2:
                            subject = parts[1].strip()
                        else:
                            subject = dname.strip()
                        
                        # Normalize common subject variations
                        if "Gynaecology" in subject or "Obstetrics" in subject:
                            subject = "Obstetrics & Gynaecology"
                        elif subject == "PSM":
                            subject = "Community Medicine (PSM)"
                        elif subject == "Orthopaedics":
                            subject = "Orthopedics"
                        
                        subject_counts[subject] += count

                    # Deduplication & field analysis across notes
                    cur.execute("SELECT id, flds FROM notes")
                    notes = cur.fetchall()

                    mcq_id_counter: Counter[str] = Counter()
                    question_text_counter: Counter[str] = Counter()
                    img_in_q = 0
                    img_in_exp = 0
                    unique_img_refs = set()

                    img_regex = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)

                    for nid, flds_str in notes:
                        flds = flds_str.split("\x1f")
                        q_text = flds[0] if len(flds) > 0 else ""
                        mcq_id = flds[1].strip() if len(flds) > 1 else ""
                        exp_text = flds[11] if len(flds) > 11 else ""

                        if mcq_id:
                            mcq_id_counter[mcq_id] += 1

                        # Clean strip for question text duplicate detection
                        clean_q = re.sub(r"<[^>]+>", "", q_text).strip().lower()
                        if clean_q:
                            question_text_counter[clean_q] += 1

                        if "<img" in q_text.lower():
                            img_in_q += 1
                        if "<img" in exp_text.lower():
                            img_in_exp += 1

                        for src in img_regex.findall(flds_str):
                            unique_img_refs.add(src)

                    dup_mcq_ids = [k for k, v in mcq_id_counter.items() if v > 1]
                    dup_q_count = sum(1 for v in question_text_counter.values() if v > 1)

                    return InspectionResult(
                        file_path=str(self.apkg_path),
                        file_size_bytes=file_size,
                        db_format=db_member,
                        media_count=len(media_map),
                        note_models=note_models,
                        total_notes=total_notes,
                        total_cards=total_cards,
                        subject_distribution=dict(subject_counts.most_common()),
                        deck_count=len(deck_names),
                        decks=deck_names[:25],
                        unique_mcq_ids=len(mcq_id_counter),
                        duplicate_mcq_ids_count=len(dup_mcq_ids),
                        unique_questions_count=len(question_text_counter),
                        duplicate_questions_count=dup_q_count,
                        sample_duplicate_mcq_ids=dup_mcq_ids[:10],
                        field_names=all_fields,
                        has_images_in_questions=img_in_q,
                        has_images_in_explanations=img_in_exp,
                        unique_images_referenced=len(unique_img_refs),
                        status="success",
                        errors=errors,
                    )
                finally:
                    conn.close()

