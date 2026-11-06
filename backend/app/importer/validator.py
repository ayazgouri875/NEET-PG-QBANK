"""APKG Import Validation Engine.

Performs exhaustive pre-import audits on all notes in the APKG collection.
Checks option counts, answer integrity, duplicate collision patterns, image reference completeness,
and deck hierarchy normalization.
"""

from collections import Counter, defaultdict
from dataclasses import dataclass, field
import json
from pathlib import Path
import re
import sqlite3
import tempfile
from typing import Any
import zipfile

from backend.app.importer.extractor import (
    DeckHierarchyParser,
    FieldMappingConfig,
    HTMLNormalizer,
)


@dataclass
class ValidationSummary:
    total_notes: int
    total_cards: int
    valid_records_count: int
    option_distribution: dict[int, int]
    direct_correct_index_count: int
    fallback_correct_answer_count: int
    unresolved_correct_answer_count: int
    unique_mcq_ids_count: int
    duplicate_mcq_ids_count: int
    duplicate_mcq_id_samples: dict[str, list[dict[str, Any]]]
    media_total_files: int
    referenced_images_count: int
    missing_media_count: int
    missing_media_samples: list[str]
    subject_question_counts: dict[str, int]
    topics_count: int
    subtopics_count: int
    pyq_questions_count: int
    clinical_scenario_questions_count: int
    image_based_questions_count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_notes": self.total_notes,
            "total_cards": self.total_cards,
            "valid_records_count": self.valid_records_count,
            "valid_record_percentage": round((self.valid_records_count / self.total_notes) * 100, 2) if self.total_notes else 0,
            "option_distribution": self.option_distribution,
            "direct_correct_index_count": self.direct_correct_index_count,
            "fallback_correct_answer_count": self.fallback_correct_answer_count,
            "unresolved_correct_answer_count": self.unresolved_correct_answer_count,
            "unique_mcq_ids_count": self.unique_mcq_ids_count,
            "duplicate_mcq_ids_count": self.duplicate_mcq_ids_count,
            "duplicate_mcq_id_samples": self.duplicate_mcq_id_samples,
            "media_total_files": self.media_total_files,
            "referenced_images_count": self.referenced_images_count,
            "missing_media_count": self.missing_media_count,
            "missing_media_samples": self.missing_media_samples,
            "subject_question_counts": self.subject_question_counts,
            "topics_count": self.topics_count,
            "subtopics_count": self.subtopics_count,
            "pyq_questions_count": self.pyq_questions_count,
            "clinical_scenario_questions_count": self.clinical_scenario_questions_count,
            "image_based_questions_count": self.image_based_questions_count,
        }


class APKGValidator:
    """Audits 100% of the collection before running the database import."""

    def __init__(self, apkg_path: str | Path, mapping: FieldMappingConfig | None = None):
        self.apkg_path = Path(apkg_path)
        self.mapping = mapping or FieldMappingConfig()

    def run_validation(self) -> ValidationSummary:
        with zipfile.ZipFile(self.apkg_path, "r") as z:
            media_map: dict[str, str] = {}
            if "media" in z.namelist():
                with z.open("media") as mf:
                    media_map = json.load(mf)
            
            archive_media_files = set(media_map.values())
            db_member = "collection.anki2" if "collection.anki2" in z.namelist() else "collection.anki21"

            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_db = Path(tmp_dir) / db_member
                with z.open(db_member) as src, open(tmp_db, "wb") as dst:
                    while chunk := src.read(1024 * 1024):
                        dst.write(chunk)

                conn = sqlite3.connect(tmp_db)
                try:
                    cur = conn.cursor()
                    col_info = cur.execute("SELECT models, decks FROM col").fetchone()
                    models_data = json.loads(col_info[0])
                    decks_data = json.loads(col_info[1])

                    mid, mdata = list(models_data.items())[0]
                    field_names = [f["name"] for f in mdata.get("flds", [])]

                    cur.execute("""
                        SELECT n.id, n.flds, c.did, n.tags 
                        FROM notes n 
                        JOIN cards c ON c.nid = n.id
                    """)
                    rows = cur.fetchall()

                    total_notes = len(rows)
                    option_dist: Counter[int] = Counter()
                    direct_correct = 0
                    fallback_correct = 0
                    unresolved_correct = 0

                    mcq_id_occurrences: dict[str, list[dict[str, Any]]] = defaultdict(list)
                    subject_counts: Counter[str] = Counter()
                    all_topics = set()
                    all_subtopics = set()
                    referenced_images = set()
                    pyq_count = 0
                    clinical_count = 0
                    img_based_count = 0

                    img_regex = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)

                    for row in rows:
                        nid, flds_str, did, tags_str = row
                        dname = decks_data.get(str(did), {}).get("name", "")
                        _, subject, topic, subtopic, pyq_year = DeckHierarchyParser.parse(dname)
                        subject_counts[subject] += 1
                        all_topics.add((subject, topic))
                        all_subtopics.add((subject, topic, subtopic))

                        fld_vals = flds_str.split("\x1f")
                        raw_fields = dict(zip(field_names, fld_vals))

                        q_raw = raw_fields.get(self.mapping.question_field, "")
                        mcq_id = raw_fields.get(self.mapping.mcq_id_field, "").strip()
                        c_idx_str = raw_fields.get(self.mapping.correct_index_field, "").strip()
                        c_opt_str = raw_fields.get(self.mapping.correct_option_field, "").strip()
                        exp_raw = raw_fields.get(self.mapping.explanation_field, "")

                        # Options count
                        opts = [raw_fields.get(f, "").strip() for f in self.mapping.option_fields if raw_fields.get(f, "").strip()]
                        option_dist[len(opts)] += 1

                        # Track duplicates
                        if mcq_id:
                            mcq_id_occurrences[mcq_id].append({
                                "nid": nid,
                                "deck": dname,
                                "subject": subject,
                                "topic": topic,
                                "subtopic": subtopic,
                            })

                        # Answer verification
                        if c_idx_str.isdigit() and 0 <= int(c_idx_str) < len(opts):
                            direct_correct += 1
                        elif c_opt_str or exp_raw:
                            fallback_correct += 1
                        else:
                            unresolved_correct += 1

                        # PYQ tracking
                        if "previous year" in dname.lower() or "pyq" in dname.lower() or pyq_year is not None:
                            pyq_count += 1

                        # Clinical scenario tracking
                        q_clean = HTMLNormalizer.strip_tags(q_raw)
                        if len(q_clean) > 250 or re.search(r"\b(year-old|presents with|history of|diagnosed with)\b", q_clean, re.I):
                            clinical_count += 1

                        # Image references
                        found_imgs = img_regex.findall(flds_str)
                        if found_imgs:
                            img_based_count += 1
                            for img in found_imgs:
                                referenced_images.add(img)

                    # Missing media
                    missing_imgs = [img for img in referenced_images if img not in archive_media_files]

                    # Duplicate samples
                    dup_samples = {
                        k: v for k, v in list(mcq_id_occurrences.items()) if len(v) > 1
                    }
                    sample_dups = dict(list(dup_samples.items())[:5])

                    return ValidationSummary(
                        total_notes=total_notes,
                        total_cards=total_notes,
                        valid_records_count=total_notes - unresolved_correct,
                        option_distribution=dict(option_dist),
                        direct_correct_index_count=direct_correct,
                        fallback_correct_answer_count=fallback_correct,
                        unresolved_correct_answer_count=unresolved_correct,
                        unique_mcq_ids_count=len(mcq_id_occurrences),
                        duplicate_mcq_ids_count=len(dup_samples),
                        duplicate_mcq_id_samples=sample_dups,
                        media_total_files=len(archive_media_files),
                        referenced_images_count=len(referenced_images),
                        missing_media_count=len(missing_imgs),
                        missing_media_samples=missing_imgs[:10],
                        subject_question_counts=dict(subject_counts.most_common()),
                        topics_count=len(all_topics),
                        subtopics_count=len(all_subtopics),
                        pyq_questions_count=pyq_count,
                        clinical_scenario_questions_count=clinical_count,
                        image_based_questions_count=img_based_count,
                    )
                finally:
                    conn.close()

