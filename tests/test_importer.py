"""Automated test suite for APKG import, inspection, and database models."""

import os
from pathlib import Path
import unittest

from backend.app.importer.extractor import (
    APKGExtractor,
    DeckHierarchyParser,
    HTMLNormalizer,
    FieldMappingConfig,
)
from backend.app.importer.inspector import APKGInspector
from backend.app.models import (
    Base,
    Subject,
    SubjectCategory,
    Topic,
    Subtopic,
    Question,
    QuestionOption,
    DifficultyLevel,
)


class TestDeckHierarchyParser(unittest.TestCase):
    def test_standard_deck_parsing(self):
        deck = "@neet_pg_bot::PREP Medical PG Q banks::Medicine::01_Cardiology::006_Systemic HTN _ Pulmonary HTN"
        cat, subj, topic, subtopic, pyq = DeckHierarchyParser.parse(deck)
        self.assertEqual(cat, "Clinical")
        self.assertEqual(subj, "Medicine")
        self.assertEqual(topic, "Cardiology")
        self.assertEqual(subtopic, "Systemic HTN   Pulmonary HTN")
        self.assertIsNone(pyq)

    def test_pre_clinical_subject(self):
        deck = "@neet_pg_bot::PREP Medical PG Q banks::Anatomy::01_General Embryology::002_Development Period"
        cat, subj, topic, subtopic, pyq = DeckHierarchyParser.parse(deck)
        self.assertEqual(cat, "Pre-clinical")
        self.assertEqual(subj, "Anatomy")
        self.assertEqual(topic, "General Embryology")

    def test_pyq_detection(self):
        deck = "@neet_pg_bot::PREP Medical PG Q banks::Surgery::04_Breast::029_Previous Year Questions NEET PG 2020"
        cat, subj, topic, subtopic, pyq = DeckHierarchyParser.parse(deck)
        self.assertEqual(subj, "Surgery")
        self.assertEqual(pyq, 2020)


class TestHTMLNormalizer(unittest.TestCase):
    def test_strip_custom_meta(self):
        raw = '<p>Reversed by <span class="customMeta" data-dictid="1234">neostigmine</span></p>'
        cleaned = HTMLNormalizer.clean_html(raw)
        self.assertEqual(cleaned, "<p>Reversed by neostigmine</p>")

    def test_strip_tags(self):
        raw = "<p><strong>Option A:</strong> Inverted uterus</p>"
        stripped = HTMLNormalizer.strip_tags(raw)
        self.assertEqual(stripped, "Option A: Inverted uterus")

    def test_image_tag_extraction(self):
        raw = '<p>Look at this: <img src="image1.jpg"/> and <img src="image2.png"></p>'
        imgs = HTMLNormalizer.extract_image_references(raw)
        self.assertEqual(imgs, ["image1.jpg", "image2.png"])


class TestAPKGArchiveTools(unittest.TestCase):
    APKG_FILE = Path("data/imports/neet_pg.apkg")

    def setUp(self):
        if not self.APKG_FILE.exists():
            self.skipTest(f"APKG file not present at {self.APKG_FILE}")

    def test_inspector_summary(self):
        inspector = APKGInspector(self.APKG_FILE)
        res = inspector.inspect()
        self.assertEqual(res.status, "success")
        self.assertEqual(res.total_notes, 20385)
        self.assertEqual(res.total_cards, 20385)
        self.assertEqual(len(res.subject_distribution), 19)
        self.assertIn("Medicine", res.subject_distribution)

    def test_extractor_sample_generation(self):
        extractor = APKGExtractor(self.APKG_FILE, media_output_dir="data/extracted_media")
        samples = extractor.extract_sample_records(sample_count=5, extract_images=False)
        self.assertEqual(len(samples), 5)
        for s in samples:
            self.assertIsNotNone(s.subject)
            self.assertGreaterEqual(len(s.options), 4)
            self.assertTrue(any(opt.is_correct for opt in s.options))
            self.assertIsNotNone(s.question_text)


class TestDatabaseModelStructure(unittest.TestCase):
    def test_model_instantiation(self):
        s = Subject(name="Medicine", code="MED", category=SubjectCategory.CLINICAL, display_order=1)
        t = Topic(subject=s, name="Cardiology", display_order=1)
        sub = Subtopic(topic=t, name="Arrhythmias", display_order=1)
        q = Question(
            mcq_id="Q12345",
            text="Which drug is first-line?",
            html_content="<p>Which drug is first-line?</p>",
            subject=s,
            topic=t,
            subtopic=sub,
            difficulty=DifficultyLevel.MEDIUM,
        )
        opt1 = QuestionOption(question=q, option_index=0, option_label="A", text="Adenosine", html_content="<p>Adenosine</p>", is_correct=True)
        opt2 = QuestionOption(question=q, option_index=1, option_label="B", text="Verapamil", html_content="<p>Verapamil</p>", is_correct=False)

        self.assertEqual(q.subject.name, "Medicine")
        self.assertEqual(len(q.options), 2)
        self.assertTrue(q.options[0].is_correct)
        self.assertFalse(q.options[1].is_correct)


if __name__ == "__main__":
    unittest.main()
