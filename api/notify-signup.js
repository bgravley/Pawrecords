// api/notify-signup.js
// Called by a Supabase Database Webhook whenever a new row is inserted into `profiles`.
// Sends Brandon an email via Resend with the new user's details.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = 'YourPetPass <notifications@yourpetpass.com>';
const ADMIN_EMAIL    = 'bgravley@rdmarketingllc.com';
const WEBHOOK_SECRET = process.env.SIGNUP_WEBHOOK_SECRET; // set this in Vercel env vars

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify the request is genuinely from Supabase using a shared secret header
  const secret = req.headers['x-webhook-secret'];
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    console.warn('Signup webhook: invalid secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Supabase Database Webhooks send the new row as `record` in the payload
    const { record } = req.body;
    if (!record) return res.status(400).json({ error: 'No record in payload' });

    const userEmail    = record.email || 'unknown';
    const userId       = record.id || '—';
    const createdAt    = record.created_at
      ? new Date(record.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' })
      : 'just now';
    const fullName     = record.full_name || '—';
    const referralCode = record.referral_code_used || null;

    // Get total user count from Supabase for context
    let totalUsers = '—';
    try {
      const countRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/profiles?select=id`,
        {
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Prefer': 'count=exact',
            'Range-Unit': 'items',
            'Range': '0-0',
          }
        }
      );
      if (!countRes.ok) {
        console.error('Total user count lookup failed (non-critical):', countRes.status);
      } else {
        const countHeader = countRes.headers.get('content-range');
        if (countHeader) totalUsers = countHeader.split('/')[1] || '—';
      }
    } catch (e) { /* non-critical */ }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAF6F0; margin: 0; padding: 20px; }
    .card { background: #FFFFFF; border-radius: 16px; max-width: 520px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1E5C52; padding: 24px 28px; }
    .header h1 { color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 700; }
    .header p { color: #A8D5CE; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 24px 28px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #F0E8DC; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .label { color: #8B7355; font-weight: 600; }
    .value { color: #2C2017; text-align: right; max-width: 60%; word-break: break-all; }
    .badge { background: #2D7D6F22; color: #2D7D6F; border-radius: 20px; padding: 2px 10px; font-size: 12px; font-weight: 700; }
    .ref-badge { background: #E8A83822; color: #B8821C; border-radius: 20px; padding: 2px 10px; font-size: 12px; font-weight: 700; }
    .cta { display: block; background: #2D7D6F; color: #FFFFFF; text-decoration: none; border-radius: 10px; padding: 12px 20px; text-align: center; font-weight: 700; font-size: 14px; margin: 20px 0 0; }
    .footer { padding: 16px 28px; background: #F4EFE8; font-size: 12px; color: #8B7355; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🐾 New User Signed Up</h1>
      <p>YourPetPass · yourpetpass.com</p>
    </div>
    <div class="body">
      <div class="row">
        <span class="label">Email</span>
        <span class="value">${userEmail}</span>
      </div>
      <div class="row">
        <span class="label">Name</span>
        <span class="value">${fullName}</span>
      </div>
      <div class="row">
        <span class="label">Signed up</span>
        <span class="value">${createdAt}</span>
      </div>
      <div class="row">
        <span class="label">Total users now</span>
        <span class="value"><span class="badge">${totalUsers} total</span></span>
      </div>
      ${referralCode ? `
      <div class="row">
        <span class="label">Referral code used</span>
        <span class="value"><span class="ref-badge">🤝 ${referralCode}</span></span>
      </div>
      ` : ''}
      <div class="row">
        <span class="label">User ID</span>
        <span class="value" style="font-family:monospace;font-size:11px;color:#8B7355">${userId}</span>
      </div>
      <a href="https://yourpetpass.com" class="cta">View in Admin Dashboard →</a>
    </div>
    <div class="footer">
      You're receiving this because you're the YourPetPass admin. Every new signup sends this email.
    </div>
  </div>
</body>
</html>`;

    // Send to Brandon
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `🐾 New signup: ${userEmail}${referralCode ? ` (ref: ${referralCode})` : ''}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Email failed to send' });
    }

    console.log(`Signup notification sent for: ${userEmail}`);
    return res.status(200).json({ sent: true });

  } catch (err) {
    console.error('Signup notification error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
