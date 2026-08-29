// api/contact-form.js
// Receives submissions from the public contact form and emails them to Brandon via Resend.

import { setCorsHeaders } from './_cors.js';
import { checkPublicRateLimit } from './_publicRateLimit.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';
const ADMIN_EMAIL = 'bgravley@rdmarketingllc.com';
const RATE_LIMIT = 5; // max real-looking submissions per IP per hour
const RATE_WINDOW_MS = 60 * 60 * 1000;

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHeaderText(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RESEND_API_KEY) {
    return res.status(503).json({ error: 'Contact service is temporarily unavailable. Please try again shortly.' });
  }

  const { name, email, subject, message, website, elapsedMs } = req.body || {};

  // Obvious bots never reach the mail sender or rate-limit database. Return a
  // normal-looking success so automated scanners have no useful feedback.
  if (website) {
    console.log('Contact form: honeypot triggered, discarding silently');
    return res.status(200).json({ sent: true });
  }
  if (typeof elapsedMs !== 'number' || elapsedMs < 1500) {
    console.log('Contact form: missing or too-fast elapsedMs, discarding silently', elapsedMs);
    return res.status(200).json({ sent: true });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const rate = await checkPublicRateLimit({
    ip,
    form: 'contact-form',
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rate.ok) return res.status(rate.status).json({ error: rate.error });
  if (rate.limited) {
    return res.status(429).json({ error: 'Too many submissions. Please wait a while before trying again.' });
  }

  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (subject !== undefined && subject !== null && typeof subject !== 'string') {
    return res.status(400).json({ error: 'Subject must be text.' });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
  const cleanMessage = message.trim();

  if (!cleanName || !cleanEmail || !cleanMessage) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (cleanName.length > 100) return res.status(400).json({ error: 'Name is too long (max 100 characters).' });
  if (cleanEmail.length > 254) return res.status(400).json({ error: 'Email is too long.' });
  if (cleanSubject.length > 200) return res.status(400).json({ error: 'Subject is too long (max 200 characters).' });
  if (cleanMessage.length > 5000) return res.status(400).json({ error: 'Message is too long (max 5000 characters).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const headerName = safeHeaderText(cleanName);
  const headerSubject = safeHeaderText(cleanSubject);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAF6F0; margin: 0; padding: 20px; }
    .card { background: #FFFFFF; border-radius: 16px; max-width: 520px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1E5C52; padding: 20px 28px; }
    .header h1 { color: #FFFFFF; margin: 0; font-size: 18px; font-weight: 700; }
    .body { padding: 24px 28px; }
    .row { padding: 8px 0; border-bottom: 1px solid #F0E8DC; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .label { color: #8B7355; font-weight: 600; display: block; margin-bottom: 2px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    .value { color: #2C2017; }
    .message-box { background: #FAF6F0; border-radius: 10px; padding: 16px; margin-top: 12px; color: #2C2017; line-height: 1.6; white-space: pre-wrap; }
    .footer { padding: 14px 28px; background: #F4EFE8; font-size: 12px; color: #8B7355; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="180" style="display:block;height:auto;margin-bottom:12px;" />
      <h1>📨 New Contact Form Submission</h1>
    </div>
    <div class="body">
      <div class="row"><span class="label">From</span><span class="value">${esc(cleanName)} &lt;${esc(cleanEmail)}&gt;</span></div>
      ${cleanSubject ? `<div class="row"><span class="label">Subject</span><span class="value">${esc(cleanSubject)}</span></div>` : ''}
      <div class="row">
        <span class="label">Message</span>
        <div class="message-box">${esc(cleanMessage)}</div>
      </div>
    </div>
    <div class="footer">Submitted via yourpetpass.com/contact.html · Reply directly to this email to respond.</div>
  </div>
</body>
</html>`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        reply_to: cleanEmail,
        subject: `🐾 Contact form: ${headerSubject || `New message from ${headerName}`}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const detail = await emailRes.text().catch(() => '');
      console.error('Contact form Resend error:', emailRes.status, detail.slice(0, 250));
      return res.status(502).json({ error: 'Could not send message. Please try again.' });
    }

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('Contact form error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
