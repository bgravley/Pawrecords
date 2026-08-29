// Lightweight production health check for Supabase.
// Intended for Vercel Cron. Performs tiny read-only queries so a Free-plan
// project receives regular database activity and failures are surfaced.

const ALERT_TO = process.env.ADMIN_ALERT_EMAIL || 'bgravley@rdmarketingllc.com';
const ALERT_FROM = 'YourPetPass <notifications@yourpetpass.com>';

async function sendFailureAlert(message) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: ALERT_TO,
        subject: 'YourPetPass Alert — Supabase Health Check Failed',
        html: `<p>The automated Supabase health check failed.</p><p><strong>${String(message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</strong></p><p>Please review Vercel and Supabase immediately.</p>`,
      }),
    });
  } catch (err) {
    console.error('Failed to send Supabase health alert:', err);
  }
}

async function sb(path) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY is not configured');

  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${response.status}: ${detail.slice(0, 250)}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(500).json({ error: 'Cron is not configured' });
  if ((req.headers.authorization || '') !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [profiles, dogs, trips] = await Promise.all([
      sb('profiles?select=id&limit=1'),
      sb('dogs?select=id&limit=1'),
      sb('trips?select=id&limit=1'),
    ]);

    console.log('Supabase health check passed');
    return res.status(200).json({
      ok: true,
      checks: 3,
      samples: {
        profiles: profiles.length,
        dogs: dogs.length,
        trips: trips.length,
      },
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Supabase health check failed:', error);
    await sendFailureAlert(error?.message || 'Unknown error');
    return res.status(503).json({ ok: false, error: 'Supabase health check failed' });
  }
}
