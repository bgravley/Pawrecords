// api/create-portal-session.js
// Creates a real Stripe Customer Portal session so users can manage
// or cancel their subscription. Replaces the hardcoded placeholder URL.

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

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const BASE_URL = process.env.VITE_APP_URL || 'https://yourpetpass.com';

  try {
    // Look up the user's Stripe customer ID from their Supabase profile
    const profRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=stripe_customer_id`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        }
      }
    );
    if (!profRes.ok) {
      console.error('Profile lookup failed for billing portal:', profRes.status, await profRes.text().catch(() => ''));
      return res.status(502).json({ error: 'Could not load your billing info right now — please try again.' });
    }
    const profiles = await profRes.json();
    const stripeCustomerId = profiles?.[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      return res.status(404).json({
        error: 'No billing account found yet. This appears once you complete your first checkout.'
      });
    }

    const stripe = await getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: BASE_URL,
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe portal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
