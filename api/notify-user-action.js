// api/notify-user-action.js
// Sends a short confirmation email when a user completes a meaningful action.
// Centralized so new action types are easy to add later — just extend TEMPLATES.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';

function esc(str) {
  if (!str) return str;
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrap(bodyHtml) {
  return `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAF6F0; margin: 0; padding: 20px; }
  .card { background: #FFFFFF; border-radius: 16px; max-width: 480px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .header { background: #1E5C52; padding: 20px 26px; }
  .header h1 { color: #FFFFFF; margin: 0; font-size: 17px; font-weight: 700; }
  .body { padding: 22px 26px; color: #5A4535; font-size: 14px; line-height: 1.65; }
  .body h2 { color: #1E5C52; font-size: 17px; margin: 0 0 10px; }
  .footer { background: #F4EFE8; padding: 14px 26px; font-size: 11px; color: #8B7355; text-align: center; }
</style></head>
<body><div class="card">
  <div class="header"><img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="200" style="display:block;height:auto;" /></div>
  <div class="body">${bodyHtml}</div>
  <div class="footer">YourPetPass · yourpetpass.com</div>
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
      <p style="background:#F4EFE8;border-radius:10px;padding:12px 16px;margin-top:14px;">
        <strong>Usage this month:</strong> ${used}/${limit} included checklists used
        ${creditsBalance > 0 ? `<br><strong>Bonus credits remaining:</strong> ${creditsBalance}` : ''}
      </p>`,
  }),
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { actionType, recipientEmail, data } = req.body;

  if (!actionType || !recipientEmail || !TEMPLATES[actionType]) {
    return res.status(400).json({ error: 'Valid actionType and recipientEmail are required.' });
  }

  try {
    const { subject, body } = TEMPLATES[actionType](data || {});
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: recipientEmail, subject, html: wrap(body) }),
    });
    if (!emailRes.ok) return res.status(500).json({ error: 'Email failed to send' });
    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('notify-user-action error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
