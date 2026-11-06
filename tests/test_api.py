"""Integration tests for NEET PG Platform FastAPI REST endpoints."""

import unittest
from fastapi.testclient import TestClient

from backend.app.main import app


class TestBackendAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Register a test student
        cls.test_email = f"student_{cls.__name__.lower()}@neetpg.com"
        cls.test_password = "DoctorPassword123"

        reg_res = cls.client.post(
            "/api/v1/auth/register",
            json={
                "email": cls.test_email,
                "password": cls.test_password,
                "full_name": "Dr. Aarav Sharma",
                "target_exam_year": 2026,
            },
        )
        if reg_res.status_code == 201:
            cls.token = reg_res.json()["access_token"]
        else:
            # Login if already exists
            login_res = cls.client.post(
                "/api/v1/auth/login",
                json={"email": cls.test_email, "password": cls.test_password},
            )
            cls.token = login_res.json()["access_token"]

        cls.headers = {"Authorization": f"Bearer {cls.token}"}

        # Register an admin user
        cls.admin_email = f"admin_{cls.__name__.lower()}@neetpg.com"
        cls.admin_password = "AdminPassword123"

        reg_admin = cls.client.post(
            "/api/v1/auth/register",
            json={
                "email": cls.admin_email,
                "password": cls.admin_password,
                "full_name": "Dr. Administrator",
            },
        )
        if reg_admin.status_code == 201:
            admin_user_id = reg_admin.json()["user"]["id"]
        else:
            login_admin = cls.client.post(
                "/api/v1/auth/login",
                json={"email": cls.admin_email, "password": cls.admin_password},
            )
            admin_user_id = login_admin.json()["user"]["id"]

        # Elevate to ADMIN role in database
        from backend.app.core.database import SessionLocal
        from backend.app.models.user import User, UserRole
        from backend.app.core.security import create_access_token
        db = SessionLocal()
        u = db.query(User).filter(User.id == admin_user_id).first()
        if u:
            u.role = UserRole.ADMIN
            db.commit()
        db.close()

        cls.admin_token = create_access_token(admin_user_id, role="admin")
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

    def test_health_check(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "healthy")

    def test_google_login_auto_provisions_and_authenticates(self):
        res = self.client.post("/api/v1/auth/google", json={
            "email": "dr.ayaz.test@gmail.com",
            "full_name": "Dr. Ayaz Test",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["user"]["email"], "dr.ayaz.test@gmail.com")
        self.assertEqual(data["user"]["full_name"], "Dr. Ayaz Test")

    def test_get_current_user_profile(self):
        res = self.client.get("/api/v1/auth/me", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["email"], self.test_email)
        self.assertEqual(data["full_name"], "Dr. Aarav Sharma")

    def test_list_subjects(self):
        res = self.client.get("/api/v1/subjects/", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        subjects = res.json()
        self.assertEqual(len(subjects), 19)
        subject_names = [s["name"] for s in subjects]
        self.assertIn("Medicine", subject_names)
        self.assertIn("Surgery", subject_names)
        self.assertIn("Anatomy", subject_names)
        self.assertIn("Pathology", subject_names)

    def test_search_questions_paginated(self):
        res = self.client.get("/api/v1/questions/?page=1&page_size=10", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["total"], 19000)
        self.assertEqual(len(data["items"]), 10)
        first_q = data["items"][0]
        self.assertIn("options", first_q)
        self.assertEqual(len(first_q["options"]), 4)

    def test_question_detail_with_explanation(self):
        # Get first question ID
        q_list = self.client.get("/api/v1/questions/?page_size=1", headers=self.headers).json()
        q_id = q_list["items"][0]["id"]

        res = self.client.get(f"/api/v1/questions/{q_id}", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["id"], q_id)
        self.assertIsNotNone(data["explanation"])
        self.assertIn("text", data["explanation"])

    def test_create_and_solve_custom_test(self):
        # 1. Create a 5-question practice test
        create_res = self.client.post(
            "/api/v1/tests/custom",
            headers=self.headers,
            json={
                "title": "Anaesthesia Practice",
                "question_count": 5,
                "test_mode": "practice",
            },
        )
        self.assertEqual(create_res.status_code, 201)
        session = create_res.json()
        session_id = session["id"]
        self.assertEqual(session["total_questions"], 5)

        # 2. Get session questions
        get_res = self.client.get(f"/api/v1/tests/{session_id}", headers=self.headers)
        self.assertEqual(get_res.status_code, 200)
        sess_data = get_res.json()
        self.assertEqual(len(sess_data["questions"]), 5)
        first_q = sess_data["questions"][0]

        # 3. Submit an answer (practice mode should return explanation immediately)
        ans_res = self.client.post(
            f"/api/v1/tests/{session_id}/answer",
            headers=self.headers,
            json={
                "question_id": first_q["id"],
                "selected_option_index": 0,
                "time_spent_seconds": 25,
            },
        )
        self.assertEqual(ans_res.status_code, 200)
        ans_data = ans_res.json()
        self.assertIn("is_correct", ans_data)
        self.assertIn("correct_option_index", ans_data)
        self.assertIsNotNone(ans_data["explanation"])

        # 4. Complete the test session
        comp_res = self.client.post(f"/api/v1/tests/{session_id}/complete", headers=self.headers)
        self.assertEqual(comp_res.status_code, 200)
        comp_data = comp_res.json()
        self.assertEqual(comp_data["status"], "completed")
        self.assertIn("accuracy_percentage", comp_data)

    def test_bookmark_question(self):
        # Get a question ID
        q_list = self.client.get("/api/v1/questions/?page_size=1", headers=self.headers).json()
        q_id = q_list["items"][0]["id"]

        # Toggle bookmark ON
        bm_res = self.client.post(
            "/api/v1/bookmarks/toggle",
            headers=self.headers,
            json={"question_id": q_id, "notes": "High-yield revision concept"},
        )
        self.assertEqual(bm_res.status_code, 200)
        self.assertTrue(bm_res.json()["bookmarked"])

        # Check in bookmark list
        list_res = self.client.get("/api/v1/bookmarks/", headers=self.headers)
        self.assertEqual(list_res.status_code, 200)
        bms = list_res.json()
        bm_q_ids = [b["question_id"] for b in bms]
        self.assertIn(q_id, bm_q_ids)

        # Toggle bookmark OFF
        unbm_res = self.client.post(
            "/api/v1/bookmarks/toggle",
            headers=self.headers,
            json={"question_id": q_id},
        )
        self.assertFalse(unbm_res.json()["bookmarked"])

    def test_analytics_dashboard(self):
        res = self.client.get("/api/v1/analytics/dashboard", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_attempted", data)
        self.assertIn("overall_accuracy", data)
        self.assertIn("subject_breakdown", data)

    def test_admin_system_stats(self):
        res = self.client.get("/api/v1/admin/stats", headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["total_questions"], 19000)
        self.assertEqual(data["total_subjects"], 19)
        self.assertIn("subject_breakdown", data)

    def test_admin_integrity_audit(self):
        res = self.client.get("/api/v1/admin/analytics/integrity", headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["missing_explanations"], 0)
        self.assertEqual(data["missing_correct_answers"], 0)
        self.assertEqual(data["data_quality_score"], 100.0)

    def test_admin_update_question_and_options(self):
        # 1. Update question metadata
        q_list = self.client.get("/api/v1/questions/?page_size=1", headers=self.headers).json()
        q_id = q_list["items"][0]["id"]

        upd_res = self.client.put(
            f"/api/v1/admin/questions/{q_id}",
            headers=self.admin_headers,
            json={"pyq_year": 2022, "is_clinical": True},
        )
        self.assertEqual(upd_res.status_code, 200)

        # 2. Update explanation
        exp_res = self.client.put(
            f"/api/v1/admin/questions/{q_id}/explanation",
            headers=self.admin_headers,
            json={
                "text": "Updated high-yield medical explanation.",
                "html_content": "<p>Updated high-yield medical explanation.</p>",
                "references": "Harrison 21st Edition, p. 1200",
            },
        )
        self.assertEqual(exp_res.status_code, 200)

        # Verify
        detail = self.client.get(f"/api/v1/questions/{q_id}", headers=self.headers).json()
        self.assertEqual(detail["pyq_year"], 2022)
        self.assertTrue(detail["is_clinical"])
        self.assertEqual(detail["explanation"]["references"], "Harrison 21st Edition, p. 1200")

    def test_direct_solve_and_attempted_questions(self):
        # 1. Fetch a question
        q_list = self.client.get("/api/v1/questions/?page_size=1", headers=self.headers).json()
        q_id = q_list["items"][0]["id"]

        # 2. Directly solve question (LeetCode-style)
        solve_res = self.client.post(
            f"/api/v1/questions/{q_id}/solve",
            headers=self.headers,
            json={"selected_option_index": 0, "time_spent_seconds": 12},
        )
        self.assertEqual(solve_res.status_code, 200)
        solve_data = solve_res.json()
        self.assertEqual(solve_data["question_id"], q_id)
        self.assertIn("is_correct", solve_data)
        self.assertIn("correct_option_index", solve_data)

        # 3. Retrieve attempted questions
        att_res = self.client.get("/api/v1/questions/attempted", headers=self.headers)
        self.assertEqual(att_res.status_code, 200)
        att_data = att_res.json()
        self.assertGreaterEqual(att_data["total"], 1)
        self.assertGreaterEqual(att_data["stats"]["total_attempted"], 1)
        self.assertIn("items", att_data)

        # Verify our solved question appears in attempted items
        att_q_ids = [item["question_id"] for item in att_data["items"]]
        self.assertIn(q_id, att_q_ids)

        # 4. Verify search_questions returns user_status
        search_res = self.client.get(f"/api/v1/questions/?q=&page_size=20", headers=self.headers)
        self.assertEqual(search_res.status_code, 200)
        items = search_res.json()["items"]
        matching_q = next((item for item in items if item["id"] == q_id), None)
        if matching_q:
            self.assertIsNotNone(matching_q["user_status"])
            self.assertTrue(matching_q["user_status"]["is_attempted"])

    def test_registration_otp_flow_and_login(self):
        import uuid
        from unittest.mock import patch
        from backend.app.core.database import SessionLocal
        from backend.app.models.user import EmailOTP

        test_email = f"test_otp_{uuid.uuid4().hex[:8]}@gmail.com"
        test_pass = "SecurePass2026!"

        # 1. Request OTP for registration (with mocked email send)
        with patch("backend.app.api.v1.auth.send_otp_email", return_value=(True, None)):
            otp_req = self.client.post(
                "/api/v1/auth/register-otp",
                json={
                    "email": test_email,
                    "password": test_pass,
                    "full_name": "Dr. OTP Aspirant",
                    "target_exam_year": 2026,
                },
            )
        self.assertEqual(otp_req.status_code, 200)
        otp_data = otp_req.json()
        self.assertEqual(otp_data["status"], "otp_sent")
        self.assertEqual(otp_data["email"], test_email)
        self.assertNotIn("dev_otp", otp_data)

        # Retrieve OTP directly from database (not from response)
        db = SessionLocal()
        otp_record = db.query(EmailOTP).filter(EmailOTP.email == test_email).order_by(EmailOTP.id.desc()).first()
        self.assertIsNotNone(otp_record)
        real_otp = otp_record.otp_code
        db.close()
        self.assertEqual(len(real_otp), 6)

        # 2. Try wrong OTP code
        wrong_res = self.client.post(
            "/api/v1/auth/verify-otp",
            json={"email": test_email, "otp_code": "000000"},
        )
        self.assertEqual(wrong_res.status_code, 400)

        # 3. Verify with correct OTP
        verify_res = self.client.post(
            "/api/v1/auth/verify-otp",
            json={"email": test_email, "otp_code": real_otp},
        )
        self.assertEqual(verify_res.status_code, 200)
        verify_data = verify_res.json()
        self.assertIn("access_token", verify_data)
        self.assertEqual(verify_data["user"]["email"], test_email)

        # 4. Login with registered email and password
        login_res = self.client.post(
            "/api/v1/auth/login",
            json={"email": test_email, "password": test_pass},
        )
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.json()
        self.assertIn("access_token", login_data)
        self.assertEqual(login_data["user"]["email"], test_email)

        # 5. Login with invalid password fails
        bad_pass_res = self.client.post(
            "/api/v1/auth/login",
            json={"email": test_email, "password": "WrongPassword!"},
        )
        self.assertEqual(bad_pass_res.status_code, 401)


if __name__ == "__main__":
    unittest.main()

