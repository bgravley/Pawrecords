// api/stripe-webhook.js
// Handles Stripe payment events and updates subscription_tier in Supabase profiles

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function updateUserTier(stripeCustomerId, tier) {
  // Find profile by stripe_customer_id
  const searchRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${stripeCustomerId}&select=id,email`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      }
    }
  );
  const profiles = await searchRes.json();
  if (!profiles?.length) {
    console.error('No profile found for Stripe customer:', stripeCustomerId);
    return false;
  }

  const profile = profiles[0];
  await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ subscription_tier: tier })
    }
  );

  console.log(`Updated ${profile.email} to tier: ${tier}`);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Could not read body' });
  }

  // Verify Stripe signature
  let event;
  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
  }

  console.log('Stripe event received:', event.type);

  try {
    switch (event.type) {
      // Payment succeeded — activate subscription
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const mode = session.mode;

        if (mode === 'payment') {
          // One-time payment = lifetime
          await updateUserTier(customerId, 'lifetime');
        } else if (mode === 'subscription') {
          // Subscription = premium
          await updateUserTier(customerId, 'premium');
        }
        break;
      }

      // Subscription renewed
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await updateUserTier(invoice.customer, 'premium');
        }
        break;
      }

      // Subscription cancelled or payment failed
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj = event.data.object;
        const customerId = obj.customer;
        await updateUserTier(customerId, 'free');
        break;
      }

      // Subscription updated (e.g. plan change)
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status = sub.status;
        const customerId = sub.customer;
        if (status === 'active' || status === 'trialing') {
          await updateUserTier(customerId, 'premium');
        } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
          await updateUserTier(customerId, 'free');
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
