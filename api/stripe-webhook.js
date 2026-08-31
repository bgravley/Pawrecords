// api/stripe-webhook.js
// Signed Stripe lifecycle handler. Billing side effects are idempotent and
// entitlement changes follow the specific product/subscription lifecycle.

export const config = { api: { bodyParser: false } };

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';
const STRIPE_API_VERSION = '2026-04-22.dahlia';
const SERVICE_HEADERS = () => ({
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendCustomerEmail({ to, subject, bodyHtml }) {
  if (!to || !RESEND_API_KEY) return;
  try {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,'Times New Roman',serif;background:#FAFCFB;margin:0;padding:20px;color:#1A2E22;">
  <div style="background:#FFFFFF;border:1px solid #DCE8E0;border-radius:16px;max-width:520px;margin:0 auto;overflow:hidden;">
    <div style="background:#2C4A38;padding:24px 28px;"><img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="220" style="display:block;height:auto;" /></div>
    <div style="padding:28px;font-size:15px;line-height:1.7;">${bodyHtml}</div>
    <div style="background:#EAF4EE;padding:16px 28px;font-size:12px;color:#6A8372;text-align:center;">YourPetPass · Health Records &amp; Travel, Simplified. · <a href="https://yourpetpass.com/contact.html" style="color:#2C4A38;">Contact us</a></div>
  </div>
</body></html>`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!response.ok) console.error('Customer email failed (non-critical):', response.status);
  } catch (error) {
    console.error('Customer email failed (non-critical):', error.message);
  }
}

const sendWelcomeEmail = (email, tierLabel) => sendCustomerEmail({
  to: email,
  subject: `Welcome to YourPetPass ${tierLabel}`,
  bodyHtml: `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#2C4A38;margin-top:0;">You're all set 🐾</h2>
    <p>Thank you for upgrading to <strong>${esc(tierLabel)}</strong>. AI document scanning, AI travel checklists, weight tracking, document storage, your emergency QR card, and full record exports are now available.</p>
    <p>You can manage a recurring subscription anytime from <strong>My Account → Billing</strong>.</p>`,
});

const sendCancellationEmail = (email) => sendCustomerEmail({
  to: email,
  subject: 'Your YourPetPass subscription has ended',
  bodyHtml: `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#2C4A38;margin-top:0;">Your subscription has ended</h2>
    <p>Your recurring YourPetPass Premium subscription is no longer active. Your pet records and documents remain saved on your account.</p>
    <p>If this was unexpected, open <strong>My Account → Billing</strong> or contact us.</p>`,
});

const sendPaymentFailedEmail = (email) => sendCustomerEmail({
  to: email,
  subject: 'Action needed for your YourPetPass payment',
  bodyHtml: `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#2C4A38;margin-top:0;">We couldn't process your payment</h2>
    <p>Stripe reported a failed subscription payment. Please open <strong>My Account → Billing</strong> to review or update your payment method.</p>
    <p>YourPetPass will follow Stripe's subscription status for access; this email by itself does not remove your records.</p>`,
});

const sendRefundEmail = (email, amountCents, message) => sendCustomerEmail({
  to: email,
  subject: 'Your YourPetPass refund has been processed',
  bodyHtml: `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#2C4A38;margin-top:0;">Refund confirmed</h2>
    <p>We've processed a refund of <strong>$${(Math.max(0, amountCents) / 100).toFixed(2)}</strong> to your original payment method. Banks commonly take several business days to post it.</p>
    <p>${esc(message || 'Your pet records and documents were not deleted.')}</p>`,
});

const sendCreditPackEmail = (email, creditAmount) => sendCustomerEmail({
  to: email,
  subject: `${creditAmount} more travel checklists added to YourPetPass`,
  bodyHtml: `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#2C4A38;margin-top:0;">Travel credits added</h2>
    <p>We've added <strong>${Number(creditAmount)} extra travel checklist generations</strong> to your account. They do not expire and are used after your included monthly generations.</p>`,
});

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

let _stripe = null;
async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  if (!_stripe) _stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

async function stripeGet(path, params = {}) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach(v => query.append(key, String(v)));
    else query.append(key, String(value));
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
    throw new Error(`Stripe read failed (${path}, ${response.status}): ${detail.slice(0, 180)}`);
  }
  return response.json();
}

async function sbRpc(name, payload) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: SERVICE_HEADERS(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase RPC ${name} failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  return response.json();
}

async function claimStripeEvent(event) {
  return sbRpc('claim_stripe_webhook_event', {
    p_event_id: event.id,
    p_event_type: event.type,
  });
}

async function finishStripeEvent(eventId, success, error = null) {
  await sbRpc('finish_stripe_webhook_event', {
    p_event_id: eventId,
    p_success: !!success,
    p_error: error ? String(error).slice(0, 1000) : null,
  });
}

async function grantTravelCreditsOnce(sessionId, userId, creditAmount) {
  const rows = await sbRpc('grant_travel_credits_once', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_credit_amount: creditAmount,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new Error('Travel credit grant returned no profile');
  return {
    email: row.customer_email || null,
    newBalance: Number(row.new_balance || 0),
    granted: row.granted === true,
  };
}

async function revokeTravelCreditsOnce(sessionId, userId, refundEventId) {
  const rows = await sbRpc('revoke_travel_credits_once', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_refund_event_id: refundEventId,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return { email: null, revoked: false, creditAmount: 0 };
  return {
    email: row.customer_email || null,
    newBalance: Number(row.new_balance || 0),
    revoked: row.revoked === true,
    creditAmount: Number(row.credit_amount || 0),
  };
}

async function fetchProfile({ userId = null, stripeCustomerId = null }) {
  let selector = null;
  if (userId) selector = `id=eq.${encodeURIComponent(userId)}`;
  else if (stripeCustomerId) selector = `stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}`;
  if (!selector) return null;

  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?${selector}&select=id,email,referral_code_used,subscription_tier,stripe_customer_id&limit=1`,
    { headers: SERVICE_HEADERS() }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Profile lookup failed (${response.status}): ${detail.slice(0, 160)}`);
  }
  const rows = await response.json();
  return rows?.[0] || null;
}

async function updateUserTier(stripeCustomerId, tier, userId = null, { preserveLifetime = true } = {}) {
  let profile = await fetchProfile({ userId, stripeCustomerId });
  if (!profile && userId && stripeCustomerId) profile = await fetchProfile({ stripeCustomerId });
  if (!profile) throw new Error('Could not match Stripe billing event to a YourPetPass profile');

  if (profile.stripe_customer_id && stripeCustomerId && profile.stripe_customer_id !== stripeCustomerId) {
    throw new Error('Stripe customer does not match the YourPetPass profile');
  }

  const nextTier = preserveLifetime && profile.subscription_tier === 'lifetime' ? 'lifetime' : tier;
  const updates = { subscription_tier: nextTier };
  if (!profile.stripe_customer_id && stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(profile.id)}`, {
    method: 'PATCH',
    headers: { ...SERVICE_HEADERS(), Prefer: 'return=representation' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Tier update failed (${response.status}): ${detail.slice(0, 160)}`);
  }
  const rows = await response.json();
  return rows?.[0] || { ...profile, ...updates };
}

async function linkStripeCustomerToProfile(userId, stripeCustomerId) {
  if (!userId || !stripeCustomerId) return;
  const profile = await fetchProfile({ userId });
  if (!profile) throw new Error('Checkout profile was not found');
  if (profile.stripe_customer_id && profile.stripe_customer_id !== stripeCustomerId) {
    throw new Error('Checkout Stripe customer conflicts with existing profile billing account');
  }
  if (profile.stripe_customer_id === stripeCustomerId) return;

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { ...SERVICE_HEADERS(), Prefer: 'return=minimal' },
    body: JSON.stringify({ stripe_customer_id: stripeCustomerId }),
  });
  if (!response.ok) throw new Error(`Could not link Stripe customer (${response.status})`);
}

function estimateNet(grossCents) {
  const fee = Math.round(Math.max(0, grossCents) * 0.029) + 30;
  return Math.max(0, grossCents - fee);
}

async function getNetCents(chargeId, grossCents) {
  if (!chargeId) return estimateNet(grossCents);
  try {
    const charge = await stripeGet(`charges/${encodeURIComponent(chargeId)}`, { 'expand[]': 'balance_transaction' });
    const bt = charge.balance_transaction;
    if (bt && typeof bt === 'object' && Number.isFinite(bt.net)) return bt.net;
  } catch (error) {
    console.error('Could not retrieve balance transaction; estimating net:', error.message);
  }
  return estimateNet(grossCents);
}

async function chargeIdFromPaymentIntent(paymentIntent) {
  if (!paymentIntent) return null;
  if (typeof paymentIntent === 'object') return paymentIntent.latest_charge || null;
  const pi = await stripeGet(`payment_intents/${encodeURIComponent(paymentIntent)}`);
  return typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id || null;
}

async function invoiceLifecycleContext(invoice) {
  const subscriptionDetails = invoice?.parent?.type === 'subscription_details'
    ? invoice.parent.subscription_details
    : null;
  const subscriptionId = subscriptionDetails?.subscription || null;
  if (!subscriptionId) return { subscriptionId: null, userId: null, chargeId: null };

  let userId = subscriptionDetails?.metadata?.userId || null;
  if (!userId) {
    try {
      const subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`);
      userId = subscription?.metadata?.userId || null;
    } catch (error) {
      console.error('Could not read subscription metadata:', error.message);
    }
  }

  let chargeId = null;
  const payments = await stripeGet('invoice_payments', {
    invoice: invoice.id,
    status: 'paid',
    limit: 5,
    'expand[]': 'data.payment.payment_intent',
  });
  for (const item of payments?.data || []) {
    const pi = item?.payment?.payment_intent;
    const latestCharge = typeof pi === 'object' ? pi.latest_charge : null;
    if (latestCharge) {
      chargeId = typeof latestCharge === 'string' ? latestCharge : latestCharge.id;
      break;
    }
  }

  return { subscriptionId, userId, chargeId };
}

async function recordCommission({ profile, grossCents, netCents, sourcePaymentId, periodMonth }) {
  if (!profile?.referral_code_used || !sourcePaymentId || netCents <= 0) return;

  const affRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/affiliates?referral_code=eq.${encodeURIComponent(profile.referral_code_used)}&status=eq.active&select=id,commission_rate&limit=1`,
    { headers: SERVICE_HEADERS() }
  );
  if (!affRes.ok) throw new Error(`Affiliate lookup failed (${affRes.status})`);
  const affiliates = await affRes.json();
  if (!affiliates?.length) return;

  const affiliate = affiliates[0];
  const rate = parseFloat(affiliate.commission_rate) || 25;
  const commissionCents = Math.round(netCents * (rate / 100));
  const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/affiliate_commissions`, {
    method: 'POST',
    headers: { ...SERVICE_HEADERS(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      affiliate_id: affiliate.id,
      referred_user_id: profile.id,
      stripe_payment_id: sourcePaymentId,
      payment_amount_cents: netCents,
      gross_amount_cents: grossCents,
      commission_rate: rate,
      commission_amount_cents: commissionCents,
      status: 'pending',
      period_month: periodMonth,
    }),
  });
  if (insertRes.status === 409) return; // unique source-payment guard: already recorded
  if (!insertRes.ok) {
    const detail = await insertRes.text().catch(() => '');
    throw new Error(`Commission insert failed (${insertRes.status}): ${detail.slice(0, 160)}`);
  }
}

async function recordRefundCommission({ sourcePaymentId, refundEventId, incrementalRefundCents, periodMonth }) {
  if (!sourcePaymentId || !refundEventId || incrementalRefundCents <= 0) return;

  // A customer can be refunded after an affiliate payout has already been
  // marked paid. Match the original positive commission by its immutable
  // Stripe payment identifier, not by its current pending/paid status.
  const originalRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/affiliate_commissions?stripe_payment_id=eq.${encodeURIComponent(sourcePaymentId)}&payment_amount_cents=gt.0&commission_amount_cents=gt.0&select=*&limit=1`,
    { headers: SERVICE_HEADERS() }
  );
  if (!originalRes.ok) throw new Error(`Original commission lookup failed (${originalRes.status})`);
  const originals = await originalRes.json();
  const original = originals?.[0];
  if (!original) return;

  const originalGross = Number(original.gross_amount_cents || 0);
  if (originalGross <= 0) return;
  const proportion = Math.min(1, incrementalRefundCents / originalGross);
  const netClawback = Math.round(Number(original.payment_amount_cents || 0) * proportion);
  const commissionClawback = Math.round(Number(original.commission_amount_cents || 0) * proportion);
  if (commissionClawback <= 0) return;

  const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/affiliate_commissions`, {
    method: 'POST',
    headers: { ...SERVICE_HEADERS(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      affiliate_id: original.affiliate_id,
      referred_user_id: original.referred_user_id,
      stripe_payment_id: refundEventId,
      payment_amount_cents: -netClawback,
      gross_amount_cents: -incrementalRefundCents,
      commission_rate: original.commission_rate,
      commission_amount_cents: -commissionClawback,
      status: 'refund',
      period_month: periodMonth,
    }),
  });
  if (insertRes.status === 409) return;
  if (!insertRes.ok) {
    const detail = await insertRes.text().catch(() => '');
    throw new Error(`Refund commission insert failed (${insertRes.status}): ${detail.slice(0, 160)}`);
  }
}

async function hasActiveSubscription(stripeCustomerId) {
  if (!stripeCustomerId) return false;
  const subs = await stripeGet('subscriptions', { customer: stripeCustomerId, status: 'all', limit: 100 });
  return (subs?.data || []).some(sub => sub.status === 'active' || sub.status === 'trialing');
}

async function resolveRefundContext(charge) {
  const piId = typeof charge?.payment_intent === 'string' ? charge.payment_intent : charge?.payment_intent?.id;
  let paymentIntent = typeof charge?.payment_intent === 'object' ? charge.payment_intent : null;
  if (piId && !paymentIntent) paymentIntent = await stripeGet(`payment_intents/${encodeURIComponent(piId)}`);

  let userId = paymentIntent?.metadata?.userId || null;
  let purchaseType = paymentIntent?.metadata?.purchaseType || null;
  let sourcePaymentId = null;
  let checkoutSession = null;
  const orderReference = paymentIntent?.payment_details?.order_reference || null;

  if (orderReference && String(orderReference).startsWith('in_')) {
    sourcePaymentId = orderReference;
    purchaseType = purchaseType || 'subscription';
  }

  if (piId && (!sourcePaymentId || !purchaseType || !userId)) {
    const sessions = await stripeGet('checkout/sessions', { payment_intent: piId, limit: 1 });
    checkoutSession = sessions?.data?.[0] || null;
    if (checkoutSession) {
      sourcePaymentId = sourcePaymentId || checkoutSession.id;
      userId = userId || checkoutSession.metadata?.userId || checkoutSession.client_reference_id || null;
      purchaseType = purchaseType || checkoutSession.metadata?.purchaseType || (checkoutSession.mode === 'subscription' ? 'subscription' : null);
    }
  }

  return { paymentIntent, checkoutSession, userId, purchaseType, sourcePaymentId };
}

function refundIncrementCents(event, charge) {
  const previous = Number(event?.data?.previous_attributes?.amount_refunded || 0);
  return Math.max(0, Number(charge?.amount_refunded || 0) - previous);
}

async function processStripeEvent(event, notifications) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = session.customer || null;
      const userId = session.metadata?.userId || session.client_reference_id || null;
      const purchaseType = session.metadata?.purchaseType || null;
      const creditAmount = parseInt(session.metadata?.creditAmount || '0', 10) || 0;

      if (!userId) throw new Error('Checkout Session is missing trusted YourPetPass user metadata');
      if (customerId) await linkStripeCustomerToProfile(userId, customerId);

      if (session.mode === 'payment' && session.payment_status !== 'paid') {
        console.log('Payment-mode Checkout completed without paid status; no entitlement granted');
        return;
      }

      if (purchaseType === 'travel_credits' && session.mode === 'payment' && creditAmount > 0) {
        const grant = await grantTravelCreditsOnce(session.id, userId, creditAmount);
        const profile = await fetchProfile({ userId });
        if (!profile) throw new Error('Travel-credit checkout profile was not found');
        const grossCents = Number(session.amount_total || 0);
        const chargeId = await chargeIdFromPaymentIntent(session.payment_intent);
        const netCents = await getNetCents(chargeId, grossCents);
        await recordCommission({
          profile,
          grossCents,
          netCents,
          sourcePaymentId: session.id,
          periodMonth: new Date().toISOString().slice(0, 7),
        });
        if (grant.granted && grant.email) notifications.push(() => sendCreditPackEmail(grant.email, creditAmount));
      } else if (purchaseType === 'lifetime' && session.mode === 'payment') {
        const profile = await updateUserTier(customerId, 'lifetime', userId, { preserveLifetime: false });
        const grossCents = Number(session.amount_total || 0);
        const chargeId = await chargeIdFromPaymentIntent(session.payment_intent);
        const netCents = await getNetCents(chargeId, grossCents);
        await recordCommission({
          profile,
          grossCents,
          netCents,
          sourcePaymentId: session.id,
          periodMonth: new Date().toISOString().slice(0, 7),
        });
        if (profile.email) notifications.push(() => sendWelcomeEmail(profile.email, 'Lifetime'));
      } else if (purchaseType === 'subscription' && session.mode === 'subscription') {
        const profile = await updateUserTier(customerId, 'premium', userId, { preserveLifetime: true });
        if (profile.email && profile.subscription_tier !== 'lifetime') notifications.push(() => sendWelcomeEmail(profile.email, 'Premium'));
      }
      return;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const context = await invoiceLifecycleContext(invoice);
      if (!context.subscriptionId) {
        console.log('Paid invoice is not subscription-backed; no subscription entitlement update');
        return;
      }
      const profile = await updateUserTier(invoice.customer, 'premium', context.userId, { preserveLifetime: true });
      const grossCents = Number(invoice.amount_paid || 0);
      const netCents = await getNetCents(context.chargeId, grossCents);
      await recordCommission({
        profile,
        grossCents,
        netCents,
        sourcePaymentId: invoice.id,
        periodMonth: new Date(Number(invoice.period_start || Math.floor(Date.now() / 1000)) * 1000).toISOString().slice(0, 7),
      });
      return;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const context = await invoiceLifecycleContext(invoice);
      if (!context.subscriptionId) return;
      const profile = await fetchProfile({ userId: context.userId, stripeCustomerId: invoice.customer });
      if (profile?.email) notifications.push(() => sendPaymentFailedEmail(profile.email));
      return;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const status = subscription.status;
      const userId = subscription.metadata?.userId || null;
      if (status === 'active' || status === 'trialing') {
        await updateUserTier(subscription.customer, 'premium', userId, { preserveLifetime: true });
      } else if (status === 'canceled' || status === 'unpaid') {
        await updateUserTier(subscription.customer, 'free', userId, { preserveLifetime: true });
      }
      // past_due alone does not immediately remove Premium; Stripe recovery
      // may still succeed and the subscription status remains the authority.
      return;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const profile = await updateUserTier(subscription.customer, 'free', subscription.metadata?.userId || null, { preserveLifetime: true });
      if (profile.email && profile.subscription_tier !== 'lifetime') notifications.push(() => sendCancellationEmail(profile.email));
      return;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const incrementalRefund = refundIncrementCents(event, charge);
      if (incrementalRefund <= 0) return;

      const context = await resolveRefundContext(charge);
      let profile = await fetchProfile({ userId: context.userId, stripeCustomerId: charge.customer });
      const fullRefund = Number(charge.amount_refunded || 0) >= Number(charge.amount || 0) && Number(charge.amount || 0) > 0;
      let refundMessage = 'Your pet records and documents were not deleted, and your subscription access was not changed by this refund.';

      if (context.purchaseType === 'travel_credits') {
        if (fullRefund && context.checkoutSession?.id && context.userId) {
          const revocation = await revokeTravelCreditsOnce(context.checkoutSession.id, context.userId, event.id);
          if (revocation.email) profile = profile || await fetchProfile({ userId: context.userId });
          refundMessage = revocation.revoked
            ? `${revocation.creditAmount} refunded travel checklist credits were removed. Your Premium/Lifetime subscription access was not changed.`
            : 'Your travel-credit purchase was refunded. Your Premium/Lifetime subscription access was not changed.';
        } else {
          refundMessage = 'This was a partial travel-credit refund, so no subscription access was changed and no whole credit pack was automatically removed.';
        }
      } else if (context.purchaseType === 'lifetime' && fullRefund) {
        if (!profile) throw new Error('Could not identify the lifetime-purchase profile for refund');
        const keepPremium = await hasActiveSubscription(charge.customer);
        profile = await updateUserTier(charge.customer, keepPremium ? 'premium' : 'free', profile.id, { preserveLifetime: false });
        refundMessage = keepPremium
          ? 'Lifetime access was removed, but your active recurring Premium subscription remains in place.'
          : 'Lifetime access was removed. Your pet records and documents remain saved on your account.';
      } else if (context.purchaseType === 'subscription') {
        refundMessage = 'This refund did not directly change your Premium access; YourPetPass follows the Stripe subscription status for entitlement.';
      }

      await recordRefundCommission({
        sourcePaymentId: context.sourcePaymentId,
        refundEventId: event.id,
        incrementalRefundCents: incrementalRefund,
        periodMonth: new Date().toISOString().slice(0, 7),
      });

      if (profile?.email) notifications.push(() => sendRefundEmail(profile.email, incrementalRefund, refundMessage));
      return;
    }

    default:
      console.log('Unhandled Stripe event type:', event.type);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Billing integration is not configured' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return res.status(503).json({ error: 'Webhook secret not configured' });
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Could not read body' });
  }

  let event;
  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], webhookSecret);
  } catch (error) {
    console.error('Stripe signature verification failed:', error.message);
    return res.status(400).json({ error: 'Webhook signature invalid' });
  }

  let claim;
  try {
    claim = await claimStripeEvent(event);
  } catch (error) {
    console.error('Could not claim Stripe event:', error.message);
    return res.status(503).json({ error: 'Could not establish webhook idempotency' });
  }

  if (claim === 'processed') return res.status(200).json({ received: true, duplicate: true });
  if (claim === 'busy') return res.status(409).json({ error: 'Webhook event is already being processed' });
  if (claim !== 'claimed') return res.status(503).json({ error: 'Could not claim webhook event' });

  const notifications = [];
  try {
    await processStripeEvent(event, notifications);
    await finishStripeEvent(event.id, true);

    // Customer email is intentionally after the billing event is durably
    // marked processed. A mail-provider outage must not cause Stripe to replay
    // financial side effects, and duplicate webhook delivery must not resend it.
    for (const notify of notifications) await notify();

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handler error:', error);
    try {
      await finishStripeEvent(event.id, false, error.message);
    } catch (finishError) {
      console.error('Could not mark Stripe event failed:', finishError.message);
    }
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
