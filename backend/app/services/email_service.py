"""Transactional Email Service via Resend API (with optional SMTP fallback)."""

from datetime import datetime
import html
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import socket
import ssl

import certifi
import httpx

from backend.app.core import config

logger = logging.getLogger(__name__)


def _wrap_html_template(heading: str, subheading: str, body_html: str) -> str:
    """Shared branded HTML email layout for NEET PG Master."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }}
    .container {{ max-width: 540px; margin: 0 auto; background: #FFFFFF; border-radius: 14px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06); }}
    .header {{ background: linear-gradient(135deg, #090E1A 0%, #0F172A 100%); padding: 26px 32px; text-align: center; color: #FFFFFF; }}
    .header h2 {{ margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }}
    .header p {{ margin: 6px 0 0; font-size: 13px; color: #94A3B8; }}
    .content {{ padding: 32px; font-size: 14px; line-height: 1.65; color: #334155; }}
    .cta-wrap {{ text-align: center; margin: 28px 0; }}
    .cta-btn {{ display: inline-block; background-color: #0D9488; color: #FFFFFF !important; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; }}
    .note-box {{ background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #64748B; word-break: break-all; }}
    .footer {{ background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 16px 32px; text-align: center; font-size: 12px; color: #64748B; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🩺 {html.escape(heading)}</h2>
      <p>{html.escape(subheading)}</p>
    </div>
    <div class="content">
      {body_html}
    </div>
    <div class="footer">
      NEET PG Master • 19 Subjects &bull; 19,225 Clinical MCQs
    </div>
  </div>
</body>
</html>"""


def _dispatch_email(to_email: str, subject: str, html_content: str, text_content: str) -> tuple[bool, str | None]:
    """Dispatches an email using Resend API, or SMTP fallback if configured."""
    if config.RESEND_API_KEY:
        try:
            with httpx.Client(timeout=12.0) as client:
                resp = client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {config.RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": config.EMAIL_FROM,
                        "to": [to_email],
                        "subject": subject,
                        "html": html_content,
                        "text": text_content,
                    },
                )
            if 200 <= resp.status_code < 300:
                logger.info("Dispatched transactional email via Resend to %s", to_email)
                return True, None
            logger.error("Resend API error (%s) for recipient %s", resp.status_code, to_email)
            return False, f"Email service rejected request (HTTP {resp.status_code})."
        except Exception as exc:
            logger.error("Failed to send email via Resend to %s: %s", to_email, type(exc).__name__)
            return False, "Failed to reach transactional email service."

    if config.SMTP_USER and config.SMTP_PASSWORD:
        try:
            sender_email = config.SMTP_FROM_EMAIL or config.SMTP_USER
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{config.SMTP_FROM_NAME} <{sender_email}>"
            msg["To"] = to_email
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            # Prefer IPv4 resolution to avoid macOS/ISP IPv6 hangs on port 587
            connect_host = config.SMTP_HOST
            try:
                ipv4_info = socket.getaddrinfo(
                    config.SMTP_HOST,
                    config.SMTP_PORT,
                    socket.AF_INET,
                    socket.SOCK_STREAM,
                )
                if ipv4_info:
                    connect_host = ipv4_info[0][4][0]
            except socket.gaierror:
                connect_host = config.SMTP_HOST

            context = ssl.create_default_context(cafile=certifi.where())
            if config.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(connect_host, config.SMTP_PORT, timeout=20, context=context)
                server._host = config.SMTP_HOST
            else:
                server = smtplib.SMTP(timeout=20)
                server.connect(connect_host, config.SMTP_PORT)
                server._host = config.SMTP_HOST
                server.starttls(context=context)

            with server:
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
                server.sendmail(sender_email, [to_email], msg.as_string())

            logger.info("Dispatched transactional email via SMTP to %s", to_email)
            return True, None
        except smtplib.SMTPAuthenticationError:
            logger.error("SMTP authentication failed for %s", config.SMTP_HOST)
            return False, "Gmail SMTP authentication failed. Check SMTP_USER and your 16-character App Password."
        except ssl.SSLCertVerificationError as exc:
            detail = getattr(exc, "verify_message", "") or str(exc)
            logger.error("SMTP SSL verification failed for %s (%s): %s", config.SMTP_HOST, connect_host, detail)
            return False, f"TLS certificate verification failed for {config.SMTP_HOST}: {detail}"
        except TimeoutError:
            logger.error("SMTP connection timed out to %s:%s", config.SMTP_HOST, config.SMTP_PORT)
            return False, f"Connection timed out reaching {config.SMTP_HOST}:{config.SMTP_PORT}."
        except Exception as exc:
            logger.error("Failed to send email via SMTP to %s: %s: %s", to_email, type(exc).__name__, exc)
            return False, f"Failed to send email via SMTP ({config.SMTP_HOST}: {type(exc).__name__})."

    err_msg = (
        "Email service is not configured. Set RESEND_API_KEY and EMAIL_FROM "
        "(or SMTP_USER and SMTP_PASSWORD) in your environment."
    )
    logger.warning(err_msg)
    return False, err_msg


def send_verification_email(
    to_email: str,
    user_name: str,
    verification_url: str,
    expire_hours: int = 24,
) -> tuple[bool, str | None]:
    """Sends a branded HTML verification email with a single-use Verify Email link."""
    safe_name = html.escape(user_name or "Doctor")
    safe_url = html.escape(verification_url, quote=True)
    subject = "Verify your email address — NEET PG Master"

    body_html = f"""
      <p style="margin-top:0;">Hello <strong>{safe_name}</strong>,</p>
      <p>Thank you for creating your account on <strong>NEET PG Master</strong>. Please confirm your email address to activate your account and save your study progress.</p>
      <div class="cta-wrap">
        <a href="{safe_url}" class="cta-btn" target="_blank" rel="noopener noreferrer">Verify Email</a>
      </div>
      <p style="font-size:13px;color:#475569;">
        This single-use verification link will expire in <strong>{expire_hours} hours</strong>.
      </p>
      <div class="note-box">
        If the button above does not work, copy and paste this link into your browser:<br />
        {safe_url}
      </div>
      <p style="font-size:12px;color:#64748B;margin-bottom:0;">
        If you did not create this account, you can safely ignore this email.
      </p>
    """
    html_content = _wrap_html_template("NEET PG Master", "Email Address Verification", body_html)
    text_content = (
        f"Hello {user_name or 'Doctor'},\n\n"
        f"Verify your NEET PG Master email address by opening this single-use link (valid for {expire_hours} hours):\n"
        f"{verification_url}\n\n"
        "If you did not sign up, please ignore this email.\n"
    )
    return _dispatch_email(to_email, subject, html_content, text_content)


def send_password_reset_email(
    to_email: str,
    user_name: str,
    reset_url: str,
    expire_minutes: int = 30,
) -> tuple[bool, str | None]:
    """Sends a branded HTML password reset email with a single-use Reset Password button."""
    safe_name = html.escape(user_name or "Doctor")
    safe_url = html.escape(reset_url, quote=True)
    subject = "Reset your password — NEET PG Master"

    body_html = f"""
      <p style="margin-top:0;">Hello <strong>{safe_name}</strong>,</p>
      <p>We received a request to reset the password for your <strong>NEET PG Master</strong> account. Click the button below to choose a new password:</p>
      <div class="cta-wrap">
        <a href="{safe_url}" class="cta-btn" style="background-color:#2563EB;" target="_blank" rel="noopener noreferrer">Reset Password</a>
      </div>
      <p style="font-size:13px;color:#475569;">
        This single-use reset link expires in <strong>{expire_minutes} minutes</strong>.
      </p>
      <div class="note-box">
        If the button above does not work, copy and paste this link into your browser:<br />
        {safe_url}
      </div>
      <p style="font-size:12px;color:#64748B;margin-bottom:0;">
        If you did not request a password reset, no action is needed and your current password remains secure.
      </p>
    """
    html_content = _wrap_html_template("NEET PG Master", "Password Recovery Request", body_html)
    text_content = (
        f"Hello {user_name or 'Doctor'},\n\n"
        f"Reset your NEET PG Master password using this single-use link (expires in {expire_minutes} minutes):\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email.\n"
    )
    return _dispatch_email(to_email, subject, html_content, text_content)


def send_admin_registration_notification(
    user_name: str,
    user_email: str,
    registered_at: datetime,
) -> tuple[bool, str | None]:
    """Sends an optional registration alert to ADMIN_NOTIFICATION_EMAIL (never includes secrets)."""
    admin_email = (config.ADMIN_NOTIFICATION_EMAIL or "").strip()
    if not admin_email:
        return False, "ADMIN_NOTIFICATION_EMAIL is not configured."

    safe_name = html.escape(user_name)
    safe_email = html.escape(user_email)
    ts = registered_at.strftime("%Y-%m-%d %H:%M:%S UTC")
    subject = f"New User Registration: {user_name}"

    body_html = f"""
      <p style="margin-top:0;">A new user has registered on <strong>NEET PG Master</strong>:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
        <tr>
          <td style="padding:8px 12px;border:1px solid #E2E8F0;background:#F8FAFC;font-weight:700;">Full Name</td>
          <td style="padding:8px 12px;border:1px solid #E2E8F0;">{safe_name}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #E2E8F0;background:#F8FAFC;font-weight:700;">Email</td>
          <td style="padding:8px 12px;border:1px solid #E2E8F0;">{safe_email}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #E2E8F0;background:#F8FAFC;font-weight:700;">Registered At</td>
          <td style="padding:8px 12px;border:1px solid #E2E8F0;">{ts}</td>
        </tr>
      </table>
    """
    html_content = _wrap_html_template("NEET PG Master", "Admin Notification", body_html)
    text_content = (
        f"New user registered on NEET PG Master:\n"
        f"Name: {user_name}\n"
        f"Email: {user_email}\n"
        f"Timestamp: {ts}\n"
    )
    return _dispatch_email(admin_email, subject, html_content, text_content)


def send_otp_email(
    to_email: str,
    otp_code: str,
    user_name: str | None = None,
    purpose: str = "registration",
) -> tuple[bool, str | None]:
    """Legacy 6-digit OTP email helper via Resend or SMTP."""
    is_reset = purpose == "password_reset"
    subject = (
        f"{otp_code} is your NEET PG Master Password Reset Code"
        if is_reset
        else f"{otp_code} is your NEET PG Master Verification Code"
    )
    action_text = (
        "Please use the following One-Time Password (OTP) to reset your NEET PG Master password:"
        if is_reset
        else "Welcome to NEET PG Master. Please use the following One-Time Password (OTP) to verify your account:"
    )
    name = html.escape(user_name or "Doctor")
    body_html = f"""
      <p style="margin-top:0;">Hello <strong>{name}</strong>,</p>
      <p>{action_text}</p>
      <div style="background:#EFF6FF;border:2px dashed #2563EB;border-radius:10px;padding:18px;margin:22px 0;text-align:center;">
        <div style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#1D4ED8;">{html.escape(otp_code)}</div>
      </div>
      <p style="font-size:13px;color:#64748B;">Valid for <strong>{config.OTP_EXPIRE_MINUTES} minutes</strong>.</p>
    """
    html_content = _wrap_html_template("NEET PG Master", "One-Time Verification Code", body_html)
    text_content = f"Your NEET PG Master code is: {otp_code} (valid for {config.OTP_EXPIRE_MINUTES} minutes)."
    return _dispatch_email(to_email, subject, html_content, text_content)
