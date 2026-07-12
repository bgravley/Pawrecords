// api/contact-form.js
// Receives submissions from the public contact form and emails them to Brandon via Resend.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = 'YourPetPass <notifications@yourpetpass.com>';
const ADMIN_EMAIL    = 'bgravley@rdmarketingllc.com';
const RATE_LIMIT     = 5;   // max submissions per IP per hour
const RATE_WINDOW_MS = 60 * 60 * 1000;

// Checks the rate_limit_log table and returns true if this IP is over the limit.
// Also writes a new entry for this attempt.
async function isRateLimited(ip, form) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return false; // fail open if not configured

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  // Count recent submissions from this IP
  const countRes = await fetch(
    `${supabaseUrl}/rest/v1/rate_limit_log?ip=eq.${encodeURIComponent(ip)}&form=eq.${form}&created_at=gte.${since}&select=id`,
    { headers: { ...headers, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' } }
  );
  const countHeader = countRes.headers.get('content-range');
  const count = countHeader ? parseInt(countHeader.split('/')[1]) || 0 : 0;

  // Log this attempt regardless (so the count is accurate next time)
  await fetch(`${supabaseUrl}/rest/v1/rate_limit_log`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ip, form }),
  });

  return count >= RATE_LIMIT;
}

// Escapes user-submitted text before it gets inserted into email HTML —
// without this, someone could submit HTML/script tags as their name or
// subject and have it render in the email instead of showing as plain text.
function esc(str) {
  if (!str) return str;
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting — 5 submissions per IP per hour
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const limited = await isRateLimited(ip, 'contact-form');
  if (limited) {
    return res.status(429).json({ error: 'Too many submissions. Please wait a while before trying again.' });
  }

  const { name, email, subject, message, website, elapsedMs } = req.body;

  // Bot detection: a honeypot field real users never see or fill, and a
  // minimum time-on-page check (a real person needs at least a couple
  // seconds to read the form and type something). Either signal on its own
  // can have false positives at the margins, so only reject on the
  // honeypot (a filled hidden field is essentially never a real person) or
  // a genuinely instant submission. Return a normal-looking success
  // response rather than an error -- a bot that gets an error might retry
  // or adapt; one that thinks it succeeded just moves on.
  if (website) {
    console.log('Contact form: honeypot triggered, discarding silently');
    return res.status(200).json({ sent: true });
  }
  if (typeof elapsedMs === 'number' && elapsedMs < 1500) {
    console.log('Contact form: submitted too fast to be human, discarding silently', elapsedMs);
    return res.status(200).json({ sent: true });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  // Length limits — the real protection boundary, independent of any client-side limit
  if (name.length > 100) return res.status(400).json({ error: 'Name is too long (max 100 characters).' });
  if (email.length > 200) return res.status(400).json({ error: 'Email is too long.' });
  if (subject && subject.length > 200) return res.status(400).json({ error: 'Subject is too long (max 200 characters).' });
  if (message.length > 5000) return res.status(400).json({ error: 'Message is too long (max 5000 characters).' });

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

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
      <div class="row"><span class="label">From</span><span class="value">${esc(name)} &lt;${esc(email)}&gt;</span></div>
      ${subject ? `<div class="row"><span class="label">Subject</span><span class="value">${esc(subject)}</span></div>` : ''}
      <div class="row">
        <span class="label">Message</span>
        <div class="message-box">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
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
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        reply_to: email,
        subject: `🐾 Contact form: ${subject || 'New message from ' + name}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Could not send message. Please try again.' });
    }

    return res.status(200).json({ sent: true });

  } catch (err) {
    console.error('Contact form error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
