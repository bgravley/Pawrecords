// api/create-checkout.js
// Creates a Stripe Checkout session for subscription or one-time payment.
// Replaces the missing Supabase Edge Function that was previously called.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { priceId, userId, userEmail, mode, couponCode } = req.body;

  if (!priceId) return res.status(400).json({ error: 'priceId is required' });
  if (!mode)    return res.status(400).json({ error: 'mode is required (subscription or payment)' });

  const BASE_URL = process.env.VITE_APP_URL || 'https://yourpetpass.com';

  const sessionParams = {
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode,                                              // 'subscription' or 'payment'
    success_url: `${BASE_URL}?payment=success`,
    cancel_url:  `${BASE_URL}?payment=canceled`,
    metadata: { userId: userId || '' },
  };

  // Pre-fill email so the user doesn't have to type it again
  if (userEmail) sessionParams.customer_email = userEmail;

  // Apply coupon if provided — Stripe validates it, we just pass it through
  if (couponCode) {
    sessionParams.discounts = [{ coupon: couponCode }];
  }

  // For subscriptions, allow promotion codes to be applied at checkout too
  if (mode === 'subscription') {
    sessionParams.allow_promotion_codes = !couponCode; // allow if no coupon pre-applied
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
