// api/notify-error.js
// Triggered by a Postgres webhook on INSERT into error_log (same pattern as
// the new-signup notification trigger). Sends Brandon an immediate alert.
//
// NOTE: this fires per-error with no throttling. If a bug causes repeated
// failures (e.g. a broken API key), this could send many emails in a short
// window. Worth adding rate-limiting later if that becomes a problem.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass Alerts <notifications@yourpetpass.com>';
const ADMIN_EMAIL = 'bgravley@rdmarketingllc.com';
const WEBHOOK_SECRET = process.env.SIGNUP_WEBHOOK_SECRET;

function esc(str) {
  if (!str) return str;
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).end();

  const record = req.body?.record || {};
  const { context, error_message, user_email } = record;

  try {
    const html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#FAF6F0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;">
    <div style="background:#C4714A;padding:18px 24px;">
      <div style="color:#fff;font-weight:700;font-size:16px;">⚠️ New Error Logged</div>
    </div>
    <div style="padding:20px 24px;color:#5A4535;font-size:14px;line-height:1.6;">
      <p><strong>Context:</strong> ${esc(context) || 'unknown'}</p>
      <p><strong>User:</strong> ${esc(user_email) || 'not signed in'}</p>
      <p><strong>Error:</strong> ${esc(error_message) || 'no message'}</p>
      <p style="margin-top:16px;"><a href="https://yourpetpass.com/admin" style="color:#2D7D6F;font-weight:700;">View in Admin →</a></p>
    </div>
  </div>
</body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `⚠️ YourPetPass error: ${context || 'unknown'}`,
        html,
      }),
    });

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('notify-error failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
