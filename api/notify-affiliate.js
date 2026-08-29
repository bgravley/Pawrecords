// Sends a welcome email after an administrator creates an affiliate.
// Recipient and affiliate details are re-read from Supabase; the browser is
// never trusted to choose who receives YourPetPass-branded mail.

import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

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

function serviceHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };
}

async function rest(path) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: serviceHeaders(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase lookup failed (${response.status}): ${detail.slice(0, 160)}`);
  }
  return response.json();
}

async function requireAdmin(req) {
  const auth = await verifyUser(req);
  if (!auth.ok) return auth;
  const rows = await rest(
    `profiles?id=eq.${encodeURIComponent(auth.userId)}&select=is_admin,email&limit=1`
  );
  const profile = rows?.[0];
  const allowed = profile?.is_admin === true || profile?.email === ADMIN_EMAIL;
  if (!allowed) return { ok: false, status: 403, error: 'Admin access required' };
  return auth;
}

async function loadAffiliate(referralCode) {
  const rows = await rest(
    `affiliates?referral_code=eq.${encodeURIComponent(referralCode)}` +
    '&select=user_id,referral_code,commission_rate,notes,status&limit=2'
  );
  if (rows.length !== 1 || rows[0].status !== 'active' || !rows[0].user_id) return null;
  const affiliate = rows[0];
  const profiles = await rest(
    `profiles?id=eq.${encodeURIComponent(affiliate.user_id)}&select=email,full_name&limit=1`
  );
  const profile = profiles?.[0];
  if (!profile?.email) return null;
  return { ...affiliate, email: profile.email, fullName: profile.full_name || '' };
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!RESEND_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Affiliate email service unavailable' });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const referralCode = typeof req.body?.referralCode === 'string'
      ? req.body.referralCode.trim().toUpperCase()
      : '';
    if (!referralCode || referralCode.length > 80 || !/^[A-Z0-9_-]+$/.test(referralCode)) {
      return res.status(400).json({ error: 'Valid referralCode required' });
    }

    const affiliate = await loadAffiliate(referralCode);
    if (!affiliate) return res.status(404).json({ error: 'Active affiliate not found' });

    const firstName = affiliate.fullName.trim().split(/\s+/)[0] || '';
    const rate = Number(affiliate.commission_rate);
    const rateLabel = Number.isFinite(rate) ? `${rate}%` : 'your agreed rate';
    const referralUrl = `https://yourpetpass.com?ref=${encodeURIComponent(affiliate.referral_code)}`;
    const safeNotes = affiliate.notes ? esc(affiliate.notes) : '';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#FAFCFB;font-family:Georgia,'Times New Roman',serif;color:#1A2E22;">
  <div style="background:#FFFFFF;border:1px solid #DCE8E0;border-radius:16px;max-width:560px;margin:0 auto;overflow:hidden;">
    <div style="background:#2C4A38;padding:26px 28px;text-align:center;">
      <img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="200" style="display:block;height:auto;margin:0 auto;" />
    </div>
    <div style="padding:28px;">
      <h2 style="font-size:22px;color:#2C4A38;margin:0 0 10px;">Welcome to the affiliate program${firstName ? `, ${esc(firstName)}` : ''}</h2>
      <p style="line-height:1.7;">You've been added as a YourPetPass affiliate partner. When someone signs up through your link and makes an eligible purchase, your referral can be tracked back to you.</p>
      <div style="background:#EAF4EE;border-radius:12px;padding:16px 18px;margin:18px 0;">
        <div style="font-size:11px;font-weight:700;color:#7C9E87;text-transform:uppercase;letter-spacing:.06em;">Commission Rate</div>
        <div style="font-size:19px;font-weight:700;color:#2C4A38;margin-top:4px;">${esc(rateLabel)} of eligible payments</div>
      </div>
      <p><strong>Your unique referral link:</strong></p>
      <div style="background:#EAF4EE;border:1px solid #9DC4AA;border-radius:10px;padding:12px 14px;font-family:monospace;font-size:13px;color:#2C4A38;word-break:break-all;">${esc(referralUrl)}</div>
      <p style="line-height:1.7;margin-top:18px;">Share this link with your audience. Log in with this email to view your affiliate dashboard and referral activity.</p>
      <a href="https://yourpetpass.com" style="display:block;background:#C9A84C;color:#1A2E22;text-decoration:none;border-radius:10px;padding:13px 20px;text-align:center;font-weight:700;margin:22px 0;">Open YourPetPass</a>
      ${safeNotes ? `<p style="color:#7C9E87;font-size:13px;font-style:italic;">Note from YourPetPass: ${safeNotes}</p>` : ''}
      <p style="line-height:1.7;">Questions? Reply to this email and we'll help.</p>
    </div>
    <div style="background:#EAF4EE;padding:15px 28px;text-align:center;color:#7C9E87;font-size:11px;">YourPetPass · Health Records &amp; Travel, Simplified.</div>
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
        to: affiliate.email,
        reply_to: ADMIN_EMAIL,
        subject: "You're a YourPetPass affiliate — here's your referral link",
        html,
      }),
    });

    if (!emailRes.ok) {
      const detail = await emailRes.text().catch(() => '');
      console.error('Affiliate welcome email failed:', emailRes.status, detail.slice(0, 250));
      return res.status(502).json({ error: 'Email failed to send' });
    }
    return res.status(200).json({ sent: true });
  } catch (error) {
    console.error('Affiliate notification error:', error.message);
    return res.status(500).json({ error: 'Could not send affiliate welcome email' });
  }
}
