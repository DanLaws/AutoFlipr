import httpx
from autoflipr.config import settings

_RESEND_URL = "https://api.resend.com/emails"
_FROM = "AutoFlipr <noreply@autoflipr.com>"


def _send(to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        return
    httpx.post(
        _RESEND_URL,
        headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        json={"from": _FROM, "to": [to], "subject": subject, "html": html},
        timeout=10,
    )


def send_password_reset(to_email: str, reset_url: str) -> None:
    _send(
        to=to_email,
        subject="Reset your AutoFlipr password",
        html=f"""
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f9f9f9;padding:40px 0;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e5e5">
    <div style="margin-bottom:24px">
      <span style="font-weight:800;font-size:18px;letter-spacing:-0.5px">AutoFlipr</span>
    </div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 12px">Reset your password</h1>
    <p style="color:#555;margin:0 0 24px;line-height:1.6">
      We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.
    </p>
    <a href="{reset_url}"
       style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px">
      Reset password
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#999;line-height:1.6">
      If you didn't request this, you can safely ignore this email.<br>
      This link expires in 1 hour.
    </p>
  </div>
</body>
</html>
""",
    )
