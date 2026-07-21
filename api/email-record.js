// api/email-record.js
// Sends a pet's exported health record HTML directly to a recipient's inbox.
// The HTML is generated client-side (same function used for the Export
// button) and passed in — this endpoint just delivers it via Resend.

import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';

function esc(str) {
  if (!str) return str;
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Require a signed-in user — this endpoint sends email from our domain,
  // so it must never be callable by an anonymous stranger (open relay risk).
  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { recipientEmail, petName, htmlContent, note, pdfUrl } = req.body;
  // Sender identity always comes from the verified session, never the body.
  const senderEmail = auth.email;

  if (!recipientEmail || !petName || !htmlContent) {
    return res.status(400).json({ error: 'recipientEmail, petName, and htmlContent are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return res.status(400).json({ error: 'Please enter a valid recipient email address.' });
  }

  if (note && note.length > 1000) {
    return res.status(400).json({ error: 'Note is too long (max 1000 characters).' });
  }

  // Wrap the exported record HTML with a short intro message + PDF link banner
  const wrapperHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:20px; background:#FAF6F0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width:720px; margin:0 auto;">
    <div style="background:#1E5C52; padding:20px 24px; border-radius:16px 16px 0 0;">
      <img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="160" style="display:block;height:auto;margin-bottom:10px;" />
      <div style="color:#fff; font-size:18px; font-weight:700;">🐾 ${esc(petName)}'s Health Record</div>
      <div style="color:#A8D5CE; font-size:13px; margin-top:4px;">Shared${senderEmail ? ' by ' + esc(senderEmail) : ''}</div>
    </div>
    ${pdfUrl ? `
    <div style="background:#FFF8EC; border-bottom:1px solid #E8DDD0; padding:16px 24px; text-align:center;">
      <a href="${pdfUrl}" style="display:inline-block; background:#E8A838; color:#1E1408; text-decoration:none; font-weight:800; font-size:14px; padding:12px 24px; border-radius:10px;">
        📄 Click here for the PDF version
      </a>
      <div style="font-size:12px; color:#8B7355; margin-top:8px;">Save it, print it, or share it however you need.</div>
    </div>` : ''}
    ${note ? `<div style="background:#fff; padding:16px 24px; border-bottom:1px solid #E8DDD0; color:#5A4535; font-size:14px; font-style:italic;">"${note.replace(/</g,'&lt;').replace(/>/g,'&gt;')}"</div>` : ''}
    <div style="background:#fff; padding:0 24px 24px; border-radius:0 0 16px 16px;">
      ${htmlContent}
    </div>
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
        to: recipientEmail,
        reply_to: senderEmail || undefined,
        subject: `🐾 ${petName}'s Health Record — shared via YourPetPass`,
        html: wrapperHtml,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json().catch(() => ({}));
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Could not send the email. Please try again.' });
    }

    return res.status(200).json({ sent: true });

  } catch (err) {
    console.error('Email record error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
