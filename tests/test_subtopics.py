"""Unit tests for Subtopic hierarchy, progress tracking, and subtopic drill generation."""

import unittest
from fastapi.testclient import TestClient
from backend.app.main import app


class TestSubtopicHierarchy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_subject_topics_returns_subtopics_with_progress(self):
        """Verify topics include detailed subtopics with question counts and user progress."""
        res = self.client.get("/api/v1/subjects/1/topics")
        self.assertEqual(res.status_code, 200)
        topics = res.json()
        self.assertGreater(len(topics), 0)

        first_topic = topics[0]
        self.assertIn("subtopics", first_topic)
        self.assertGreater(len(first_topic["subtopics"]), 0)

        first_sub = first_topic["subtopics"][0]
        self.assertIn("id", first_sub)
        self.assertIn("name", first_sub)
        self.assertIn("total_questions", first_sub)
        self.assertIn("user_progress", first_sub)
        self.assertIn("attempted", first_sub["user_progress"])
        self.assertIn("solved", first_sub["user_progress"])
        self.assertIn("accuracy_percentage", first_sub["user_progress"])

    def test_questions_filtered_by_subtopic(self):
        """Verify questions can be filtered specifically by subtopic_id."""
        # Get a subtopic id
        topics_res = self.client.get("/api/v1/subjects/1/topics")
        sub_id = topics_res.json()[0]["subtopics"][0]["id"]

        res = self.client.get(f"/api/v1/questions/?subtopic_id={sub_id}&page_size=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["total"], 0)
        for item in data["items"]:
            self.assertEqual(item["subtopic_id"], sub_id)
            self.assertIsNotNone(item.get("subtopic_name"))

    def test_create_subtopic_drill_test_session(self):
        """Verify students can start a custom test drill targeting a specific subtopic."""
        topics_res = self.client.get("/api/v1/subjects/1/topics")
        topic = topics_res.json()[0]
        sub = topic["subtopics"][0]

        res = self.client.post("/api/v1/tests/custom", json={
            "title": f"{sub['name']} Drill Test",
            "test_type": "topic",
            "test_mode": "practice",
            "subject_ids": [topic["subject_id"]],
            "topic_ids": [topic["id"]],
            "subtopic_ids": [sub["id"]],
            "question_count": 5,
            "is_timed": False,
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertGreater(data["id"], 0)
        self.assertLessEqual(data["total_questions"], 5)


if __name__ == "__main__":
    unittest.main()

