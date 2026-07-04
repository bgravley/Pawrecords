// api/report-bug.js
// Receives bug report submissions, saves to the database, and notifies Brandon.
// Rewards are NOT automatic — every report requires manual approval in Admin
// before any subscription credit is applied (prevents abuse/repeat submissions).

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';
const RATE_LIMIT     = 10;  // max submissions per IP per hour
const RATE_WINDOW_MS = 60 * 60 * 1000;

async function isRateLimited(ip, form) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return false;

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  const countRes = await fetch(
    `${supabaseUrl}/rest/v1/rate_limit_log?ip=eq.${encodeURIComponent(ip)}&form=eq.${form}&created_at=gte.${since}&select=id`,
    { headers: { ...headers, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' } }
  );
  const countHeader = countRes.headers.get('content-range');
  const count = countHeader ? parseInt(countHeader.split('/')[1]) || 0 : 0;

  await fetch(`${supabaseUrl}/rest/v1/rate_limit_log`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ip, form }),
  });

  return count >= RATE_LIMIT;
}

function esc(str) {
  if (!str) return str;
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const ADMIN_EMAIL = 'bgravley@rdmarketingllc.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Rate limiting — 10 submissions per IP per hour
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const limited = await isRateLimited(ip, 'report-bug');
  if (limited) {
    return res.status(429).json({ error: 'Too many bug reports submitted. Please wait before submitting another.' });
  }

  const { userId, userEmail, description } = req.body;

  if (!description || description.trim().length === 0) {
    return res.status(400).json({ error: 'Please describe the bug.' });
  }
  if (description.length > 2000) {
    return res.status(400).json({ error: 'Description is too long (max 2000 characters).' });
  }

  try {
    const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/bug_reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        user_id: userId || null,
        user_email: userEmail || null,
        description: description.trim(),
        status: 'pending',
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('Bug report insert failed:', errText);
      return res.status(500).json({ error: 'Could not submit report. Please try again.' });
    }

    // Notify Brandon immediately so he can review/approve
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: ADMIN_EMAIL,
          subject: `🐛 New bug report from ${userEmail || 'a user'}`,
          html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <div style="background:#1E5C52;padding:18px 24px;border-radius:12px 12px 0 0;">
              <img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="160" style="display:block;height:auto;" />
            </div>
            <div style="padding:20px;">
            <h2>🐛 New Bug Report</h2>
            <p><strong>From:</strong> ${esc(userEmail) || 'unknown'}</p>
            <p><strong>Description:</strong></p>
            <p style="background:#f4f4f4;padding:12px;border-radius:8px;white-space:pre-wrap;">${description.replace(/</g,'&lt;')}</p>
            <p><a href="https://yourpetpass.com/admin">Review in Admin →</a></p>
            </div>
          </div>`,
        }),
      });
    } catch (emailErr) {
      console.error('Bug report admin notification failed (non-critical):', emailErr.message);
    }

    return res.status(200).json({ submitted: true });

  } catch (err) {
    console.error('report-bug error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
