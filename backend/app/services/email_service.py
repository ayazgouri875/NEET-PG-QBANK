"""Email Dispatch Service for Real SMTP OTP Verification."""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import ssl

from backend.app.core import config

logger = logging.getLogger(__name__)


def send_otp_email(to_email: str, otp_code: str, user_name: str | None = None) -> tuple[bool, str | None]:
    """
    Dispatches a 6-digit verification code to the user's Gmail/email address via SMTP.
    Returns (success: bool, error_message: str | None).
    """
    subject = f"{otp_code} is your NEET PG Master Verification Code"
    name = user_name or "Doctor"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }}
    .container {{ max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 14px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background: #0F172A; padding: 24px 32px; text-align: center; color: #FFFFFF; }}
    .header h2 {{ margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }}
    .content {{ padding: 32px; }}
    .otp-card {{ background: #EFF6FF; border: 2px dashed #2563EB; border-radius: 10px; padding: 18px; margin: 24px 0; text-align: center; }}
    .otp-code {{ font-family: monospace, Courier; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1D4ED8; margin: 0; }}
    .footer {{ background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 16px 32px; text-align: center; font-size: 12px; color: #64748B; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🩺 NEET PG Master</h2>
      <p style="margin: 4px 0 0; font-size: 13px; color: #94A3B8;">Medical Question Bank Verification</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Hello <strong>{name}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        Welcome to NEET PG Master. Please use the following One-Time Password (OTP) to verify your registered Gmail account:
      </p>
      <div class="otp-card">
        <div class="otp-code">{otp_code}</div>
      </div>
      <p style="font-size: 13px; color: #64748B; line-height: 1.5;">
        ⏱️ This verification code is valid for <strong>{config.OTP_EXPIRE_MINUTES} minutes</strong>. Please do not share this code with anyone.
      </p>
      <p style="font-size: 13px; color: #64748B; margin-bottom: 0;">
        If you did not initiate this registration, you can safely ignore this email.
      </p>
    </div>
    <div class="footer">
      19,225 High-Yield Medical MCQs across 19 Subjects & 283 Topics
    </div>
  </div>
</body>
</html>"""

    text_content = f"""NEET PG Master Verification Code: {otp_code}

Hello {name},
Your 6-digit verification code is: {otp_code}
Valid for {config.OTP_EXPIRE_MINUTES} minutes.
"""

    if not config.SMTP_USER or not config.SMTP_PASSWORD:
        err_msg = (
            "SMTP email server is not configured. Please set SMTP_USER and SMTP_PASSWORD "
            "in .env to deliver real emails to your Gmail inbox."
        )
        logger.warning(err_msg)
        return False, err_msg

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=12) as server:
            server.starttls(context=context)
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.sendmail(config.SMTP_FROM_EMAIL, [to_email], msg.as_string())

        logger.info("Successfully dispatched OTP email to %s via SMTP", to_email)
        print(f"✓ [SMTP] Dispatched OTP email successfully to {to_email}")
        return True, None
    except Exception as e:
        logger.error("Failed to send OTP email via SMTP to %s: %s", to_email, e)
        return False, f"Failed to send email via SMTP ({config.SMTP_HOST}): {str(e)}"
