"""Production APKG Batch Importer and Synchronizer.

Implements transactional, resumable batch importing of medical MCQs into the relational database.
Handles hierarchy creation, deduplication, error logging, and post-import statistics recalculation.
"""

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import re
import sqlite3
import tempfile
import time
from typing import Any
import zipfile

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from backend.app.core.config import MEDIA_DIR
from backend.app.importer.extractor import (
    APKGExtractor,
    DeckHierarchyParser,
    FieldMappingConfig,
    HTMLNormalizer,
    SUBJECT_CATEGORY_MAP,
)
from backend.app.models import (
    Explanation,
    ImageType,
    ImportError,
    ImportJob,
    ImportStatus,
    Question,
    QuestionImage,
    QuestionOption,
    QuestionTag,
    Subject,
    SubjectCategory,
    Subtopic,
    Topic,
)

logger = logging.getLogger(__name__)


# Standardized codes for the 19 NEET PG subjects
SUBJECT_CODE_MAP: dict[str, str] = {
    "Anatomy": "ANAT",
    "Physiology": "PHYS",
    "Biochemistry": "BIOC",
    "Pathology": "PATH",
    "Pharmacology": "PHAR",
    "Microbiology": "MICR",
    "Forensic Medicine": "FMT",
    "Community Medicine (PSM)": "PSM",
    "Medicine": "MED",
    "Surgery": "SURG",
    "Obstetrics & Gynaecology": "OBG",
    "Pediatrics": "PED",
    "Ophthalmology": "OPHT",
    "ENT": "ENT",
    "Orthopedics": "ORTH",
    "Dermatology": "DERM",
    "Radiology": "RAD",
    "Psychiatry": "PSYC",
    "Anaesthesia": "ANAES",
}

SUBJECT_ORDER_MAP: dict[str, int] = {
    # Pre-clinical
    "Anatomy": 1,
    "Physiology": 2,
    "Biochemistry": 3,
    # Para-clinical
    "Pathology": 4,
    "Pharmacology": 5,
    "Microbiology": 6,
    "Forensic Medicine": 7,
    "Community Medicine (PSM)": 8,
    # Clinical
    "Medicine": 9,
    "Surgery": 10,
    "Obstetrics & Gynaecology": 11,
    "Pediatrics": 12,
    "Ophthalmology": 13,
    "ENT": 14,
    "Orthopedics": 15,
    "Dermatology": 16,
    "Radiology": 17,
    "Psychiatry": 18,
    "Anaesthesia": 19,
}


@dataclass
class ImportProgress:
    total_notes: int
    processed: int
    imported: int
    duplicates: int
    failed: int
    elapsed_seconds: float
    current_subject: str = ""


class BatchAPKGImporter:
    """Manages the end-to-end import lifecycle for large APKG packages."""

    def __init__(
        self,
        db: Session,
        apkg_path: str | Path,
        batch_size: int = 500,
        mapping: FieldMappingConfig | None = None,
        extract_images: bool = False,
    ):
        self.db = db
        self.apkg_path = Path(apkg_path)
        self.batch_size = batch_size
        self.mapping = mapping or FieldMappingConfig()
        self.extract_images = extract_images
        self.extractor = APKGExtractor(apkg_path, self.mapping, MEDIA_DIR)

        # In-memory caches for fast FK resolution
        self._subject_cache: dict[str, int] = {}  # name -> subject_id
        self._topic_cache: dict[tuple[int, str], int] = {}  # (subject_id, topic_name) -> topic_id
        self._subtopic_cache: dict[tuple[int, str], int] = {}  # (topic_id, subtopic_name) -> subtopic_id
        self._seen_mcq_ids: set[str] = set()
        self._mcq_id_to_qid: dict[str, int] = {}
        self._assigned_tags: set[tuple[int, str]] = set()

    def _preload_existing_metadata(self) -> None:
        """Loads existing subjects, topics, subtopics, and MCQ IDs to prevent duplicates."""
        for s in self.db.execute(select(Subject.id, Subject.name)).all():
            self._subject_cache[s[1]] = s[0]

        for t in self.db.execute(select(Topic.id, Topic.subject_id, Topic.name)).all():
            self._topic_cache[(t[1], t[2])] = t[0]

        for st in self.db.execute(select(Subtopic.id, Subtopic.topic_id, Subtopic.name)).all():
            self._subtopic_cache[(st[1], st[2])] = st[0]

        for row in self.db.execute(select(Question.id, Question.mcq_id).where(Question.mcq_id.is_not(None))).all():
            if row[1]:
                self._seen_mcq_ids.add(row[1])
                self._mcq_id_to_qid[row[1]] = row[0]

        for tag_row in self.db.execute(select(QuestionTag.question_id, QuestionTag.tag_name)).all():
            self._assigned_tags.add((tag_row[0], tag_row[1]))

    def get_or_create_subject(self, name: str, category_enum: SubjectCategory) -> int:
        if name in self._subject_cache:
            return self._subject_cache[name]

        code = SUBJECT_CODE_MAP.get(name, name[:4].upper())
        order = SUBJECT_ORDER_MAP.get(name, 99)
        subject = Subject(
            name=name,
            code=code,
            category=category_enum,
            display_order=order,
            is_active=True,
            total_questions=0,
        )
        self.db.add(subject)
        self.db.flush()
        self._subject_cache[name] = subject.id
        return subject.id

    def get_or_create_topic(self, subject_id: int, name: str) -> int:
        key = (subject_id, name)
        if key in self._topic_cache:
            return self._topic_cache[key]

        topic = Topic(
            subject_id=subject_id,
            name=name,
            is_active=True,
            total_questions=0,
        )
        self.db.add(topic)
        self.db.flush()
        self._topic_cache[key] = topic.id
        return topic.id

    def get_or_create_subtopic(self, topic_id: int, name: str) -> int:
        key = (topic_id, name)
        if key in self._subtopic_cache:
            return self._subtopic_cache[key]

        subtopic = Subtopic(
            topic_id=topic_id,
            name=name,
            is_active=True,
            total_questions=0,
        )
        self.db.add(subtopic)
        self.db.flush()
        self._subtopic_cache[key] = subtopic.id
        return subtopic.id

    def recalculate_counts(self) -> None:
        """Fast denormalized count update across subjects, topics, and subtopics."""
        # Update subtopics
        subtopic_counts = dict(
            self.db.execute(
                select(Question.subtopic_id, func.count(Question.id))
                .where(Question.subtopic_id.is_not(None), Question.is_active == True)
                .group_by(Question.subtopic_id)
            ).all()
        )
        for st_id, cnt in subtopic_counts.items():
            self.db.execute(update(Subtopic).where(Subtopic.id == st_id).values(total_questions=cnt))

        # Update topics
        topic_counts = dict(
            self.db.execute(
                select(Question.topic_id, func.count(Question.id))
                .where(Question.topic_id.is_not(None), Question.is_active == True)
                .group_by(Question.topic_id)
            ).all()
        )
        for t_id, cnt in topic_counts.items():
            self.db.execute(update(Topic).where(Topic.id == t_id).values(total_questions=cnt))

        # Update subjects
        subject_counts = dict(
            self.db.execute(
                select(Question.subject_id, func.count(Question.id))
                .where(Question.is_active == True)
                .group_by(Question.subject_id)
            ).all()
        )
        for s_id, cnt in subject_counts.items():
            self.db.execute(update(Subject).where(Subject.id == s_id).values(total_questions=cnt))

        self.db.commit()

    def run_import(
        self,
        limit: int | None = None,
        progress_callback: Any | None = None,
    ) -> ImportJob:
        start_time = time.time()
        file_size = self.apkg_path.stat().st_size
        self._preload_existing_metadata()

        # Initialize or resume ImportJob
        job = ImportJob(
            file_path=str(self.apkg_path),
            filename=self.apkg_path.name,
            file_size_bytes=file_size,
            status=ImportStatus.IMPORTING,
            field_mapping_json=json.dumps(self.mapping.__dict__),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        with zipfile.ZipFile(self.apkg_path, "r") as z:
            if self.extract_images:
                self.extractor.load_media_index(z)

            db_member = "collection.anki2" if "collection.anki2" in z.namelist() else "collection.anki21"
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_db = Path(tmp_dir) / db_member
                with z.open(db_member) as src, open(tmp_db, "wb") as dst:
                    while chunk := src.read(1024 * 1024):
                        dst.write(chunk)

                anki_conn = sqlite3.connect(tmp_db)
                try:
                    cur = anki_conn.cursor()
                    col_info = cur.execute("SELECT models, decks FROM col").fetchone()
                    models_data = json.loads(col_info[0])
                    decks_data = json.loads(col_info[1])

                    mid, mdata = list(models_data.items())[0]
                    field_names = [f["name"] for f in mdata.get("flds", [])]

                    # Read all notes with cards join
                    cur.execute("""
                        SELECT n.id, n.flds, c.did, n.tags 
                        FROM notes n 
                        JOIN cards c ON c.nid = n.id
                        ORDER BY n.id ASC
                    """)
                    all_rows = cur.fetchall()
                    if limit:
                        all_rows = all_rows[:limit]

                    total_notes = len(all_rows)
                    job.total_notes_in_source = total_notes
                    self.db.commit()

                    processed_count = 0
                    imported_count = 0
                    duplicate_count = 0
                    failed_count = 0

                    batch_questions: list[Question] = []

                    for row in all_rows:
                        nid, flds_str, did, tags_str = row
                        deck_name = decks_data.get(str(did), {}).get("name", "")
                        processed_count += 1

                        try:
                            # Parse note through extraction engine
                            eq = self.extractor.parse_note(
                                nid=nid,
                                flds_str=flds_str,
                                deck_name=deck_name,
                                field_names=field_names,
                                tags_str=tags_str or "",
                                z=z if self.extract_images else None,
                                extract_media_files=self.extract_images,
                            )

                            # Deduplication check by MCQ_ID
                            if eq.mcq_id and eq.mcq_id in self._seen_mcq_ids:
                                duplicate_count += 1
                                # If duplicate is from a PYQ deck, add tag to existing question
                                if "previous year" in deck_name.lower() or "pyq" in deck_name.lower():
                                    existing_q_id = self._mcq_id_to_qid.get(eq.mcq_id)
                                    if not existing_q_id:
                                        existing_q_id = self.db.execute(
                                            select(Question.id).where(Question.mcq_id == eq.mcq_id)
                                        ).scalar_one_or_none()
                                        if existing_q_id:
                                            self._mcq_id_to_qid[eq.mcq_id] = existing_q_id
                                    if existing_q_id and (existing_q_id, "PYQ") not in self._assigned_tags:
                                        self.db.add(QuestionTag(question_id=existing_q_id, tag_name="PYQ"))
                                        self._assigned_tags.add((existing_q_id, "PYQ"))
                                continue

                            # Resolve Category, Subject, Topic, Subtopic IDs
                            cat_enum = SUBJECT_CATEGORY_MAP.get(eq.subject, SubjectCategory.CLINICAL)
                            subject_id = self.get_or_create_subject(eq.subject, cat_enum)
                            topic_id = self.get_or_create_topic(subject_id, eq.topic)
                            subtopic_id = self.get_or_create_subtopic(topic_id, eq.subtopic)

                            # Build Question Entity
                            q_entity = Question(
                                mcq_id=eq.mcq_id,
                                text=eq.question_text,
                                html_content=eq.question_html,
                                subject_id=subject_id,
                                topic_id=topic_id,
                                subtopic_id=subtopic_id,
                                is_clinical=eq.is_clinical,
                                has_images=eq.has_images,
                                is_multiple_correct=False,
                                pyq_year=eq.pyq_year,
                                original_source_file=self.apkg_path.name,
                                original_source_nid=eq.source_nid,
                                deck_path=eq.deck_path,
                                is_active=True,
                            )

                            # Build Options
                            for opt in eq.options:
                                q_entity.options.append(
                                    QuestionOption(
                                        option_index=opt.index,
                                        option_label=opt.label,
                                        text=opt.text,
                                        html_content=opt.html_content,
                                        is_correct=opt.is_correct,
                                    )
                                )

                            # Build Explanation
                            q_entity.explanation = Explanation(
                                html_content=eq.explanation_html,
                                text=eq.explanation_text,
                                references=eq.references,
                            )

                            # Build Images
                            for img in eq.images:
                                q_entity.images.append(
                                    QuestionImage(
                                        image_type=ImageType.QUESTION if img.image_type == "question" else ImageType.EXPLANATION,
                                        filename=img.filename,
                                        url_or_path=img.extracted_path or f"/media/images/{img.filename}",
                                        original_anki_name=img.original_anki_key,
                                    )
                                )

                            # Build unique tags
                            tag_set = set(t.strip() for t in eq.tags if t.strip())
                            if "previous year" in deck_name.lower() or "pyq" in deck_name.lower():
                                tag_set.add("PYQ")
                            for tag in tag_set:
                                q_entity.tags.append(QuestionTag(tag_name=tag))

                            batch_questions.append(q_entity)
                            if eq.mcq_id:
                                self._seen_mcq_ids.add(eq.mcq_id)
                            imported_count += 1

                        except Exception as e:
                            failed_count += 1
                            self.db.add(
                                ImportError(
                                    import_job_id=job.id,
                                    source_nid=nid,
                                    error_type="PARSE_EXCEPTION",
                                    error_message=str(e),
                                )
                            )

                        # Commit batch
                        if len(batch_questions) >= self.batch_size:
                            self.db.add_all(batch_questions)
                            self.db.flush()
                            for q in batch_questions:
                                if q.mcq_id:
                                    self._mcq_id_to_qid[q.mcq_id] = q.id
                                for t in q.tags:
                                    self._assigned_tags.add((q.id, t.tag_name))

                            job.processed_records = processed_count
                            job.imported_records = imported_count
                            job.duplicate_records = duplicate_count
                            job.failed_records = failed_count
                            self.db.commit()
                            batch_questions.clear()

                            if progress_callback:
                                progress_callback(
                                    ImportProgress(
                                        total_notes=total_notes,
                                        processed=processed_count,
                                        imported=imported_count,
                                        duplicates=duplicate_count,
                                        failed=failed_count,
                                        elapsed_seconds=time.time() - start_time,
                                    )
                                )

                    # Commit remainder
                    if batch_questions:
                        self.db.add_all(batch_questions)
                        batch_questions.clear()

                    job.processed_records = processed_count
                    job.imported_records = imported_count
                    job.duplicate_records = duplicate_count
                    job.failed_records = failed_count
                    job.status = ImportStatus.COMPLETED
                    self.db.commit()

                    # Recalculate denormalized counts
                    self.recalculate_counts()

                    return job
                finally:
                    anki_conn.close()
