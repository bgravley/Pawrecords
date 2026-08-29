// Called by the Supabase Database Webhook after a new profile is created.
// The endpoint is private-by-secret and fails closed if webhook auth is not
// configured, so it can never become an accidental public email sender.

import { verifyInternalWebhook } from './_webhookAuth.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';
const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'bgravley@rdmarketingllc.com';

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
  return String(value || '').replace(/[\r\n]/g, ' ').slice(0, 160);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhook = verifyInternalWebhook(req);
  if (!webhook.ok) return res.status(webhook.status).json({ error: webhook.error });
  if (!RESEND_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Signup notification service unavailable' });
  }

  try {
    const record = req.body?.record;
    if (!record || typeof record !== 'object') {
      return res.status(400).json({ error: 'No record in payload' });
    }

    const userEmail = String(record.email || 'unknown').slice(0, 254);
    const userId = String(record.id || '—').slice(0, 100);
    const fullName = String(record.full_name || '—').slice(0, 200);
    const referralCode = record.referral_code_used
      ? String(record.referral_code_used).slice(0, 100)
      : null;
    const createdAt = record.created_at
      ? new Date(record.created_at).toLocaleString('en-US', {
          timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short',
        })
      : 'just now';

    let totalUsers = '—';
    try {
      const countRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/profiles?select=id`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            Prefer: 'count=exact',
            'Range-Unit': 'items',
            Range: '0-0',
          },
        }
      );
      if (countRes.ok) {
        const countHeader = countRes.headers.get('content-range');
        if (countHeader) totalUsers = countHeader.split('/')[1] || '—';
      }
    } catch (error) {
      console.error('Total user count lookup failed (non-critical):', error.message);
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#FAFCFB;font-family:Georgia,'Times New Roman',serif;color:#1A2E22;">
  <div style="background:#FFFFFF;border:1px solid #DCE8E0;border-radius:16px;max-width:540px;margin:0 auto;overflow:hidden;">
    <div style="background:#2C4A38;padding:24px 28px;">
      <img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="180" style="display:block;height:auto;margin-bottom:12px;" />
      <div style="color:#FFFFFF;font-size:20px;font-weight:700;">New User Signed Up</div>
      <div style="color:#9DC4AA;font-size:13px;margin-top:4px;">yourpetpass.com</div>
    </div>
    <div style="padding:24px 28px;">
      <p><strong>Email:</strong> ${esc(userEmail)}</p>
      <p><strong>Name:</strong> ${esc(fullName)}</p>
      <p><strong>Signed up:</strong> ${esc(createdAt)}</p>
      <p><strong>Total users now:</strong> ${esc(totalUsers)}</p>
      ${referralCode ? `<p><strong>Referral code used:</strong> ${esc(referralCode)}</p>` : ''}
      <p style="font-size:12px;color:#7C9E87;"><strong>User ID:</strong> ${esc(userId)}</p>
      <a href="https://yourpetpass.com/admin" style="display:block;background:#C9A84C;color:#1A2E22;text-decoration:none;border-radius:10px;padding:12px 20px;text-align:center;font-weight:700;margin-top:20px;">View Admin Dashboard</a>
    </div>
    <div style="background:#EAF4EE;padding:15px 28px;color:#7C9E87;font-size:11px;text-align:center;">YourPetPass · Health Records &amp; Travel, Simplified.</div>
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
        subject: `New YourPetPass signup: ${safeSubject(userEmail)}${referralCode ? ` (ref: ${safeSubject(referralCode)})` : ''}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const detail = await emailRes.text().catch(() => '');
      console.error('Signup Resend error:', emailRes.status, detail.slice(0, 250));
      return res.status(502).json({ error: 'Email failed to send' });
    }
    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error('Signup notification error:', error.message);
    return res.status(500).json({ error: 'Signup notification failed' });
  }
}
