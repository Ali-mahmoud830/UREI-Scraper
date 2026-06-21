import logging
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

# ─── SMTP Config (read from environment, pre-set in HF Secrets) ──────────────
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASSWORD", "")
FROM_DISPLAY = os.environ.get("MAIL_FROM_NAME", "PropPulse Elite")


def send_license_email(email_to: str, token: str, tier: str, expires_at: str) -> bool:
    """Send a professional HTML license key email via SMTP (Gmail / any provider)."""

    if not SMTP_USER or not SMTP_PASS:
        logger.warning("[MAIL] ⚠️ SMTP_USER or SMTP_PASSWORD not set — email skipped.")
        return False

    expires_date = expires_at.split("T")[0] if "T" in expires_at else expires_at

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your PropPulse License Key</title>
    <style>
        body {{ margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; }}
        .wrapper {{ padding: 40px 20px; background-color: #0d1117; }}
        .container {{ max-width: 600px; margin: 0 auto; background-color: #161b22; padding: 40px; border-radius: 16px; border: 1px solid #30363d; }}
        .logo h1 {{ color: #58a6ff; font-size: 28px; font-weight: 700; margin: 0 0 4px; text-align:center; }}
        .logo p {{ color: #8b949e; font-size: 13px; margin: 0; text-align:center; }}
        .divider {{ height: 1px; background-color: #30363d; margin: 25px 0; }}
        .message p {{ line-height: 1.7; font-size: 15px; color: #c9d1d9; margin-bottom: 16px; }}
        .token-label {{ font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; text-align: center; }}
        .token-box {{ background-color: #0d1117; border: 2px dashed #238636; padding: 24px 20px; text-align: center; margin: 20px 0 30px; border-radius: 10px; }}
        .token {{ font-family: 'Courier New', monospace; font-size: 22px; color: #3fb950; letter-spacing: 4px; font-weight: 700; word-break: break-all; }}
        .details-grid {{ background-color: #21262d; border-radius: 10px; padding: 18px 20px; margin-bottom: 25px; }}
        .detail-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #30363d; font-size: 14px; }}
        .detail-row:last-child {{ border-bottom: none; }}
        .detail-label {{ color: #8b949e; }}
        .detail-value {{ color: #c9d1d9; font-weight: 600; }}
        .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #484f58; }}
    </style>
</head>
<body>
<div class="wrapper">
    <div class="container">
        <div class="logo">
            <h1>PropPulse Elite</h1>
            <p>Global Resource Management Platform</p>
        </div>
        <div class="divider"></div>
        <div class="message">
            <p>Your license key has been successfully generated. Use the token below to unlock premium access on the PropPulse Dashboard.</p>
        </div>
        <p class="token-label">Your License Key</p>
        <div class="token-box">
            <div class="token">{token}</div>
        </div>
        <div class="details-grid">
            <div class="detail-row">
                <span class="detail-label">Subscription Tier</span>
                <span class="detail-value">{tier.replace("-", " ").title()}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Expires On</span>
                <span class="detail-value">{expires_date}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Sent To</span>
                <span class="detail-value">{email_to}</span>
            </div>
        </div>
        <p style="font-size:14px; color:#8b949e; line-height:1.6;">
            To activate your subscription, visit the PropPulse portal and enter this token on the activation page.
            Keep it safe — this key grants full access to your selected tier.
        </p>
        <div class="divider"></div>
        <div class="footer">
            <p>&copy; 2026 PropPulse Egypt — All rights reserved.</p>
            <p>If you did not request this, please ignore this email.</p>
        </div>
    </div>
</div>
</body>
</html>"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "🔑 Your PropPulse License Key"
        msg["From"] = f"{FROM_DISPLAY} <{SMTP_USER}>"
        msg["To"] = email_to
        msg.attach(MIMEText(html_content, "html"))

        context = ssl.create_default_context()
        # Added a strict timeout to prevent thread exhaustion on network block
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=5.0) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, email_to, msg.as_string())

        logger.info(f"[MAIL] ✅ Email sent to {email_to} via SMTP ({SMTP_HOST})")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error("[MAIL] ❌ SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD.")
        return False
    except Exception as e:
        logger.error(f"[MAIL] ❌ Unexpected SMTP error sending to {email_to}: {e}")
        return False


async def send_license_email_async(email_to: str, token: str, tier: str, expires_at: str) -> bool:
    """Async wrapper — runs the blocking SMTP call in a thread executor."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, send_license_email, email_to, token, tier, expires_at)
