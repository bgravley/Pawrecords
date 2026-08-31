// api/create-checkout.js
// Creates a Stripe Checkout session for subscription or one-time payment.
// Caller identity and purchasable product metadata are derived server-side;
// browser-supplied user IDs, emails, modes, purchase types, and credit amounts
// are never trusted.

import { setCorsHeaders } from './_cors.js';
import { verifyUser } from './_verifyUser.js';

const PRODUCTS = Object.freeze({
  'price_1TknmwB5s5OlwZVJsgXTq1JA': { mode: 'subscription', purchaseType: 'subscription', creditAmount: '' },
  'price_1TknmuB5s5OlwZVJLGQI4rt0': { mode: 'subscription', purchaseType: 'subscription', creditAmount: '' },
  'price_1TknmvB5s5OlwZVJU867MMjE': { mode: 'payment', purchaseType: 'lifetime', creditAmount: '' },
  'price_1TkvYNB5s5OlwZVJ737k5nA5': { mode: 'payment', purchaseType: 'travel_credits', creditAmount: '3' },
});
const REFERRAL_SIGNUP_COUPON = 'REFERRAL50FIRST';

let _stripe = null;
const getStripe = async () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured');
  if (!_stripe) _stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
  return _stripe;
};

async function referralDiscountEligible(userId) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=referral_code_used,created_at,subscription_tier&limit=1`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!response.ok) return false;
  const rows = await response.json().catch(() => []);
  const profile = rows?.[0];
  if (!profile?.referral_code_used || profile.subscription_tier !== 'free' || !profile.created_at) return false;
  const ageMs = Date.now() - new Date(profile.created_at).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 48 * 60 * 60 * 1000;
}

async function validatedDiscount(stripe, userId, priceId, rawCode) {
  const code = typeof rawCode === 'string' ? rawCode.trim().slice(0, 150) : '';
  if (!code) return null;

  // This is an internal Coupon ID, never a customer-entered promotion code.
  // Re-check eligibility server-side before allowing it to be applied.
  if (code === REFERRAL_SIGNUP_COUPON) {
    const monthlyPrice = 'price_1TknmwB5s5OlwZVJsgXTq1JA';
    if (priceId !== monthlyPrice || !(await referralDiscountEligible(userId))) {
      const error = new Error('Referral discount is not available for this checkout');
      error.status = 403;
      throw error;
    }
    return { coupon: REFERRAL_SIGNUP_COUPON };
  }

  // Customer-entered codes must resolve to an active Stripe Promotion Code.
  // Never interpret arbitrary client text as a raw Coupon ID.
  const matches = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  const promotion = matches?.data?.[0];
  if (!promotion?.id) {
    const error = new Error('That promotion code is not valid');
    error.status = 400;
    throw error;
  }
  return { promotion_code: promotion.id };
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (!auth.email) return res.status(400).json({ error: 'Your account needs an email address before checkout.' });

  const { priceId, couponCode } = req.body || {};
  const product = PRODUCTS[priceId];
  if (!product) return res.status(400).json({ error: 'That product is not available for checkout.' });

  const BASE_URL = process.env.VITE_APP_URL || 'https://yourpetpass.com';

  try {
    const stripe = await getStripe();
    const discount = await validatedDiscount(stripe, auth.userId, priceId, couponCode);

    // Keep the same trusted metadata on the Checkout Session AND on the
    // underlying PaymentIntent/Subscription. Stripe does not guarantee event
    // ordering, and refund/renewal events can arrive without the original
    // Checkout Session in hand. Propagating these server-derived values gives
    // those later lifecycle events a reliable ownership/purchase context.
    const billingMetadata = {
      userId: auth.userId,
      purchaseType: product.purchaseType,
      creditAmount: product.creditAmount || '0',
      priceId,
    };

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: product.mode,
      // Stripe replaces this literal placeholder after successful Checkout.
      // The browser uses the resulting session id only to ask our authenticated
      // API whether the signed webhook has durably confirmed the purchase.
      success_url: `${BASE_URL}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}?payment=canceled`,
      customer_email: auth.email,
      client_reference_id: auth.userId,
      metadata: billingMetadata,
    };

    if (product.mode === 'payment') {
      sessionParams.payment_intent_data = { metadata: billingMetadata };
    } else if (product.mode === 'subscription') {
      sessionParams.subscription_data = { metadata: billingMetadata };
    }

    if (discount) sessionParams.discounts = [discount];
    else sessionParams.allow_promotion_codes = true;

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    if (err?.status === 400 || err?.status === 403) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Stripe checkout error:', {
      message: err.message,
      type: err.type,
      param: err.param,
      code: err.code,
      priceId,
      userId: auth.userId,
    });
    return res.status(500).json({ error: 'Could not start checkout. Please try again, or contact support if this keeps happening.' });
  }
}
