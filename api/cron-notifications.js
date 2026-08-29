// Vercel Cron compatibility wrapper for the existing notification engine.
// Vercel sends CRON_SECRET as Authorization: Bearer <secret>.
// send-notifications.js historically expects x-cron-secret, so this wrapper
// verifies Vercel's header and forwards the request using the legacy header.

const APP_URL = process.env.VITE_APP_URL || 'https://yourpetpass.com';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured');
    return res.status(500).json({ error: 'Cron is not configured' });
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const upstream = await fetch(`${APP_URL}/api/send-notifications`, {
      method: 'GET',
      headers: {
        'x-cron-secret': cronSecret,
        'User-Agent': 'YourPetPass-Cron/1.0',
      },
    });

    const body = await upstream.text();
    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('Content-Type', type);
    return res.send(body);
  } catch (error) {
    console.error('Notification cron wrapper failed:', error);
    return res.status(502).json({ error: 'Notification job could not be reached' });
  }
}
