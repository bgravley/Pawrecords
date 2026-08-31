// Confirms that a Stripe purchase was completed by the signed Stripe webhook.
// The browser never gets to declare a purchase successful: it can only ask
// whether the private, service-only confirmation ledger contains its own
// Checkout Session and the originating webhook event is durably processed.

import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

const SERVICE_HEADERS = () => ({
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
});

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || sessionId.length > 255) {
    return res.status(400).json({ error: 'Invalid checkout session' });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Purchase confirmation unavailable' });
  }

  try {
    const confirmationRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/stripe_purchase_confirmations?stripe_session_id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(auth.userId)}&select=stripe_event_id&limit=1`,
      { headers: SERVICE_HEADERS() }
    );
    if (!confirmationRes.ok) throw new Error(`confirmation lookup ${confirmationRes.status}`);
    const confirmations = await confirmationRes.json();
    const eventId = confirmations?.[0]?.stripe_event_id;
    if (!eventId) return res.status(200).json({ confirmed: false });

    const eventRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/stripe_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&status=eq.processed&select=event_id&limit=1`,
      { headers: SERVICE_HEADERS() }
    );
    if (!eventRes.ok) throw new Error(`webhook ledger lookup ${eventRes.status}`);
    const events = await eventRes.json();

    return res.status(200).json({ confirmed: events?.length === 1 });
  } catch (error) {
    console.error('Purchase confirmation lookup failed:', error.message);
    return res.status(502).json({ error: 'Could not confirm purchase yet' });
  }
}
