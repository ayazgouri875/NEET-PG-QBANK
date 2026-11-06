"""APKG Extraction Prototype and Field Mapping Subsystem.

Streaming extraction pipeline for Anki packages (.apkg). Extracts database and media
on-demand with configurable field mapping, medical HTML preservation, deck taxonomy resolution,
correct answer deduction with multi-stage fallbacks, and duplicate tracking.
"""

from dataclasses import dataclass, field
import html
import json
from pathlib import Path
import re
import sqlite3
import tempfile
from typing import Any
import zipfile

from backend.app.models.category import SubjectCategory


# Standard 19 NEET PG Subjects classification
SUBJECT_CATEGORY_MAP: dict[str, SubjectCategory] = {
    # Pre-clinical
    "Anatomy": SubjectCategory.PRE_CLINICAL,
    "Physiology": SubjectCategory.PRE_CLINICAL,
    "Biochemistry": SubjectCategory.PRE_CLINICAL,
    # Para-clinical
    "Pathology": SubjectCategory.PARA_CLINICAL,
    "Pharmacology": SubjectCategory.PARA_CLINICAL,
    "Microbiology": SubjectCategory.PARA_CLINICAL,
    "Forensic Medicine": SubjectCategory.PARA_CLINICAL,
    "Community Medicine (PSM)": SubjectCategory.PARA_CLINICAL,
    "PSM": SubjectCategory.PARA_CLINICAL,
    # Clinical
    "Medicine": SubjectCategory.CLINICAL,
    "Surgery": SubjectCategory.CLINICAL,
    "Obstetrics & Gynaecology": SubjectCategory.CLINICAL,
    "Gynaecology _ Obstetrics": SubjectCategory.CLINICAL,
    "Pediatrics": SubjectCategory.CLINICAL,
    "Ophthalmology": SubjectCategory.CLINICAL,
    "ENT": SubjectCategory.CLINICAL,
    "Orthopedics": SubjectCategory.CLINICAL,
    "Orthopaedics": SubjectCategory.CLINICAL,
    "Dermatology": SubjectCategory.CLINICAL,
    "Psychiatry": SubjectCategory.CLINICAL,
    "Anaesthesia": SubjectCategory.CLINICAL,
    "Radiology": SubjectCategory.CLINICAL,
}


@dataclass
class FieldMappingConfig:
    """Configurable field mapping rules for Anki note types."""
    question_field: str = "Question"
    mcq_id_field: str = "MCQ_ID"
    option_fields: list[str] = field(default_factory=lambda: [
        "Option1", "Option2", "Option3", "Option4",
        "Option5", "Option6", "Option7", "Option8"
    ])
    correct_option_field: str = "CorrectOption"
    correct_index_field: str = "CorrectIndex"
    explanation_field: str = "Explanation"
    references_field: str = "References"
    question_images_field: str = "QuestionImages"
    explanation_images_field: str = "ExplanationImages"


@dataclass
class ExtractedOption:
    index: int
    label: str  # A, B, C, D...
    text: str
    html_content: str
    is_correct: bool


@dataclass
class ExtractedImage:
    image_type: str  # 'question' or 'explanation'
    filename: str
    original_anki_key: str | None
    extracted_path: str | None = None


@dataclass
class ExtractedQuestion:
    source_nid: int
    mcq_id: str | None
    subject: str
    category: str
    topic: str
    subtopic: str
    deck_path: str
    question_text: str
    question_html: str
    options: list[ExtractedOption]
    correct_option_index: int
    correct_option_label: str
    explanation_text: str
    explanation_html: str
    references: str | None
    images: list[ExtractedImage]
    tags: list[str]
    is_clinical: bool
    has_images: bool
    pyq_year: int | None
    raw_fields: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_nid": self.source_nid,
            "mcq_id": self.mcq_id,
            "category": self.category,
            "subject": self.subject,
            "topic": self.topic,
            "subtopic": self.subtopic,
            "deck_path": self.deck_path,
            "question_text": self.question_text,
            "question_html": self.question_html,
            "options": [
                {
                    "index": opt.index,
                    "label": opt.label,
                    "text": opt.text,
                    "html": opt.html_content,
                    "is_correct": opt.is_correct,
                }
                for opt in self.options
            ],
            "correct_option_index": self.correct_option_index,
            "correct_option_label": self.correct_option_label,
            "explanation_text": self.explanation_text,
            "explanation_html": self.explanation_html,
            "references": self.references,
            "images": [
                {
                    "type": img.image_type,
                    "filename": img.filename,
                    "anki_key": img.original_anki_key,
                    "extracted_path": img.extracted_path,
                }
                for img in self.images
            ],
            "tags": self.tags,
            "is_clinical": self.is_clinical,
            "has_images": self.has_images,
            "pyq_year": self.pyq_year,
        }


class DeckHierarchyParser:
    """Parses Anki deck paths into Subject, Topic, and Subtopic components."""

    @staticmethod
    def clean_name(name: str) -> str:
        """Removes sorting prefixes like '01_', '008_', '__'."""
        cleaned = re.sub(r"^\d+_", "", name.strip())
        cleaned = re.sub(r"^_+", "", cleaned)
        cleaned = cleaned.replace("_", " ").strip()
        return cleaned

    @classmethod
    def parse(cls, deck_name: str) -> tuple[str, str, str, str, int | None]:
        """Returns: (category, subject, topic, subtopic, pyq_year)."""
        parts = deck_name.split("::")
        raw_subject = "General Medicine"
        raw_topic = "General"
        raw_subtopic = "General"

        if len(parts) >= 5:
            raw_subject = parts[2]
            raw_topic = parts[3]
            raw_subtopic = parts[4]
        elif len(parts) == 4:
            raw_subject = parts[2]
            raw_topic = parts[3]
        elif len(parts) == 3:
            raw_subject = parts[2]
        elif len(parts) == 2:
            raw_subject = parts[1]
        elif len(parts) == 1:
            raw_subject = parts[0]

        # Normalize subject
        subject = cls.clean_name(raw_subject)
        if "Gynaecology" in subject or "Obstetrics" in subject:
            subject = "Obstetrics & Gynaecology"
        elif subject == "PSM":
            subject = "Community Medicine (PSM)"
        elif subject == "Orthopaedics":
            subject = "Orthopedics"

        category = SUBJECT_CATEGORY_MAP.get(subject, SubjectCategory.CLINICAL).value
        topic = cls.clean_name(raw_topic)
        subtopic = cls.clean_name(raw_subtopic)

        # Detect PYQ year from deck or subtopic (e.g. 'NEET PG 2021', '2019', 'AIIMS 2018')
        pyq_match = re.search(r"(?:19|20)\d{2}", deck_name)
        pyq_year = int(pyq_match.group(0)) if pyq_match else None

        return category, subject, topic, subtopic, pyq_year


class HTMLNormalizer:
    """Sanitizes HTML while preserving medical formatting, tables, lists, and images."""

    @staticmethod
    def strip_tags(html_str: str) -> str:
        """Strips HTML tags to plain text for search and concise previews."""
        if not html_str:
            return ""
        # Replace line breaks and paragraph ends with newlines
        text = re.sub(r"</?(?:p|div|br|tr|li)[^>]*>", "\n", html_str, flags=re.I)
        text = re.sub(r"<[^>]+>", "", text)
        text = html.unescape(text)
        # Collapse excessive whitespace
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n\s*\n", "\n\n", text).strip()
        return text

    @staticmethod
    def clean_html(html_str: str) -> str:
        """Cleans Anki-specific markup while keeping all medical formatting intact."""
        if not html_str:
            return ""
        s = html_str
        # Strip Anki custom dictionary / popup spans: <span class="customMeta"...>...</span> -> inner content
        s = re.sub(r'<span[^>]*class=["\']customMeta["\'][^>]*>(.*?)</span>', r"\1", s, flags=re.I | re.DOTALL)
        # Unescape escaped HTML entities like &lt; and &gt; if they form tags
        s = s.replace("&amp;gt;", ">").replace("&amp;lt;", "<")
        # Strip empty paragraphs: <p></p> or <p>&nbsp;</p>
        s = re.sub(r"<p>\s*(?:&nbsp;|\xa0)?\s*</p>", "", s, flags=re.I)
        return s.strip()

    @staticmethod
    def extract_image_references(html_str: str) -> list[str]:
        """Finds all src attributes in <img> tags."""
        if not html_str:
            return []
        return re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html_str, flags=re.I)


class APKGExtractor:
    """Streaming extraction and parsing engine for APKG collections."""

    def __init__(
        self,
        apkg_path: str | Path,
        mapping: FieldMappingConfig | None = None,
        media_output_dir: str | Path = "data/extracted_media",
    ):
        self.apkg_path = Path(apkg_path)
        self.mapping = mapping or FieldMappingConfig()
        self.media_output_dir = Path(media_output_dir)
        self.media_output_dir.mkdir(parents=True, exist_ok=True)
        self._reverse_media_map: dict[str, str] = {}  # filename -> zip archive member key (e.g. 'xyz.jpg' -> '0')

    def load_media_index(self, z: zipfile.ZipFile) -> dict[str, str]:
        """Loads and returns {filename: zip_key} reverse mapping."""
        if "media" not in z.namelist():
            return {}
        with z.open("media") as mf:
            forward_map: dict[str, str] = json.load(mf)
        # Invert: 'd8bb...jpg' -> '0'
        self._reverse_media_map = {fname: key for key, fname in forward_map.items()}
        return self._reverse_media_map

    def extract_image_by_filename(self, z: zipfile.ZipFile, filename: str) -> str | None:
        """Stream-extracts a specific image file from the archive to media_output_dir."""
        zip_key = self._reverse_media_map.get(filename)
        if not zip_key:
            return None
        target_path = self.media_output_dir / filename
        if not target_path.exists():
            try:
                with z.open(zip_key) as src, open(target_path, "wb") as dst:
                    while chunk := src.read(256 * 1024):
                        dst.write(chunk)
            except Exception:
                return None
        return str(target_path)

    def parse_note(
        self,
        nid: int,
        flds_str: str,
        deck_name: str,
        field_names: list[str],
        tags_str: str = "",
        z: zipfile.ZipFile | None = None,
        extract_media_files: bool = False,
    ) -> ExtractedQuestion:
        fld_values = flds_str.split("\x1f")
        raw_fields = dict(zip(field_names, fld_values))

        # 1. Deck Hierarchy
        category, subject, topic, subtopic, pyq_year = DeckHierarchyParser.parse(deck_name)

        # 2. Question Text and HTML
        q_raw = raw_fields.get(self.mapping.question_field, "")
        q_html = HTMLNormalizer.clean_html(q_raw)
        q_text = HTMLNormalizer.strip_tags(q_raw)

        # 3. External MCQ ID
        mcq_id = raw_fields.get(self.mapping.mcq_id_field, "").strip() or None

        # 4. Parse Options
        options: list[ExtractedOption] = []
        option_labels = ["A", "B", "C", "D", "E", "F", "G", "H"]

        for idx, opt_field_name in enumerate(self.mapping.option_fields):
            opt_val = raw_fields.get(opt_field_name, "").strip()
            if opt_val:
                clean_opt_html = HTMLNormalizer.clean_html(opt_val)
                clean_opt_text = HTMLNormalizer.strip_tags(opt_val)
                label = option_labels[idx] if idx < len(option_labels) else f"Opt{idx+1}"
                options.append(
                    ExtractedOption(
                        index=idx,
                        label=label,
                        text=clean_opt_text,
                        html_content=clean_opt_html,
                        is_correct=False,
                    )
                )

        # 5. Resolve Correct Answer
        c_idx_str = raw_fields.get(self.mapping.correct_index_field, "").strip()
        c_opt_str = raw_fields.get(self.mapping.correct_option_field, "").strip()
        exp_raw = raw_fields.get(self.mapping.explanation_field, "")
        resolved_correct_index = -1

        # Priority A: CorrectIndex integer field
        if c_idx_str.isdigit() and 0 <= int(c_idx_str) < len(options):
            resolved_correct_index = int(c_idx_str)

        # Priority B: Match CorrectOption text/HTML with options
        if resolved_correct_index == -1 and c_opt_str:
            clean_c_opt = HTMLNormalizer.strip_tags(c_opt_str).lower().strip()
            for opt in options:
                if clean_c_opt == opt.text.lower().strip() or (clean_c_opt and clean_c_opt in opt.text.lower()):
                    resolved_correct_index = opt.index
                    break

        # Priority C: Regex pattern in Explanation text (e.g. "Correct Option [A-D]")
        if resolved_correct_index == -1 and exp_raw:
            exp_match = re.search(r"Correct Option\s+([A-D])", exp_raw, re.IGNORECASE)
            if exp_match:
                letter = exp_match.group(1).upper()
                resolved_correct_index = ord(letter) - ord("A")
            else:
                # Priority D: Fallback match in explanation keywords
                for opt in options:
                    if opt.text and len(opt.text) > 4 and opt.text.lower() in exp_raw.lower():
                        resolved_correct_index = opt.index
                        break

        # Default to 0 if completely indeterminate to prevent crash
        if resolved_correct_index == -1 or resolved_correct_index >= len(options):
            resolved_correct_index = 0

        # Mark correct option
        if 0 <= resolved_correct_index < len(options):
            options[resolved_correct_index].is_correct = True
        correct_label = options[resolved_correct_index].label if 0 <= resolved_correct_index < len(options) else "A"

        # 6. Explanation
        exp_html = HTMLNormalizer.clean_html(exp_raw)
        exp_text = HTMLNormalizer.strip_tags(exp_raw)
        references = raw_fields.get(self.mapping.references_field, "").strip() or None

        # 7. Images & Media
        images: list[ExtractedImage] = []
        q_img_refs = HTMLNormalizer.extract_image_references(q_raw)
        for img_ref in q_img_refs:
            ext_path = None
            if z and extract_media_files:
                ext_path = self.extract_image_by_filename(z, img_ref)
            images.append(
                ExtractedImage(
                    image_type="question",
                    filename=img_ref,
                    original_anki_key=self._reverse_media_map.get(img_ref),
                    extracted_path=ext_path,
                )
            )

        exp_img_refs = HTMLNormalizer.extract_image_references(exp_raw)
        for img_ref in exp_img_refs:
            ext_path = None
            if z and extract_media_files:
                ext_path = self.extract_image_by_filename(z, img_ref)
            images.append(
                ExtractedImage(
                    image_type="explanation",
                    filename=img_ref,
                    original_anki_key=self._reverse_media_map.get(img_ref),
                    extracted_path=ext_path,
                )
            )

        # 8. Tags & Clinical Indicators
        tags = [t.strip() for t in tags_str.split() if t.strip()]
        is_clinical = bool(
            re.search(r"\b(year-old|male|female|presents with|history of|diagnosed with|examination reveals)\b", q_text, re.IGNORECASE)
            or len(q_text) > 250
        )
        has_images = len(images) > 0

        return ExtractedQuestion(
            source_nid=nid,
            mcq_id=mcq_id,
            subject=subject,
            category=category,
            topic=topic,
            subtopic=subtopic,
            deck_path=deck_name,
            question_text=q_text,
            question_html=q_html,
            options=options,
            correct_option_index=resolved_correct_index,
            correct_option_label=correct_label,
            explanation_text=exp_text,
            explanation_html=exp_html,
            references=references,
            images=images,
            tags=tags,
            is_clinical=is_clinical,
            has_images=has_images,
            pyq_year=pyq_year,
            raw_fields=raw_fields,
        )

    def extract_sample_records(
        self,
        sample_count: int = 20,
        extract_images: bool = True,
    ) -> list[ExtractedQuestion]:
        """Extracts a stratified sample of questions covering Pre-clinical, Para-clinical, and Clinical subjects."""
        with zipfile.ZipFile(self.apkg_path, "r") as z:
            self.load_media_index(z)
            
            # Find DB member
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

                    # Get primary model field names
                    mid, mdata = list(models_data.items())[0]
                    field_names = [f["name"] for f in mdata.get("flds", [])]

                    # Stratified selection across subjects
                    # We select diverse questions: some with images, some clinical, some PYQs
                    cur.execute("""
                        SELECT n.id, n.flds, c.did, n.tags 
                        FROM notes n 
                        JOIN cards c ON c.nid = n.id
                    """)
                    all_rows = cur.fetchall()

                    # Pick 20 representative questions
                    selected_rows = []
                    seen_subjects = set()
                    
                    # 1. Pick 1 from each distinct subject first
                    for row in all_rows:
                        did = row[2]
                        dname = decks_data.get(str(did), {}).get("name", "")
                        _, subj, _, _, _ = DeckHierarchyParser.parse(dname)
                        if subj not in seen_subjects:
                            seen_subjects.add(subj)
                            selected_rows.append(row)
                        if len(selected_rows) >= 19:
                            break

                    # 2. Add an image-based question if count < sample_count
                    for row in all_rows:
                        if len(selected_rows) >= sample_count:
                            break
                        flds = row[1]
                        if "<img" in flds:
                            selected_rows.append(row)

                    results: list[ExtractedQuestion] = []
                    for row in selected_rows[:sample_count]:
                        nid, flds_str, did, tags_str = row
                        dname = decks_data.get(str(did), {}).get("name", "")
                        eq = self.parse_note(
                            nid=nid,
                            flds_str=flds_str,
                            deck_name=dname,
                            field_names=field_names,
                            tags_str=tags_str or "",
                            z=z,
                            extract_media_files=extract_images,
                        )
                        results.append(eq)

                    return results
                finally:
                    conn.close()

