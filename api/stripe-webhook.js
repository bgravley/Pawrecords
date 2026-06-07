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
  const searchRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${stripeCustomerId}&select=id,email,referral_code_used`,
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
    return null;
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
  return profile; // return full profile so we can use it for commission calc
}

async function recordCommission({ profile, amountCents, stripeInvoiceId, periodMonth }) {
  if (!profile?.referral_code_used || amountCents <= 0) return;

  try {
    // Look up the affiliate by referral code
    const affRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/affiliates?referral_code=eq.${profile.referral_code_used}&status=eq.active&select=id,commission_rate`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        }
      }
    );
    const affiliates = await affRes.json();
    if (!affiliates?.length) return; // code not found or affiliate inactive

    const affiliate = affiliates[0];
    const rate = parseFloat(affiliate.commission_rate) || 20;
    const commissionCents = Math.round(amountCents * (rate / 100));

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/affiliate_commissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        affiliate_id: affiliate.id,
        referred_user_id: profile.id,
        stripe_payment_id: stripeInvoiceId,
        payment_amount_cents: amountCents,
        commission_rate: rate,
        commission_amount_cents: commissionCents,
        status: 'pending',
        period_month: periodMonth,
      }),
    });

    console.log(`Commission recorded: $${(commissionCents/100).toFixed(2)} for affiliate ${affiliate.id}`);
  } catch (e) {
    console.error('Commission recording failed:', e.message);
    // Never let commission errors break the webhook
  }
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
          const profile = await updateUserTier(customerId, 'lifetime');
          // One-time lifetime payment — record commission once
          await recordCommission({
            profile,
            amountCents: session.amount_total || 0,
            stripeInvoiceId: session.id,
            periodMonth: new Date().toISOString().slice(0, 7),
          });
        } else if (mode === 'subscription') {
          await updateUserTier(customerId, 'premium');
          // Commission for subscription is recorded on invoice.payment_succeeded
        }
        break;
      }

      // Subscription renewed — this fires for every monthly/annual payment
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const profile = await updateUserTier(invoice.customer, 'premium');
          await recordCommission({
            profile,
            amountCents: invoice.amount_paid || 0,
            stripeInvoiceId: invoice.id,
            periodMonth: new Date(invoice.period_start * 1000).toISOString().slice(0, 7),
          });
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
