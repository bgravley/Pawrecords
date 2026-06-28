// api/contact-form.js
// Receives submissions from the public contact form and emails them to Brandon via Resend.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = 'YourPetPass <notifications@yourpetpass.com>';
const ADMIN_EMAIL    = 'bgravley@rdmarketingllc.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, subject, message } = req.body;

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
      <div class="row"><span class="label">From</span><span class="value">${name} &lt;${email}&gt;</span></div>
      ${subject ? `<div class="row"><span class="label">Subject</span><span class="value">${subject}</span></div>` : ''}
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
