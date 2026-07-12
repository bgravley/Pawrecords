// api/newsletter-signup.js
// Captures email addresses from the marketing page newsletter signup form.

const RATE_LIMIT     = 3;   // max submissions per IP per hour
const RATE_WINDOW_MS = 60 * 60 * 1000;

async function isRateLimited(ip, form) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return false;

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  const countRes = await fetch(
    `${supabaseUrl}/rest/v1/rate_limit_log?ip=eq.${encodeURIComponent(ip)}&form=eq.${form}&created_at=gte.${since}&select=id`,
    { headers: { ...headers, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' } }
  );
  const countHeader = countRes.headers.get('content-range');
  const count = countHeader ? parseInt(countHeader.split('/')[1]) || 0 : 0;

  await fetch(`${supabaseUrl}/rest/v1/rate_limit_log`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ip, form }),
  });

  return count >= RATE_LIMIT;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Rate limiting — 3 submissions per IP per hour
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const limited = await isRateLimited(ip, 'newsletter-signup');
  if (limited) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { email, website, elapsedMs } = req.body;

  // Same bot protection as the contact form (see api/contact-form.js for
  // the full reasoning): a honeypot field real users never see or fill,
  // and a REQUIRED minimum time-on-page. elapsedMs must be present and a
  // number -- a bot that skips the real page and POSTs straight to this
  // endpoint sends neither field, and treating elapsedMs as optional would
  // let exactly that kind of submission through unchecked. Return a
  // normal-looking success response in every rejection case so a bot that
  // thinks it succeeded just moves on instead of retrying or adapting.
  if (website) {
    console.log('Newsletter signup: honeypot triggered, discarding silently');
    return res.status(200).json({ subscribed: true });
  }
  if (typeof elapsedMs !== 'number' || elapsedMs < 1500) {
    console.log('Newsletter signup: missing or too-fast elapsedMs, discarding silently', elapsedMs);
    return res.status(200).json({ subscribed: true });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const res2 = await fetch(`${process.env.SUPABASE_URL}/rest/v1/newsletter_subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal,resolution=ignore-duplicates', // silently ignore if already subscribed
      },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    });

    if (!res2.ok && res2.status !== 409) {
      const err = await res2.text();
      console.error('Newsletter signup insert failed:', err);
      return res.status(500).json({ error: 'Could not sign up right now. Please try again.' });
    }

    return res.status(200).json({ subscribed: true });
  } catch (err) {
    console.error('Newsletter signup error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
