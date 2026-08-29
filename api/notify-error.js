// Internal webhook alert for new error_log rows. Authentication fails closed;
// email delivery is capped so one application failure cannot flood the inbox
// or consume unbounded Resend quota. The full error history remains in Admin.

import { verifyInternalWebhook } from './_webhookAuth.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass Alerts <notifications@yourpetpass.com>';
const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'bgravley@rdmarketingllc.com';
const ALERT_LIMIT = 20;
const ALERT_WINDOW_MS = 60 * 60 * 1000;

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeSubject(value) {
  return String(value || 'unknown').replace(/[\r\n]/g, ' ').slice(0, 120);
}

async function alertAllowed() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return true;
  try {
    const since = new Date(Date.now() - ALERT_WINDOW_MS).toISOString();
    const headers = {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };
    const countRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rate_limit_log?ip=eq.system&form=eq.notify-error-email&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { headers: { ...headers, Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' } }
    );
    if (!countRes.ok) return true;
    const range = countRes.headers.get('content-range');
    const count = range ? parseInt(range.split('/')[1], 10) || 0 : 0;
    if (count >= ALERT_LIMIT) return false;

    const logRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rate_limit_log`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ ip: 'system', form: 'notify-error-email' }),
    });
    if (!logRes.ok) console.error('Error-alert throttle log failed:', logRes.status);
    return true;
  } catch (error) {
    console.error('Error-alert throttle unavailable (sending alert):', error.message);
    return true;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhook = verifyInternalWebhook(req);
  if (!webhook.ok) return res.status(webhook.status).json({ error: webhook.error });
  if (!RESEND_API_KEY) return res.status(503).json({ error: 'Error notification service unavailable' });

  const record = req.body?.record;
  if (!record || typeof record !== 'object') {
    return res.status(400).json({ error: 'No record in payload' });
  }

  if (!(await alertAllowed())) {
    console.warn(`Error notification email cap reached (${ALERT_LIMIT}/hour); error remains visible in Admin.`);
    return res.status(200).json({ sent: false, throttled: true });
  }

  const context = String(record.context || 'unknown').slice(0, 300);
  const errorMessage = String(record.error_message || 'no message').slice(0, 5000);
  const userEmail = String(record.user_email || 'not signed in').slice(0, 254);

  try {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#FAFCFB;font-family:Georgia,'Times New Roman',serif;color:#1A2E22;">
  <div style="max-width:540px;margin:0 auto;background:#FFFFFF;border:1px solid #DCE8E0;border-radius:14px;overflow:hidden;">
    <div style="background:#2C4A38;padding:18px 24px;">
      <img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="170" style="display:block;height:auto;margin-bottom:10px;" />
      <div style="color:#FFFFFF;font-weight:700;font-size:17px;">New Error Logged</div>
    </div>
    <div style="padding:22px 24px;font-size:14px;line-height:1.65;">
      <p><strong>Context:</strong> ${esc(context)}</p>
      <p><strong>User:</strong> ${esc(userEmail)}</p>
      <p><strong>Error:</strong></p>
      <div style="background:#EAF4EE;border-radius:10px;padding:14px;white-space:pre-wrap;word-break:break-word;">${esc(errorMessage)}</div>
      <p style="margin-top:18px;"><a href="https://yourpetpass.com/admin" style="color:#2C4A38;font-weight:700;">View in Admin →</a></p>
    </div>
    <div style="background:#EAF4EE;padding:14px 24px;color:#7C9E87;font-size:11px;text-align:center;">Email alerts are capped at ${ALERT_LIMIT} per hour; all errors remain in Admin.</div>
  </div>
</body></html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `YourPetPass error: ${safeSubject(context)}`,
        html,
      }),
    });
    if (!emailRes.ok) {
      const detail = await emailRes.text().catch(() => '');
      console.error('Error notification Resend failure:', emailRes.status, detail.slice(0, 250));
      return res.status(502).json({ error: 'Email failed to send' });
    }
    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error('notify-error failed:', error.message);
    return res.status(500).json({ error: 'Error notification failed' });
  }
}
