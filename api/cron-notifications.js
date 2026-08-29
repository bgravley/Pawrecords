// Vercel Cron compatibility wrapper for the notification engine.
// Vercel sends CRON_SECRET as Authorization: Bearer <secret>.

import { verifyCronRequest } from './_cronAuth.js';

const APP_URL = process.env.VITE_APP_URL || 'https://yourpetpass.com';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cron = verifyCronRequest(req);
  if (!cron.ok) return res.status(cron.status).json({ error: cron.error });

  try {
    const upstream = await fetch(`${APP_URL}/api/send-notifications`, {
      method: 'GET',
      headers: {
        'x-cron-secret': cron.secret,
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
