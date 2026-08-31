// Confirms a conversion only when Stripe says the signed-in user owns the
// Checkout Session AND the exact paid Stripe event has been durably processed
// by our signed webhook. The browser never gets to declare payment success.

import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

const STRIPE_API_VERSION = '2026-04-22.dahlia';
const SERVICE_HEADERS = () => ({
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
});

async function stripeGet(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.append(key, String(value));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`https://api.stripe.com/v1/${path}${suffix}`, {
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Stripe confirmation read failed (${response.status}): ${detail.slice(0, 160)}`);
  }
  return response.json();
}

async function webhookProcessed(eventId) {
  if (!eventId) return false;
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/stripe_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&status=eq.processed&select=event_id&limit=1`,
    { headers: SERVICE_HEADERS() }
  );
  if (!response.ok) throw new Error(`Webhook ledger lookup failed (${response.status})`);
  const rows = await response.json();
  return rows?.length === 1;
}

function objectId(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id || null;
}

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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Purchase confirmation unavailable' });
  }

  try {
    const checkout = await stripeGet(`checkout/sessions/${encodeURIComponent(sessionId)}`);
    const checkoutUserId = checkout?.metadata?.userId || checkout?.client_reference_id || null;
    const purchaseType = checkout?.metadata?.purchaseType || null;

    // A valid Stripe Session ID is not authorization. It must belong to the
    // same authenticated YourPetPass user before we inspect payment state.
    if (!checkoutUserId || checkoutUserId !== auth.userId) {
      return res.status(404).json({ confirmed: false });
    }
    if (checkout.status !== 'complete') return res.status(200).json({ confirmed: false });

    let eventType = null;
    let paidObjectId = null;

    if (checkout.mode === 'payment' && (purchaseType === 'lifetime' || purchaseType === 'travel_credits')) {
      if (checkout.payment_status !== 'paid') return res.status(200).json({ confirmed: false });
      eventType = 'checkout.session.completed';
      paidObjectId = checkout.id;
    } else if (checkout.mode === 'subscription' && purchaseType === 'subscription') {
      // New subscription conversion is authoritative only after the initial
      // invoice payment succeeds. Renewals are deliberately not counted here.
      const invoiceId = objectId(checkout.invoice);
      if (!invoiceId) return res.status(200).json({ confirmed: false });
      eventType = 'invoice.payment_succeeded';
      paidObjectId = invoiceId;
    } else {
      return res.status(200).json({ confirmed: false });
    }

    // Stripe's Events API is used only to identify the immutable event ID for
    // this exact paid object. The final authority is our private webhook ledger.
    const createdGte = Math.max(0, Number(checkout.created || 0) - 3600);
    const stripeEvents = await stripeGet('events', {
      type: eventType,
      'created[gte]': createdGte,
      limit: 100,
    });
    const matchingEvent = (stripeEvents?.data || []).find(item => objectId(item?.data?.object) === paidObjectId);
    if (!matchingEvent?.id) return res.status(200).json({ confirmed: false });

    return res.status(200).json({ confirmed: await webhookProcessed(matchingEvent.id) });
  } catch (error) {
    console.error('Purchase confirmation lookup failed:', error.message);
    return res.status(502).json({ error: 'Could not confirm purchase yet' });
  }
}
