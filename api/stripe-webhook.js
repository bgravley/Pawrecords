// api/stripe-webhook.js
// Handles Stripe payment events and updates subscription_tier in Supabase profiles

export const config = { api: { bodyParser: false } };

// One shared stripe instance per request
let _stripe = null;
const getStripe = async () => {
  if (!_stripe) _stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
  return _stripe;
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Returns the net amount in cents after Stripe fees for a given charge.
// This is what you actually receive — what the affiliate commission should be based on.
// Falls back to estimating (gross - 2.9% - $0.30) if balance transaction unavailable.
async function getNetCents(chargeId, grossCents) {
  if (!chargeId) return estimateNet(grossCents);
  try {
    const stripe = await getStripe();
    const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] });
    const bt = charge.balance_transaction;
    if (bt && typeof bt === 'object' && bt.net) {
      console.log(`Net after Stripe fees: $${(bt.net/100).toFixed(2)} (gross $${(grossCents/100).toFixed(2)}, fee $${(bt.fee/100).toFixed(2)})`);
      return bt.net;
    }
  } catch (e) {
    console.error('Could not retrieve balance transaction, estimating net:', e.message);
  }
  return estimateNet(grossCents);
}

function estimateNet(grossCents) {
  // Stripe standard US rate: 2.9% + $0.30
  // Used as fallback when balance transaction isn't available (e.g. test mode timing)
  const fee = Math.round(grossCents * 0.029) + 30;
  return Math.max(0, grossCents - fee);
}

async function linkStripeCustomerToProfile(userId, stripeCustomerId) {
  if (!userId || !stripeCustomerId) return;
  try {
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ stripe_customer_id: stripeCustomerId }),
      }
    );
    console.log(`Linked Stripe customer ${stripeCustomerId} to profile ${userId}`);
  } catch (e) {
    console.error('Failed to link Stripe customer to profile:', e.message);
  }
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

async function recordCommission({ profile, grossCents, netCents, stripeInvoiceId, periodMonth }) {
  // Commission is always on NET (after Stripe fees) — never on gross
  if (!profile?.referral_code_used || netCents <= 0) return;

  try {
    const affRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/affiliates?referral_code=eq.${profile.referral_code_used}&status=eq.active&select=id,commission_rate`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const affiliates = await affRes.json();
    if (!affiliates?.length) return;

    const affiliate = affiliates[0];
    const rate = parseFloat(affiliate.commission_rate) || 20;
    const commissionCents = Math.round(netCents * (rate / 100));

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
        payment_amount_cents: netCents,
        gross_amount_cents: grossCents,
        commission_rate: rate,
        commission_amount_cents: commissionCents,
        status: 'pending',
        period_month: periodMonth,
      }),
    });

    console.log(`Commission: ${rate}% of net $${(netCents/100).toFixed(2)} = $${(commissionCents/100).toFixed(2)} (gross $${(grossCents/100).toFixed(2)})`);
  } catch (e) {
    console.error('Commission recording failed:', e.message);
  }
}

async function recordRefund({ stripeChargeId, stripeCustomerId, refundAmountCents, periodMonth }) {
  if (!refundAmountCents || refundAmountCents <= 0) return;
  try {
    // Find the original commission using the stripe_payment_id (charge or invoice)
    const commRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/affiliate_commissions?stripe_payment_id=eq.${stripeChargeId}&status=eq.pending&select=*`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const commissions = await commRes.json();

    // Look up the user profile for this customer (need referral_code_used)
    const profRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${stripeCustomerId}&select=id,referral_code_used`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const profiles = await profRes.json();
    const profile = profiles?.[0];

    if (!profile?.referral_code_used) return; // not a referred user

    // Find affiliate
    const affRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/affiliates?referral_code=eq.${profile.referral_code_used}&select=id,commission_rate`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const affiliates = await affRes.json();
    if (!affiliates?.length) return;

    const affiliate = affiliates[0];
    const rate = parseFloat(affiliate.commission_rate) || 20;
    const refundCommissionCents = Math.round(refundAmountCents * (rate / 100));

    // Insert a NEGATIVE commission entry to represent the refund
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
        stripe_payment_id: stripeChargeId,
        payment_amount_cents: -refundAmountCents,   // negative = refund
        commission_rate: rate,
        commission_amount_cents: -refundCommissionCents, // negative = clawback
        status: 'refund',
        period_month: periodMonth,
      }),
    });

    console.log(`Refund recorded: -$${(refundCommissionCents/100).toFixed(2)} clawback for affiliate ${affiliate.id}`);
  } catch (e) {
    console.error('Refund recording failed:', e.message);
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
        const userId = session.metadata?.userId;

        // Link this Stripe customer to the Supabase profile so future
        // lookups (renewals, refunds) can find it by stripe_customer_id
        await linkStripeCustomerToProfile(userId, customerId);

        if (mode === 'payment') {
          const profile = await updateUserTier(customerId, 'lifetime');
          // One-time lifetime payment — get net after Stripe fees
          const grossCents = session.amount_total || 0;
          const netCents = await getNetCents(session.payment_intent, grossCents);
          await recordCommission({
            profile,
            grossCents,
            netCents,
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
          // Get net after Stripe fees — commission base is what we actually receive
          const grossCents = invoice.amount_paid || 0;
          const netCents = await getNetCents(invoice.charge, grossCents);
          await recordCommission({
            profile,
            grossCents,
            netCents,
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

      // Refund issued — downgrade tier AND record a negative commission (clawback)
      case 'charge.refunded': {
        const charge = event.data.object;

        // Downgrade the user back to free immediately on any refund
        await updateUserTier(charge.customer, 'free');

        await recordRefund({
          stripeChargeId: charge.id,
          stripeCustomerId: charge.customer,
          refundAmountCents: charge.amount_refunded || 0,
          periodMonth: new Date().toISOString().slice(0, 7),
        });
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
