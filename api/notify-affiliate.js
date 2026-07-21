// api/notify-affiliate.js
// Sends a welcome email to a newly created affiliate.
// Called from Admin.jsx immediately after the affiliate record is created.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = 'YourPetPass <notifications@yourpetpass.com>';
const ADMIN_EMAIL    = 'bgravley@rdmarketingllc.com';

function esc(str) {
  if (!str) return str;
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const WEBHOOK_SECRET = process.env.SIGNUP_WEBHOOK_SECRET;

import { setCorsHeaders } from './_cors.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { affiliateEmail, affiliateName, referralCode, commissionRate, notes } = req.body;

  if (!affiliateEmail || !referralCode) {
    return res.status(400).json({ error: 'affiliateEmail and referralCode required' });
  }

  const referralUrl = `https://yourpetpass.com?ref=${referralCode}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAF6F0; margin: 0; padding: 20px; }
    .card { background: #FFFFFF; border-radius: 16px; max-width: 540px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1E5C52; padding: 28px; text-align: center; }
    .header h1 { color: #FFFFFF; margin: 0 0 6px; font-size: 26px; font-weight: 700; }
    .header p { color: #A8D5CE; margin: 0; font-size: 14px; font-style: italic; }
    .body { padding: 28px; }
    h2 { color: #1E5C52; font-size: 20px; margin: 0 0 8px; }
    p { color: #5A4535; font-size: 14px; line-height: 1.7; margin: 0 0 14px; }
    .highlight { background: #F4EFE8; border-radius: 12px; padding: 18px 20px; margin: 18px 0; }
    .highlight .label { font-size: 11px; font-weight: 700; color: #8B7355; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
    .highlight .value { font-size: 18px; font-weight: 700; color: #1E5C52; }
    .link-box { background: #1E5C5210; border: 1.5px solid #2D7D6F44; border-radius: 10px; padding: 12px 16px; font-family: monospace; font-size: 13px; color: #2D7D6F; word-break: break-all; margin: 14px 0; }
    .cta { display: block; background: #2D7D6F; color: #FFFFFF !important; text-decoration: none; border-radius: 12px; padding: 14px 20px; text-align: center; font-weight: 700; font-size: 15px; margin: 20px 0; }
    .steps { padding-left: 20px; }
    .steps li { color: #5A4535; font-size: 14px; line-height: 1.8; margin-bottom: 4px; }
    .footer { background: #F4EFE8; padding: 18px 28px; font-size: 12px; color: #8B7355; text-align: center; line-height: 1.7; }
    .divider { border: none; border-top: 1px solid #E8DDD0; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="200" style="display:block;height:auto;margin:0 auto;" />
    </div>
    <div class="body">
      <h2>Welcome to the affiliate program${affiliateName ? `, ${esc(affiliateName.split(' ')[0])}` : ''}! 🎉</h2>
      <p>
        You've been added as an official YourPetPass affiliate partner. 
        Every time someone signs up through your link and pays for a subscription, 
        you earn a commission — and it keeps paying you every month they stay subscribed.
      </p>

      <div class="highlight">
        <div class="label">Your Commission Rate</div>
        <div class="value">${commissionRate}% of every payment</div>
      </div>

      <p><strong>Your unique referral link:</strong></p>
      <div class="link-box">${referralUrl}</div>

      <p>
        Share this link anywhere — Instagram bio, stories, TikTok, email, wherever your audience is. 
        Anyone who clicks it and creates an account is permanently linked to you.
      </p>

      <hr class="divider">

      <p><strong>How it works:</strong></p>
      <ol class="steps">
        <li>Someone clicks your link and signs up for YourPetPass</li>
        <li>They upgrade to a paid plan (Monthly $4.99 / Annual $39.99 / Lifetime $99)</li>
        <li>You earn ${commissionRate}% of what they pay — every month for monthly subscribers, every year for annual</li>
        <li>Brandon sends your earnings via PayPal or Stripe at the end of each month</li>
      </ol>

      <hr class="divider">

      <p><strong>Your affiliate dashboard:</strong></p>
      <p>
        Log in to YourPetPass with this email and you'll see a gold <strong>"🤝 Affiliate"</strong> button 
        in the top right corner. Tap it to view your referral stats, transaction history, 
        and update your payout info (PayPal or Stripe email).
      </p>

      <a href="https://yourpetpass.com" class="cta">View Your Affiliate Dashboard →</a>

      ${notes ? `<p style="color:#8B7355;font-size:13px;font-style:italic;">Note from Brandon: ${notes}</p>` : ''}

      <p>
        Questions? Reply to this email or reach out directly at 
        <a href="mailto:${ADMIN_EMAIL}" style="color:#2D7D6F">${ADMIN_EMAIL}</a>.
      </p>
    </div>
    <div class="footer">
      YourPetPass · yourpetpass.com<br>
      You're receiving this because you've been added as an affiliate partner.
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
        to: affiliateEmail,
        reply_to: ADMIN_EMAIL,
        subject: `🐾 You're a YourPetPass affiliate — here's your referral link`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Email failed to send', detail: err });
    }

    console.log(`Affiliate welcome email sent to: ${affiliateEmail}`);
    return res.status(200).json({ sent: true });

  } catch (err) {
    console.error('Affiliate notification error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
