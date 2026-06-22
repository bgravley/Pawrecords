// api/stripe-webhook.js
// Handles Stripe payment events and updates subscription_tier in Supabase profiles

export const config = { api: { bodyParser: false } };

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';

// Shared email wrapper — consistent branding across all transactional emails
async function sendCustomerEmail({ to, subject, bodyHtml }) {
  if (!to || !RESEND_API_KEY) return;
  try {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAF6F0; margin: 0; padding: 20px; }
  .card { background: #FFFFFF; border-radius: 16px; max-width: 520px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .header { background: #1E5C52; padding: 24px 28px; text-align: center; }
  .header h1 { color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700; }
  .header p { color: #A8D5CE; margin: 4px 0 0; font-size: 13px; font-style: italic; }
  .body { padding: 28px; color: #5A4535; font-size: 15px; line-height: 1.7; }
  .body h2 { color: #1E5C52; font-size: 19px; margin: 0 0 12px; }
  .footer { background: #F4EFE8; padding: 16px 28px; font-size: 12px; color: #8B7355; text-align: center; }
</style></head>
<body>
  <div class="card">
    <div class="header"><h1>🐾 YourPetPass</h1><p>Your pet's health passport</p></div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">YourPetPass · yourpetpass.com · Questions? <a href="https://yourpetpass.com/contact.html" style="color:#2D7D6F;">Contact us</a></div>
  </div>
</body>
</html>`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
  } catch (e) {
    console.error('Customer email failed (non-critical):', e.message);
  }
}

const sendWelcomeEmail = (email, tierLabel) => sendCustomerEmail({
  to: email,
  subject: `🎉 Welcome to YourPetPass ${tierLabel}!`,
  bodyHtml: `
    <h2>You're all set! 🐾</h2>
    <p>Thank you for upgrading to <strong>${tierLabel}</strong>. Here's what's now unlocked on your account:</p>
    <ul style="padding-left:20px;">
      <li>AI Document Scanning</li>
      <li>AI Travel Checklists</li>
      <li>Weight Tracking with trend charts</li>
      <li>Document Storage</li>
      <li>QR Health Card for emergencies</li>
      <li>Full record exports</li>
    </ul>
    <p>You can manage your subscription anytime from <strong>My Account → Billing</strong>.</p>
    <p>Welcome aboard!</p>`
});

const sendCancellationEmail = (email) => sendCustomerEmail({
  to: email,
  subject: `Your YourPetPass subscription has been cancelled`,
  bodyHtml: `
    <h2>We're sorry to see you go</h2>
    <p>Your YourPetPass Premium subscription has been cancelled. You'll continue to have Premium access through the end of your current billing period — after that, your account moves to the Free plan.</p>
    <p><strong>Good news:</strong> nothing is deleted. All your pets' records, documents, and history stay safely on your account. If you upgrade again later, everything picks up right where you left off.</p>
    <p>If this was a mistake or you have any feedback, just reply to this email — we'd love to hear from you.</p>`
});

const sendRefundEmail = (email, amountCents) => sendCustomerEmail({
  to: email,
  subject: `Your YourPetPass refund has been processed`,
  bodyHtml: `
    <h2>Refund confirmed</h2>
    <p>We've processed a refund of <strong>$${(amountCents/100).toFixed(2)}</strong> to your original payment method. It typically takes 5–10 business days to appear on your statement, depending on your bank.</p>
    <p>Your account has been moved back to the Free plan. As always, none of your pets' data was affected — everything is saved and ready whenever you'd like to upgrade again.</p>
    <p>If you have any questions about this refund, just reply to this email.</p>`
});

const sendCreditPackEmail = (email, creditAmount) => sendCustomerEmail({
  to: email,
  subject: `🎉 ${creditAmount} more travel checklists added to your account`,
  bodyHtml: `
    <h2>You're all set!</h2>
    <p>We've added <strong>${creditAmount} extra travel checklist generations</strong> to your account — these don't expire and are used automatically once your monthly included checklists run out.</p>
    <p>Plan your next trip anytime from the Travel tab.</p>`
});

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

async function addTravelCredits(userId, creditAmount) {
  if (!userId || !creditAmount) return null;
  try {
    // Get current balance + email so we can return the email for the receipt
    const profRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,email,travel_credits_balance`,
      { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const profiles = await profRes.json();
    const profile = profiles?.[0];
    if (!profile) return null;

    const newBalance = (profile.travel_credits_balance || 0) + creditAmount;
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ travel_credits_balance: newBalance }),
    });

    console.log(`Added ${creditAmount} travel credits to ${profile.email} (new balance: ${newBalance})`);
    return profile;
  } catch (e) {
    console.error('Failed to add travel credits:', e.message);
    return null;
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
        const purchaseType = session.metadata?.purchaseType;
        const creditAmount = parseInt(session.metadata?.creditAmount) || 0;

        // Link this Stripe customer to the Supabase profile so future
        // lookups (renewals, refunds) can find it by stripe_customer_id
        await linkStripeCustomerToProfile(userId, customerId);

        if (purchaseType === 'travel_credits' && creditAmount > 0) {
          // Add purchased checklist credits — does NOT touch subscription tier
          const profile = await addTravelCredits(userId, creditAmount);
          if (profile?.email) await sendCreditPackEmail(profile.email, creditAmount);
          // Still record commission for affiliates on this purchase
          const grossCents = session.amount_total || 0;
          const netCents = await getNetCents(session.payment_intent, grossCents);
          await recordCommission({
            profile, grossCents, netCents,
            stripeInvoiceId: session.id,
            periodMonth: new Date().toISOString().slice(0, 7),
          });
        } else if (mode === 'payment') {
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
          if (profile?.email) await sendWelcomeEmail(profile.email, 'Lifetime');
        } else if (mode === 'subscription') {
          const profile = await updateUserTier(customerId, 'premium');
          if (profile?.email) await sendWelcomeEmail(profile.email, 'Premium');
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
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const profile = await updateUserTier(sub.customer, 'free');
        if (profile?.email) await sendCancellationEmail(profile.email);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await updateUserTier(invoice.customer, 'free');
        // Note: no email sent here yet — a "payment failed, update your card"
        // email would need different messaging than cancellation. Can add later.
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
        const profile = await updateUserTier(charge.customer, 'free');
        if (profile?.email) await sendRefundEmail(profile.email, charge.amount_refunded || 0);

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
