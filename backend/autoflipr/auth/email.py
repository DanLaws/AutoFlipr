"""
Password-reset email sender.

Sends via SMTP with STARTTLS. If SMTP is not configured (smtp_enabled=False),
logs a warning and returns without raising — so the reset endpoint still
returns 200 in local dev without blowing up.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from autoflipr.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, reset_token: str) -> None:
    reset_url = f"{settings.app_base_url}/reset-password?token={reset_token}"

    if not settings.smtp_enabled:
        logger.warning(
            "SMTP not configured — skipping password reset email to %s. Reset URL: %s",
            to_email,
            reset_url,
        )
        return

    subject = "Reset your AutoFlipr password"

    text_body = f"""\
Hi,

You requested a password reset for your AutoFlipr account.

Click the link below to set a new password (valid for 1 hour):

{reset_url}

If you didn't request this, you can safely ignore this email.

— The AutoFlipr team
"""

    html_body = f"""\
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#111;">
  <h2 style="margin-bottom:8px;">Reset your password</h2>
  <p style="color:#555;margin-bottom:24px;">
    You requested a password reset for your AutoFlipr account.
    Click the button below to set a new password — the link is valid for <strong>1 hour</strong>.
  </p>
  <a href="{reset_url}"
     style="display:inline-block;padding:12px 24px;background:#111;color:#fff;
            border-radius:8px;text-decoration:none;font-weight:600;">
    Reset password
  </a>
  <p style="margin-top:24px;font-size:13px;color:#888;">
    If you didn't request this, you can safely ignore this email.<br>
    The link will expire in 1 hour.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:12px;color:#aaa;">AutoFlipr Ltd &mdash; Registered in England &amp; Wales</p>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, [to_email], msg.as_string())
        logger.info("Password reset email sent to %s", to_email)
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        raise
