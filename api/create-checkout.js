// api/create-checkout.js
// Creates a Stripe Checkout session for subscription or one-time payment.
// Replaces the missing Supabase Edge Function that was previously called.

let _stripe = null;
const getStripe = async () => {
  if (!_stripe) _stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
  return _stripe;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { priceId, userId, userEmail, mode, couponCode, purchaseType, creditAmount } = req.body;

  if (!priceId) return res.status(400).json({ error: 'priceId is required' });
  if (!mode)    return res.status(400).json({ error: 'mode is required (subscription or payment)' });

  const BASE_URL = process.env.VITE_APP_URL || 'https://yourpetpass.com';

  const sessionParams = {
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode,                                              // 'subscription' or 'payment'
    success_url: `${BASE_URL}?payment=success`,
    cancel_url:  `${BASE_URL}?payment=canceled`,
    metadata: {
      userId: userId || '',
      purchaseType: purchaseType || 'subscription', // 'subscription' | 'lifetime' | 'travel_credits'
      creditAmount: creditAmount ? String(creditAmount) : '',
    },
  };

  // Pre-fill email so the user doesn't have to type it again
  if (userEmail) sessionParams.customer_email = userEmail;

  // Show Stripe's built-in "Add promotion code" box on the checkout page.
  // Works for every plan — subscriptions AND the one-time Lifetime payment.
  // Any promotion code created in the Stripe dashboard works automatically —
  // no code changes ever needed when adding a new discount for someone.
  sessionParams.allow_promotion_codes = true;

  // Manual override: if a specific coupon was passed in directly (rare —
  // used only for auto-applying a discount without the customer typing it),
  // apply it instead and hide the promo box since one is already applied.
  if (couponCode) {
    sessionParams.discounts = [{ coupon: couponCode }];
    delete sessionParams.allow_promotion_codes; // Stripe doesn't allow both at once
  }

  try {
    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    // Log full detail server-side for debugging
    console.error('Stripe checkout error:', {
      message: err.message,
      type: err.type,
      param: err.param,
      code: err.code,
      sentParams: { ...sessionParams, line_items: sessionParams.line_items },
    });
    // Surface the specific failing field in the error sent to the client
    const detail = [
      err.message,
      err.param ? `(param: ${err.param})` : null,
      err.type ? `[${err.type}]` : null,
    ].filter(Boolean).join(' ');
    return res.status(500).json({ error: detail, stripeParam: err.param || null, stripeType: err.type || null });
  }
}
