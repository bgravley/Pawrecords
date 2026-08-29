// api/notify-user-action.js
// Sends a short confirmation email when a signed-in user completes a
// meaningful action. The recipient is always derived from the verified
// Supabase session; callers cannot turn this endpoint into an email relay.

import { setCorsHeaders } from './_cors.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';
const SESSION_COOKIE = 'ypp_file_session';

function esc(str) {
  if (!str) return str;
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== name) continue;
    try { return decodeURIComponent(rest.join('=')); } catch { return null; }
  }
  return null;
}

function readAccessToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return readCookie(req, SESSION_COOKIE);
}

async function authenticatedUser(req) {
  const token = readAccessToken(req);
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null;

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

function wrap(bodyHtml) {
  return `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { font-family: Georgia, 'Times New Roman', serif; background: #FAFCFB; margin: 0; padding: 20px; }
  .card { background: #FFFFFF; border-radius: 16px; max-width: 480px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 12px rgba(26,46,34,0.08); border: 1px solid #DCE8E0; }
  .header { background: #2C4A38; padding: 20px 26px; }
  .header h1 { color: #FFFFFF; margin: 0; font-size: 17px; font-weight: 700; }
  .body { padding: 22px 26px; color: #1A2E22; font-size: 14px; line-height: 1.65; }
  .body h2 { color: #2C4A38; font-size: 17px; margin: 0 0 10px; }
  .footer { background: #EAF4EE; padding: 14px 26px; font-size: 11px; color: #7C9E87; text-align: center; }
</style></head>
<body><div class="card">
  <div class="header"><img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="200" style="display:block;height:auto;" /></div>
  <div class="body">${bodyHtml}</div>
  <div class="footer">YourPetPass · Health Records &amp; Travel, Simplified.</div>
</div></body></html>`;
}

const TEMPLATES = {
  profile_updated: ({ name }) => ({
    subject: '✓ Your profile was updated',
    body: `<h2>Profile updated</h2><p>Your account profile was just updated successfully${name ? `, ${esc(name)}` : ''}. If this wasn't you, please reply to this email right away.</p>`,
  }),
  trip_added: ({ tripName, origin, destination }) => ({
    subject: `✈️ Trip added: ${origin} → ${destination}`,
    body: `<h2>New trip planned</h2><p>"${esc(tripName) || `${esc(origin)} → ${esc(destination)}`}" has been added to your Travel tab. Generate an AI checklist anytime to see what's needed for this route.</p>`,
  }),
  document_added: ({ petName }) => ({
    subject: `📄 Document added to ${petName}'s records`,
    body: `<h2>Document saved</h2><p>A new document was successfully added to ${esc(petName)}'s health records and is ready to view anytime.</p>`,
  }),
  checklist_generated: ({ origin, destination, used, limit, creditsBalance }) => ({
    subject: `✈️ Travel checklist ready: ${origin} → ${destination}`,
    body: `<h2>Checklist generated</h2><p>Your AI travel checklist for ${esc(origin)} → ${esc(destination)} is ready in the Travel tab.</p>
      <p style="background:#EAF4EE;border-radius:10px;padding:12px 16px;margin-top:14px;">
        <strong>Usage this month:</strong> ${esc(used)}/${esc(limit)} included checklists used
        ${Number(creditsBalance) > 0 ? `<br><strong>Bonus credits remaining:</strong> ${esc(creditsBalance)}` : ''}
      </p>`,
  }),
};

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RESEND_API_KEY) return res.status(503).json({ error: 'Notification service unavailable' });

  const user = await authenticatedUser(req);
  if (!user?.id || !user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const { actionType, data } = req.body || {};
  if (!actionType || !TEMPLATES[actionType]) {
    return res.status(400).json({ error: 'Valid actionType is required.' });
  }

  try {
    const { subject, body } = TEMPLATES[actionType](data || {});
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: user.email, subject, html: wrap(body) }),
    });
    if (!emailRes.ok) {
      const detail = await emailRes.text().catch(() => '');
      console.error('notify-user-action Resend failure:', emailRes.status, detail.slice(0, 250));
      return res.status(502).json({ error: 'Email failed to send' });
    }
    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('notify-user-action error:', err.message);
    return res.status(500).json({ error: 'Email failed to send' });
  }
}
