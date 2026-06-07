// api/test-email.js
// Temporary test endpoint — DELETE after confirming Resend works

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export default async function handler(req, res) {
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not set in environment variables' });
  }

  const to = req.query.to || 'bgravley@rdmarketingllc.com';

  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'YourPetPass <notifications@yourpetpass.com>',
      to,
      subject: '🐾 YourPetPass Email Test',
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;background:#FAF6F0;border-radius:16px;overflow:hidden;">
          <div style="background:#1E5C52;padding:24px;text-align:center;">
            <div style="font-size:24px;color:#fff;font-weight:900;">🐾 Your<span style="color:#F5C45E;">Pet</span>Pass</div>
          </div>
          <div style="padding:28px;">
            <h2 style="color:#1E5C52;">Email is working! ✅</h2>
            <p style="color:#5A4535;line-height:1.7;">This is a test email from YourPetPass. If you're seeing this, Resend is connected correctly and notifications will be delivered.</p>
            <p style="color:#5A4535;font-size:13px;">Sent to: ${to}<br>Time: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `,
    }),
  });

  const data = await result.json();

  if (!result.ok) {
    return res.status(500).json({ error: 'Resend failed', details: data });
  }

  return res.status(200).json({ success: true, message: `Test email sent to ${to}`, id: data.id });
}
