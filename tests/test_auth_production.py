"""Comprehensive production authentication test suite covering all security requirements."""

from datetime import datetime, timedelta, timezone
import unittest
from unittest.mock import patch
import uuid

from fastapi.testclient import TestClient

from backend.app.core import config
from backend.app.core.database import SessionLocal
from backend.app.core.rate_limit import auth_rate_limiter
from backend.app.core.security import create_access_token, hash_token
from backend.app.main import app
from backend.app.models.user import (
    EmailVerificationToken,
    PasswordResetToken,
    User,
)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TestProductionAuth(unittest.TestCase):
    def setUp(self) -> None:
        auth_rate_limiter.reset()
        self.client = TestClient(app)

    def _register_and_capture(
        self,
        email: str,
        password: str = "DoctorStrong2026",
        full_name: str = "Dr. Auth Tester",
        confirm_password: str | None = None,
    ) -> tuple:
        captured_urls: list[str] = []
        with patch(
            "backend.app.api.v1.auth.send_verification_email",
            side_effect=lambda **kw: (captured_urls.append(kw["verification_url"]) or True, None),
        ):
            res = self.client.post(
                "/api/v1/auth/register",
                json={
                    "email": email,
                    "password": password,
                    "confirm_password": confirm_password if confirm_password is not None else password,
                    "full_name": full_name,
                    "target_exam_year": 2026,
                },
            )
        token = captured_urls[0].split("token=")[-1] if captured_urls else ""
        return res, token

    # ------------------------------------------------------------------
    # 1. REGISTRATION TESTS
    # ------------------------------------------------------------------
    def test_registration_validation_and_argon2id_hashing(self):
        email = f"reg_{uuid.uuid4().hex[:8]}@neetpg.com"

        # Invalid email
        bad_email = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "DoctorStrong2026",
                "confirm_password": "DoctorStrong2026",
                "full_name": "Dr. Invalid",
            },
        )
        self.assertEqual(bad_email.status_code, 422)

        # Weak password (too short)
        weak_short = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "Ab1",
                "confirm_password": "Ab1",
                "full_name": "Dr. Weak",
            },
        )
        self.assertEqual(weak_short.status_code, 422)

        # Weak password (no uppercase / no number)
        weak_no_num = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "lowercaseonlypassword",
                "confirm_password": "lowercaseonlypassword",
                "full_name": "Dr. Weak",
            },
        )
        self.assertEqual(weak_no_num.status_code, 400)

        # Password mismatch
        mismatch = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "DoctorStrong2026",
                "confirm_password": "DifferentStrong2026",
                "full_name": "Dr. Mismatch",
            },
        )
        self.assertEqual(mismatch.status_code, 400)

        # Valid registration + admin notification
        admin_notified = []
        with (
            patch.object(config, "ADMIN_NOTIFICATION_EMAIL", "admin-alerts@neetpg.com"),
            patch(
                "backend.app.api.v1.auth.send_admin_registration_notification",
                side_effect=lambda **kw: (admin_notified.append(kw) or True, None),
            ),
        ):
            reg_res, raw_token = self._register_and_capture(email, full_name="Dr. Valid Aspirant")

        self.assertEqual(reg_res.status_code, 201)
        data = reg_res.json()
        self.assertEqual(data["status"], "verification_required")
        self.assertFalse(data["email_verified"])
        self.assertNotIn("access_token", data)
        self.assertTrue(len(raw_token) >= 20)

        # Verify Admin Notification payload has zero sensitive secrets
        self.assertEqual(len(admin_notified), 1)
        self.assertEqual(admin_notified[0]["user_email"], email)
        self.assertEqual(admin_notified[0]["user_name"], "Dr. Valid Aspirant")
        self.assertNotIn("password", admin_notified[0])

        # Verify DB stores Argon2id hash, email_verified=False, and SHA-256 token hash (never raw)
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        self.assertIsNotNone(user)
        self.assertTrue(user.password_hash.startswith("$argon2id$"))
        self.assertFalse(user.email_verified)
        vt = db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).first()
        self.assertIsNotNone(vt)
        self.assertNotEqual(vt.token_hash, raw_token)
        self.assertEqual(vt.token_hash, hash_token(raw_token))
        db.close()

        # Duplicate email rejected cleanly with 409 Conflict
        dup_res, _ = self._register_and_capture(email, password="OtherStrong2026")
        self.assertEqual(dup_res.status_code, 409)

    def test_registration_rolls_back_if_email_delivery_fails(self):
        email = f"fail_mail_{uuid.uuid4().hex[:8]}@neetpg.com"
        with patch("backend.app.api.v1.auth.send_verification_email", return_value=(False, "SMTP unavailable")):
            res = self.client.post(
                "/api/v1/auth/register",
                json={
                    "email": email,
                    "password": "DoctorStrong2026",
                    "confirm_password": "DoctorStrong2026",
                    "full_name": "Dr. Fail Email",
                },
            )
        self.assertEqual(res.status_code, 503)
        db = SessionLocal()
        self.assertIsNone(db.query(User).filter(User.email == email).first())
        db.close()

    # ------------------------------------------------------------------
    # 2. EMAIL VERIFICATION TESTS
    # ------------------------------------------------------------------
    def test_email_verification_valid_invalid_expired_reuse_and_resend(self):
        email = f"verify_{uuid.uuid4().hex[:8]}@neetpg.com"
        reg_res, raw_token = self._register_and_capture(email)
        self.assertEqual(reg_res.status_code, 201)

        # Invalid token rejected
        bad = self.client.get("/api/v1/auth/verify-email?token=totally-invalid-token-123")
        self.assertEqual(bad.status_code, 400)

        # Expire token manually in DB -> rejected cleanly
        db = SessionLocal()
        vt = db.query(EmailVerificationToken).filter(EmailVerificationToken.token_hash == hash_token(raw_token)).first()
        vt.expires_at = _now_utc() - timedelta(minutes=5)
        db.commit()
        db.close()

        expired = self.client.get(f"/api/v1/auth/verify-email?token={raw_token}")
        self.assertEqual(expired.status_code, 400)

        # Resend verification issues a fresh token and invalidates prior token
        new_urls: list[str] = []
        with patch(
            "backend.app.api.v1.auth.send_verification_email",
            side_effect=lambda **kw: (new_urls.append(kw["verification_url"]) or True, None),
        ):
            resend_res = self.client.post("/api/v1/auth/resend-verification", json={"email": email})
        self.assertEqual(resend_res.status_code, 200)
        new_token = new_urls[0].split("token=")[-1]
        self.assertNotEqual(new_token, raw_token)

        # Valid new token verifies user
        ok = self.client.get(f"/api/v1/auth/verify-email?token={new_token}")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["status"], "verified")

        # Reusing the same token MUST fail (single-use)
        reuse = self.client.get(f"/api/v1/auth/verify-email?token={new_token}")
        self.assertEqual(reuse.status_code, 400)

    # ------------------------------------------------------------------
    # 3. LOGIN, COOKIES, CSRF & LOCKOUT TESTS
    # ------------------------------------------------------------------
    def test_login_unverified_inactive_cookies_csrf_and_lockout(self):
        email = f"login_{uuid.uuid4().hex[:8]}@neetpg.com"
        password = "DoctorStrong2026"
        reg_res, raw_token = self._register_and_capture(email, password=password)
        self.assertEqual(reg_res.status_code, 201)

        # Unverified account blocked from logging in
        unverified_login = self.client.post("/api/v1/auth/login", json={"email": email, "password": password})
        self.assertEqual(unverified_login.status_code, 403)

        # Unverified user token (even if minted) blocked on protected endpoints
        db = SessionLocal()
        user_id = db.query(User).filter(User.email == email).first().id
        db.close()
        minted = create_access_token(user_id, role="student")
        self.assertEqual(
            self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {minted}"}).status_code,
            403,
        )

        # Verify email -> login succeeds and sets HttpOnly cookies + csrf_token
        self.assertEqual(self.client.get(f"/api/v1/auth/verify-email?token={raw_token}").status_code, 200)
        ok_login = self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password, "remember_me": True},
        )
        self.assertEqual(ok_login.status_code, 200)
        self.assertIn("access_token", ok_login.cookies)
        self.assertIn("refresh_token", ok_login.cookies)
        self.assertIn("csrf_token", ok_login.cookies)

        # Cookie-authenticated GET works cleanly
        cookie_client = TestClient(app)
        cookie_client.cookies.update(ok_login.cookies)
        me_res = cookie_client.get("/api/v1/auth/me")
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["email"], email)

        # Cookie-authenticated state-changing PATCH WITHOUT CSRF header MUST fail with 403
        no_csrf = cookie_client.patch("/api/v1/auth/me", json={"full_name": "Should Fail"})
        self.assertEqual(no_csrf.status_code, 403)

        # Cookie-authenticated PATCH WITH matching X-CSRF-Token succeeds
        with_csrf = cookie_client.patch(
            "/api/v1/auth/me",
            headers={"X-CSRF-Token": ok_login.cookies.get("csrf_token")},
            json={"full_name": "Dr. Cookie Verified"},
        )
        self.assertEqual(with_csrf.status_code, 200)
        self.assertEqual(with_csrf.json()["full_name"], "Dr. Cookie Verified")

        # Refresh via cookie + CSRF header works
        refresh_cookie_res = cookie_client.post(
            "/api/v1/auth/refresh",
            headers={"X-CSRF-Token": ok_login.cookies.get("csrf_token")},
        )
        self.assertEqual(refresh_cookie_res.status_code, 200)
        refreshed_access = refresh_cookie_res.json()["access_token"]

        # Logout invalidates active access & refresh tokens and clears cookies
        logout_res = cookie_client.post("/api/v1/auth/logout", json={})
        self.assertEqual(logout_res.status_code, 200)
        self.assertEqual(cookie_client.get("/api/v1/auth/me").status_code, 401)
        self.assertEqual(
            TestClient(app).get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refreshed_access}"}).status_code,
            401,
        )

        # Incorrect password returns generic 401 and locks after 5 attempts
        for _ in range(5):
            bad = self.client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPassword1"})
            self.assertEqual(bad.status_code, 401)
            self.assertEqual(bad.json()["detail"], "Invalid email or password.")
        locked = self.client.post("/api/v1/auth/login", json={"email": email, "password": password})
        self.assertEqual(locked.status_code, 429)

        # Inactive user blocked
        db = SessionLocal()
        u = db.query(User).filter(User.email == email).first()
        u.locked_until = None
        u.failed_login_attempts = 0
        u.is_active = False
        db.commit()
        db.close()
        inactive = self.client.post("/api/v1/auth/login", json={"email": email, "password": password})
        self.assertEqual(inactive.status_code, 403)

    # ------------------------------------------------------------------
    # 4. FORGOT PASSWORD & RESET PASSWORD TESTS
    # ------------------------------------------------------------------
    def test_forgot_and_reset_password_full_workflow(self):
        email = f"forgot_{uuid.uuid4().hex[:8]}@neetpg.com"
        old_pw = "OldDoctorPass2026"
        new_pw = "NewDoctorPass2026"

        _, verify_tok = self._register_and_capture(email, password=old_pw)
        self.client.get(f"/api/v1/auth/verify-email?token={verify_tok}")

        login_res = self.client.post("/api/v1/auth/login", json={"email": email, "password": old_pw})
        old_access = login_res.json()["access_token"]

        # Unknown email returns identical generic 200 response (no enumeration)
        unknown_res = self.client.post("/api/v1/auth/forgot-password", json={"email": "nobody_here@neetpg.com"})
        self.assertEqual(unknown_res.status_code, 200)

        # Valid email dispatches reset link
        reset_urls: list[str] = []
        with patch(
            "backend.app.api.v1.auth.send_password_reset_email",
            side_effect=lambda **kw: (reset_urls.append(kw["reset_url"]) or True, None),
        ):
            forgot_res = self.client.post("/api/v1/auth/forgot-password", json={"email": email})
        self.assertEqual(forgot_res.status_code, 200)
        self.assertEqual(forgot_res.json()["message"], unknown_res.json()["message"])
        reset_tok = reset_urls[0].split("token=")[-1]

        # DB stores only hashed reset token
        db = SessionLocal()
        rt_row = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == hash_token(reset_tok)).first()
        self.assertIsNotNone(rt_row)
        self.assertNotEqual(rt_row.token_hash, reset_tok)

        # Expired token fails
        rt_row.expires_at = _now_utc() - timedelta(minutes=1)
        db.commit()
        expired_reset = self.client.post(
            "/api/v1/auth/reset-password",
            json={"token": reset_tok, "new_password": new_pw, "confirm_password": new_pw},
        )
        self.assertEqual(expired_reset.status_code, 400)

        # Restore valid expiry & test password mismatch
        rt_row.expires_at = _now_utc() + timedelta(minutes=20)
        db.commit()
        db.close()

        mismatch_reset = self.client.post(
            "/api/v1/auth/reset-password",
            json={"token": reset_tok, "new_password": new_pw, "confirm_password": "Mismatch2026"},
        )
        self.assertEqual(mismatch_reset.status_code, 400)

        # Successful password reset invalidates prior sessions
        ok_reset = self.client.post(
            "/api/v1/auth/reset-password",
            json={"token": reset_tok, "new_password": new_pw, "confirm_password": new_pw},
        )
        self.assertEqual(ok_reset.status_code, 200)

        # Reused reset token fails
        reused = self.client.post(
            "/api/v1/auth/reset-password",
            json={"token": reset_tok, "new_password": "AnotherPass2026", "confirm_password": "AnotherPass2026"},
        )
        self.assertEqual(reused.status_code, 400)

        # Prior active session invalidated
        self.assertEqual(
            self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_access}"}).status_code,
            401,
        )

        # Login with old password fails; new password succeeds
        self.assertEqual(self.client.post("/api/v1/auth/login", json={"email": email, "password": old_pw}).status_code, 401)
        self.assertEqual(self.client.post("/api/v1/auth/login", json={"email": email, "password": new_pw}).status_code, 200)

    # ------------------------------------------------------------------
    # 5. PROTECTED ROUTES, SESSION EXPIRY & CORS TESTS
    # ------------------------------------------------------------------
    def test_protected_routes_expired_token_and_cors(self):
        # Unauthenticated requests fail closed
        for path in ("/api/v1/auth/me", "/api/v1/questions/", "/api/v1/subjects/1/topics"):
            self.assertEqual(self.client.get(path).status_code, 401)

        # Expired access token rejected
        expired_jwt = create_access_token(1, role="student", expires_delta=timedelta(seconds=-10))
        self.assertEqual(
            self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_jwt}"}).status_code,
            401,
        )

        # Trusted origin allowed with credentials; untrusted origin denied
        trusted = self.client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        self.assertEqual(trusted.headers.get("access-control-allow-origin"), "http://localhost:3000")
        self.assertEqual(trusted.headers.get("access-control-allow-credentials"), "true")

        untrusted = self.client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "https://untrusted-evil.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        self.assertIsNone(untrusted.headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()
