"""Integration tests for NEET PG Platform FastAPI REST endpoints."""

import unittest
from fastapi.testclient import TestClient

from backend.app.main import app


class TestBackendAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from unittest.mock import patch
        from backend.app.core.database import SessionLocal
        from backend.app.models.user import User, UserRole
        from backend.app.core.security import create_access_token
        from backend.app.core.rate_limit import auth_rate_limiter
        auth_rate_limiter.reset()

        cls.client = TestClient(app)
        cls.test_email = f"student_{cls.__name__.lower()}@neetpg.com"
        cls.test_password = "DoctorPassword123"

        login_res = cls.client.post(
            "/api/v1/auth/login",
            json={"email": cls.test_email, "password": cls.test_password},
        )
        if login_res.status_code != 200:
            captured_urls = []
            def _capture_verify(**kwargs):
                captured_urls.append(kwargs["verification_url"])
                return (True, None)

            with patch("backend.app.api.v1.auth.send_verification_email", side_effect=_capture_verify):
                cls.client.post(
                    "/api/v1/auth/register",
                    json={
                        "email": cls.test_email,
                        "password": cls.test_password,
                        "confirm_password": cls.test_password,
                        "full_name": "Dr. Aarav Sharma",
                        "target_exam_year": 2026,
                    },
                )
            if captured_urls:
                tok = captured_urls[0].split("token=")[-1]
                cls.client.get(f"/api/v1/auth/verify-email?token={tok}")
            login_res = cls.client.post(
                "/api/v1/auth/login",
                json={"email": cls.test_email, "password": cls.test_password},
            )
        cls.token = login_res.json()["access_token"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

        # Ensure an admin user exists
        cls.admin_email = f"admin_{cls.__name__.lower()}@neetpg.com"
        cls.admin_password = "AdminPassword123"

        login_admin = cls.client.post(
            "/api/v1/auth/login",
            json={"email": cls.admin_email, "password": cls.admin_password},
        )
        if login_admin.status_code != 200:
            captured_admin_urls = []
            with patch(
                "backend.app.api.v1.auth.send_verification_email",
                side_effect=lambda **kw: (captured_admin_urls.append(kw["verification_url"]) or True, None),
            ):
                cls.client.post(
                    "/api/v1/auth/register",
                    json={
                        "email": cls.admin_email,
                        "password": cls.admin_password,
                        "confirm_password": cls.admin_password,
                        "full_name": "Dr. Administrator",
                    },
                )
            if captured_admin_urls:
                tok = captured_admin_urls[0].split("token=")[-1]
                cls.client.get(f"/api/v1/auth/verify-email?token={tok}")
            login_admin = cls.client.post(
                "/api/v1/auth/login",
                json={"email": cls.admin_email, "password": cls.admin_password},
            )

        admin_user_id = login_admin.json()["user"]["id"]

        db = SessionLocal()
        u = db.query(User).filter(User.id == admin_user_id).first()
        admin_ver = 1
        if u:
            u.role = UserRole.ADMIN
            u.email_verified = True
            u.is_verified = True
            admin_ver = u.token_version
            db.commit()
        db.close()

        cls.admin_token = create_access_token(admin_user_id, role="admin", token_version=admin_ver)
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

    def test_health_check(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "healthy")

    def test_unauthenticated_and_invalid_tokens_rejected(self):
        anon_client = TestClient(app)
        # Missing token must fail closed with 401
        res_missing = anon_client.get("/api/v1/auth/me")
        self.assertEqual(res_missing.status_code, 401)

        # Garbage JWT must fail closed with 401
        res_fake = anon_client.get("/api/v1/auth/me", headers={"Authorization": "Bearer fake.jwt.token"})
        self.assertEqual(res_fake.status_code, 401)

        # Student calling admin endpoint must return 403 Forbidden
        res_forbidden = anon_client.get("/api/v1/admin/stats", headers=self.headers)
        self.assertEqual(res_forbidden.status_code, 403)

    def test_google_login_requires_verified_id_token(self):
        from unittest.mock import patch

        # Missing credential -> 400
        res_bad = self.client.post("/api/v1/auth/google", json={})
        self.assertEqual(res_bad.status_code, 400)

        # Verified Google ID token succeeds
        with patch(
            "backend.app.api.v1.auth._verify_google_id_token",
            return_value={"email": "dr.ayaz.test@gmail.com", "name": "Dr. Ayaz Test", "email_verified": "true"},
        ):
            res = self.client.post("/api/v1/auth/google", json={"credential": "mock-valid-google-id-token"})
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn("access_token", data)
            self.assertIn("refresh_token", data)
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
        # Phase 1: Verify user_progress is included on each subject
        self.assertIn("user_progress", subjects[0])
        self.assertIn("solved", subjects[0]["user_progress"])
        self.assertIn("accuracy_percentage", subjects[0]["user_progress"])

    def test_study_summary_endpoint(self):
        res = self.client.get("/api/v1/analytics/study-summary", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("daily_goal", data)
        self.assertIn("streak_days", data)
        self.assertIn("continue_from", data)
        self.assertIn("solved_today", data["daily_goal"])
        self.assertIn("target", data["daily_goal"])

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

    def test_question_filters_meta_and_multi_subject(self):
        meta_res = self.client.get("/api/v1/questions/filters-meta", headers=self.headers)
        self.assertEqual(meta_res.status_code, 200)
        self.assertIn("pyq_years", meta_res.json())

        subj_res = self.client.get("/api/v1/subjects/", headers=self.headers)
        sids = [str(s["id"]) for s in subj_res.json()[:2]]
        q_res = self.client.get(
            f"/api/v1/questions/?subject_ids={','.join(sids)}&page_size=25",
            headers=self.headers,
        )
        self.assertEqual(q_res.status_code, 200)
        q_data = q_res.json()
        self.assertLessEqual(len(q_data["items"]), 25)
        if q_data["items"]:
            self.assertIn("is_bookmarked", q_data["items"][0]["user_status"])

    def test_report_question_error(self):
        q_list = self.client.get("/api/v1/questions/?page_size=1", headers=self.headers).json()
        q_id = q_list["items"][0]["id"]
        rep_res = self.client.post(
            f"/api/v1/questions/{q_id}/report",
            headers=self.headers,
            json={"reason": "Wrong Answer Key", "details": "Test unit verification"},
        )
        self.assertEqual(rep_res.status_code, 201)
        self.assertEqual(rep_res.json()["status"], "reported")

    def test_mark_for_review_and_question_ids_drill(self):
        q_list = self.client.get("/api/v1/questions/?page_size=3", headers=self.headers).json()
        q_ids = [item["id"] for item in q_list["items"]]

        create_res = self.client.post(
            "/api/v1/tests/custom",
            headers=self.headers,
            json={
                "title": "Targeted Question IDs Drill",
                "question_ids": q_ids,
                "question_count": len(q_ids),
                "test_mode": "practice",
            },
        )
        self.assertEqual(create_res.status_code, 201)
        sid = create_res.json()["id"]
        self.assertEqual(create_res.json()["total_questions"], len(q_ids))

        mark_res = self.client.patch(
            f"/api/v1/tests/{sid}/mark/{q_ids[0]}",
            headers=self.headers,
        )
        self.assertEqual(mark_res.status_code, 200)
        self.assertTrue(mark_res.json()["marked"])

        sess_res = self.client.get(f"/api/v1/tests/{sid}", headers=self.headers)
        self.assertEqual(sess_res.status_code, 200)
        self.assertIn(q_ids[0], sess_res.json()["marked_question_ids"])
        self.assertIn("responses", sess_res.json())

        comp_res = self.client.post(f"/api/v1/tests/{sid}/complete", headers=self.headers)
        self.assertEqual(comp_res.status_code, 200)
        self.assertIn("questions", comp_res.json())
        self.assertIn("total_time_seconds", comp_res.json())

    def test_bookmark_note_and_bookmarked_custom_test(self):
        q_list = self.client.get("/api/v1/questions/?page_size=1", headers=self.headers).json()
        q_id = q_list["items"][0]["id"]

        note_res = self.client.put(
            "/api/v1/bookmarks/note",
            headers=self.headers,
            json={"question_id": q_id, "notes": "Remember triad criteria"},
        )
        self.assertEqual(note_res.status_code, 200)
        self.assertEqual(note_res.json()["notes"], "Remember triad criteria")

        bm_test = self.client.post(
            "/api/v1/tests/custom",
            headers=self.headers,
            json={
                "title": "Bookmarked Drill",
                "filter_status": "bookmarked",
                "question_count": 5,
                "test_mode": "practice",
            },
        )
        self.assertEqual(bm_test.status_code, 201)
        self.assertGreaterEqual(bm_test.json()["total_questions"], 1)

        # Clean up bookmark toggle off
        self.client.post(
            "/api/v1/bookmarks/toggle",
            headers=self.headers,
            json={"question_id": q_id},
        )

    def test_analytics_and_attempted_trends(self):
        an_res = self.client.get("/api/v1/analytics/dashboard", headers=self.headers)
        self.assertEqual(an_res.status_code, 200)
        an_data = an_res.json()
        self.assertIn("weak_topics", an_data)
        self.assertIn("daily_activity", an_data)

        att_res = self.client.get(
            "/api/v1/questions/attempted?date_from=2020-01-01&date_to=2099-12-31",
            headers=self.headers,
        )
        self.assertEqual(att_res.status_code, 200)
        self.assertIn("trend", att_res.json())

    def test_password_reset_token_flow(self):
        import uuid
        from unittest.mock import patch
        from backend.app.core.rate_limit import auth_rate_limiter

        auth_rate_limiter.reset()
        test_email = f"password_reset_{uuid.uuid4().hex[:8]}@neetpg.com"
        old_password = "OldSecurePass2026!"
        new_password = "NewSecurePass2026!"

        verify_urls = []
        with patch(
            "backend.app.api.v1.auth.send_verification_email",
            side_effect=lambda **kw: (verify_urls.append(kw["verification_url"]) or True, None),
        ):
            register_res = self.client.post(
                "/api/v1/auth/register",
                json={
                    "email": test_email,
                    "password": old_password,
                    "confirm_password": old_password,
                    "full_name": "Dr. Password Reset",
                },
            )
        self.assertEqual(register_res.status_code, 201)
        verify_token = verify_urls[0].split("token=")[-1]
        self.assertEqual(self.client.get(f"/api/v1/auth/verify-email?token={verify_token}").status_code, 200)

        reset_urls = []
        with patch(
            "backend.app.api.v1.auth.send_password_reset_email",
            side_effect=lambda **kw: (reset_urls.append(kw["reset_url"]) or True, None),
        ) as send_email:
            forgot_res = self.client.post(
                "/api/v1/auth/forgot-password",
                json={"email": test_email},
            )
        self.assertEqual(forgot_res.status_code, 200)
        self.assertEqual(forgot_res.json()["status"], "ok")
        send_email.assert_called_once()
        reset_token = reset_urls[0].split("token=")[-1]

        invalid_res = self.client.post(
            "/api/v1/auth/reset-password",
            json={
                "token": "invalid-token-123456",
                "new_password": new_password,
                "confirm_password": new_password,
            },
        )
        self.assertEqual(invalid_res.status_code, 400)

        reset_res = self.client.post(
            "/api/v1/auth/reset-password",
            json={
                "token": reset_token,
                "new_password": new_password,
                "confirm_password": new_password,
            },
        )
        self.assertEqual(reset_res.status_code, 200)

        old_login = self.client.post(
            "/api/v1/auth/login",
            json={"email": test_email, "password": old_password},
        )
        self.assertEqual(old_login.status_code, 401)
        new_login = self.client.post(
            "/api/v1/auth/login",
            json={"email": test_email, "password": new_password},
        )
        self.assertEqual(new_login.status_code, 200)

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

    def test_production_auth_lifecycle_refresh_logout_and_lockout(self):
        import uuid
        from backend.app.core.rate_limit import auth_rate_limiter
        auth_rate_limiter.reset()

        email = f"prod_auth_{uuid.uuid4().hex[:8]}@gmail.com"
        pw = "StrongPass123"

        # 1. Weak password rejected
        weak_res = self.client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "abc", "full_name": "Dr. Weak"},
        )
        self.assertEqual(weak_res.status_code, 422)

        # 2. Register creates unverified account, then verify email and sign in
        from unittest.mock import patch
        verify_urls = []
        with patch(
            "backend.app.api.v1.auth.send_verification_email",
            side_effect=lambda **kw: (verify_urls.append(kw["verification_url"]) or True, None),
        ):
            reg = self.client.post(
                "/api/v1/auth/register",
                json={
                    "email": email,
                    "password": pw,
                    "confirm_password": pw,
                    "full_name": "Dr. Production",
                    "target_exam_year": 2026,
                },
            )
        self.assertEqual(reg.status_code, 201)
        self.assertFalse(reg.json()["email_verified"])
        self.assertNotIn("access_token", reg.json())

        # Verify email token
        verify_tok = verify_urls[0].split("token=")[-1]
        self.assertEqual(self.client.get(f"/api/v1/auth/verify-email?token={verify_tok}").status_code, 200)

        first_login = self.client.post("/api/v1/auth/login", json={"email": email, "password": pw, "remember_me": True})
        self.assertEqual(first_login.status_code, 200)
        tokens = first_login.json()
        access_1 = tokens["access_token"]
        refresh_1 = tokens["refresh_token"]
        self.assertIsNotNone(refresh_1)

        # 3. Duplicate registration MUST fail with 409 Conflict (no account takeover)
        dup_res = self.client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "AttackerPass99", "full_name": "Attacker"},
        )
        self.assertEqual(dup_res.status_code, 409)

        # 4. Refresh rotation returns new pair and revokes old refresh token
        ref_res = self.client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_1})
        self.assertEqual(ref_res.status_code, 200)
        ref_data = ref_res.json()
        access_2 = ref_data["access_token"]
        refresh_2 = ref_data["refresh_token"]
        self.assertNotEqual(refresh_1, refresh_2)

        # 5. Reusing old refresh_1 triggers replay protection and revokes refresh_2 too
        replay_res = self.client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_1})
        self.assertEqual(replay_res.status_code, 401)
        revoked_after_replay = self.client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_2})
        self.assertEqual(revoked_after_replay.status_code, 401)

        # 6. Login again, update profile, change password -> old access token invalidated
        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": pw})
        self.assertEqual(login_res.status_code, 200)
        access_3 = login_res.json()["access_token"]

        upd = self.client.patch(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_3}"},
            json={"full_name": "Dr. Production Updated", "target_exam_year": 2027},
        )
        self.assertEqual(upd.status_code, 200)
        self.assertEqual(upd.json()["full_name"], "Dr. Production Updated")

        chg = self.client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {access_3}"},
            json={"current_password": pw, "new_password": "NewStrongPass456"},
        )
        self.assertEqual(chg.status_code, 200)
        access_4 = chg.json()["access_token"]
        refresh_4 = chg.json()["refresh_token"]

        # Old access_3 is invalidated due to token_version bump
        old_me = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_3}"})
        self.assertEqual(old_me.status_code, 401)

        # 7. Server-side logout immediately blacklists access_4
        out = self.client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_4}"},
            json={"refresh_token": refresh_4},
        )
        self.assertEqual(out.status_code, 200)
        after_out = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_4}"})
        self.assertEqual(after_out.status_code, 401)

        # 8. Brute-force lockout after 5 wrong password attempts
        for _ in range(5):
            r = self.client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPassword99"})
            self.assertEqual(r.status_code, 401)
        locked = self.client.post("/api/v1/auth/login", json={"email": email, "password": "NewStrongPass456"})
        self.assertEqual(locked.status_code, 429)


if __name__ == "__main__":
    unittest.main()
