import { verifyUnsubscribeToken } from './_unsubscribe.js';

function noStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function serviceHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function supabase(path, options = {}) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    const error = new Error('Unsubscribe service unavailable');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: serviceHeaders(options.headers || {}),
  });
  if (!response.ok) {
    const error = new Error(`Unsubscribe data update failed (${response.status})`);
    error.status = 503;
    throw error;
  }
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : null;
}

function readToken(req) {
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';
  const bodyToken = typeof req.body?.token === 'string' ? req.body.token : '';
  return queryToken || bodyToken;
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = readToken(req);
    const verified = verifyUnsubscribeToken(token);
    if (!verified) return res.status(400).json({ error: 'This unsubscribe link is invalid.' });

    const rows = await supabase(`profiles?id=eq.${encodeURIComponent(verified.userId)}&select=id,email_notifications`, {
      method: 'GET',
    });

    // A deleted account and an already-unsubscribed account both return the
    // same success response. Do not turn this public endpoint into an account
    // existence oracle.
    if (Array.isArray(rows) && rows.length && rows[0].email_notifications !== false) {
      await supabase(`profiles?id=eq.${encodeURIComponent(verified.userId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ email_notifications: false }),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'YourPetPass email reminders are turned off.',
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Unsubscribe endpoint error:', error.message);
    return res.status(status).json({
      error: status >= 500 ? 'We could not update your email preference. Please try again.' : error.message,
    });
  }
}
