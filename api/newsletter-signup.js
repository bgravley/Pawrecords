// api/newsletter-signup.js
// Captures email addresses from the marketing page newsletter signup form.

import { setCorsHeaders } from './_cors.js';
import { checkPublicRateLimit } from './_publicRateLimit.js';

const RATE_LIMIT = 3; // max real-looking submissions per IP per hour
const RATE_WINDOW_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, website, elapsedMs } = req.body || {};

  // Obvious bots never reach Storage/database writes or the rate-limit table.
  // Return a normal-looking success so automated scanners have no useful signal.
  if (website) {
    console.log('Newsletter signup: honeypot triggered, discarding silently');
    return res.status(200).json({ subscribed: true });
  }
  if (typeof elapsedMs !== 'number' || elapsedMs < 1500) {
    console.log('Newsletter signup: missing or too-fast elapsedMs, discarding silently', elapsedMs);
    return res.status(200).json({ subscribed: true });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const rate = await checkPublicRateLimit({
    ip,
    form: 'newsletter-signup',
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rate.ok) return res.status(rate.status).json({ error: rate.error });
  if (rate.limited) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  if (typeof email !== 'string') {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Newsletter signup is temporarily unavailable. Please try again shortly.' });
  }

  try {
    const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/newsletter_subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify({ email: cleanEmail }),
    });

    if (!insertRes.ok && insertRes.status !== 409) {
      const detail = await insertRes.text().catch(() => '');
      console.error('Newsletter signup insert failed:', insertRes.status, detail.slice(0, 250));
      return res.status(503).json({ error: 'Could not sign up right now. Please try again.' });
    }

    return res.status(200).json({ subscribed: true });
  } catch (err) {
    console.error('Newsletter signup error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
