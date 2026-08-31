import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';

process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'service-test-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_yourpetpass_behavior';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_yourpetpass_behavior';
delete process.env.RESEND_API_KEY;

const { default: handler } = await import('../api/stripe-webhook.js');

let state;

function resetState() {
  state = {
    profiles: new Map(),
    events: new Map(),
    creditGrants: new Map(),
    commissions: [],
    affiliates: new Map([['AFF25', { id: 'aff_25', commission_rate: 25 }]]),
    paymentIntents: new Map(),
    charges: new Map(),
    invoicePayments: new Map(),
    subscriptions: new Map(),
    subscriptionsByCustomer: new Map(),
    checkoutSessionsByPaymentIntent: new Map(),
  };
}

function seedProfile(id, { tier = 'free', referral = null, customer = null, credits = 0 } = {}) {
  const profile = {
    id,
    email: `${id}@example.com`,
    referral_code_used: referral,
    subscription_tier: tier,
    stripe_customer_id: customer,
    travel_credits_balance: credits,
  };
  state.profiles.set(id, profile);
  return profile;
}

function jsonResponse(value, status = 200) {
  return new Response(value === null ? null : JSON.stringify(value), {
    status,
    headers: value === null ? {} : { 'Content-Type': 'application/json' },
  });
}

function stripOperator(value, operator = 'eq.') {
  return value?.startsWith(operator) ? value.slice(operator.length) : value;
}

function profileByCustomer(customerId) {
  return [...state.profiles.values()].find(profile => profile.stripe_customer_id === customerId) || null;
}

function profileResult(profile) {
  if (!profile) return [];
  const { travel_credits_balance, ...selected } = profile;
  return [selected];
}

async function mockFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = String(init.method || 'GET').toUpperCase();

  if (url.origin === 'https://mock.supabase.co') {
    const path = url.pathname;

    if (path.startsWith('/rest/v1/rpc/')) {
      const rpc = path.split('/').pop();
      const body = init.body ? JSON.parse(init.body) : {};

      if (rpc === 'claim_stripe_webhook_event') {
        const existing = state.events.get(body.p_event_id);
        if (existing?.status === 'processed') return jsonResponse('processed');
        if (existing?.status === 'processing') return jsonResponse('busy');
        state.events.set(body.p_event_id, { type: body.p_event_type, status: 'processing', error: null });
        return jsonResponse('claimed');
      }

      if (rpc === 'finish_stripe_webhook_event') {
        const existing = state.events.get(body.p_event_id) || {};
        state.events.set(body.p_event_id, {
          ...existing,
          status: body.p_success ? 'processed' : 'failed',
          error: body.p_error || null,
        });
        return jsonResponse(null);
      }

      if (rpc === 'grant_travel_credits_once') {
        const profile = state.profiles.get(body.p_user_id);
        if (!profile) return jsonResponse({ message: 'profile missing' }, 404);
        const existing = state.creditGrants.get(body.p_session_id);
        if (existing) {
          return jsonResponse([{
            customer_email: profile.email,
            new_balance: profile.travel_credits_balance,
            granted: false,
          }]);
        }
        profile.travel_credits_balance += Number(body.p_credit_amount || 0);
        state.creditGrants.set(body.p_session_id, {
          userId: body.p_user_id,
          amount: Number(body.p_credit_amount || 0),
          revokedBy: null,
        });
        return jsonResponse([{
          customer_email: profile.email,
          new_balance: profile.travel_credits_balance,
          granted: true,
        }]);
      }

      if (rpc === 'revoke_travel_credits_once') {
        const grant = state.creditGrants.get(body.p_session_id);
        const profile = grant ? state.profiles.get(grant.userId) : null;
        if (!grant || !profile || grant.userId !== body.p_user_id) return jsonResponse([]);
        if (grant.revokedBy) {
          return jsonResponse([{
            customer_email: profile.email,
            new_balance: profile.travel_credits_balance,
            revoked: false,
            credit_amount: grant.amount,
          }]);
        }
        profile.travel_credits_balance = Math.max(0, profile.travel_credits_balance - grant.amount);
        grant.revokedBy = body.p_refund_event_id;
        return jsonResponse([{
          customer_email: profile.email,
          new_balance: profile.travel_credits_balance,
          revoked: true,
          credit_amount: grant.amount,
        }]);
      }

      throw new Error(`Unhandled mock Supabase RPC: ${rpc}`);
    }

    if (path === '/rest/v1/profiles') {
      if (method === 'GET') {
        const id = stripOperator(url.searchParams.get('id'));
        const customer = stripOperator(url.searchParams.get('stripe_customer_id'));
        const profile = id ? state.profiles.get(id) : profileByCustomer(customer);
        return jsonResponse(profileResult(profile));
      }
      if (method === 'PATCH') {
        const id = stripOperator(url.searchParams.get('id'));
        const profile = state.profiles.get(id);
        if (!profile) return jsonResponse({ message: 'profile missing' }, 404);
        Object.assign(profile, JSON.parse(init.body || '{}'));
        return jsonResponse(profileResult(profile));
      }
    }

    if (path === '/rest/v1/affiliates' && method === 'GET') {
      const referral = stripOperator(url.searchParams.get('referral_code'));
      const affiliate = state.affiliates.get(referral);
      return jsonResponse(affiliate ? [affiliate] : []);
    }

    if (path === '/rest/v1/affiliate_commissions') {
      if (method === 'GET') {
        const paymentId = stripOperator(url.searchParams.get('stripe_payment_id'));
        const matches = state.commissions.filter(row =>
          row.stripe_payment_id === paymentId &&
          Number(row.payment_amount_cents || 0) > 0 &&
          Number(row.commission_amount_cents || 0) > 0
        );
        return jsonResponse(matches.slice(0, 1));
      }
      if (method === 'POST') {
        const row = JSON.parse(init.body || '{}');
        if (state.commissions.some(existing => existing.stripe_payment_id === row.stripe_payment_id)) {
          return jsonResponse({ message: 'duplicate' }, 409);
        }
        state.commissions.push(row);
        return jsonResponse(null, 201);
      }
    }

    throw new Error(`Unhandled mock Supabase request: ${method} ${url.href}`);
  }

  if (url.origin === 'https://api.stripe.com') {
    const path = url.pathname.replace(/^\/v1\//, '');

    if (path.startsWith('payment_intents/')) {
      const id = decodeURIComponent(path.split('/')[1]);
      return jsonResponse(state.paymentIntents.get(id) || { id });
    }

    if (path.startsWith('charges/')) {
      const id = decodeURIComponent(path.split('/')[1]);
      return jsonResponse(state.charges.get(id) || { id });
    }

    if (path === 'invoice_payments') {
      const invoiceId = url.searchParams.get('invoice');
      return jsonResponse({ data: state.invoicePayments.get(invoiceId) || [] });
    }

    if (path.startsWith('subscriptions/')) {
      const id = decodeURIComponent(path.split('/')[1]);
      return jsonResponse(state.subscriptions.get(id) || { id, metadata: {} });
    }

    if (path === 'subscriptions') {
      const customer = url.searchParams.get('customer');
      return jsonResponse({ data: state.subscriptionsByCustomer.get(customer) || [] });
    }

    if (path === 'checkout/sessions') {
      const pi = url.searchParams.get('payment_intent');
      return jsonResponse({ data: state.checkoutSessionsByPaymentIntent.get(pi) || [] });
    }

    throw new Error(`Unhandled mock Stripe request: ${method} ${url.href}`);
  }

  throw new Error(`Unexpected external fetch in Stripe behavior test: ${method} ${url.href}`);
}

globalThis.fetch = mockFetch;

function signedHeader(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.body = null;
    this.headers = {};
  }
  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  json(value) {
    this.body = value;
    return this;
  }
  end() {
    return this;
  }
}

async function deliver(event) {
  const payload = JSON.stringify({ object: 'event', ...event });
  const req = Readable.from([Buffer.from(payload)]);
  req.method = 'POST';
  req.headers = { 'stripe-signature': signedHeader(payload) };
  const res = new MockResponse();
  await handler(req, res);
  return res;
}

function checkoutEvent({ id, sessionId, userId, customer, purchaseType, mode, paymentStatus, paymentIntent = null, creditAmount = '0', amountTotal = 0 }) {
  return {
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        customer,
        mode,
        payment_status: paymentStatus,
        payment_intent: paymentIntent,
        amount_total: amountTotal,
        client_reference_id: userId,
        metadata: { userId, purchaseType, creditAmount },
      },
    },
  };
}

function invoiceEvent({ id, type = 'invoice.payment_succeeded', invoiceId, userId, customer, subscriptionId, amountPaid = 0, billingReason = 'subscription_cycle' }) {
  return {
    id,
    type,
    data: {
      object: {
        id: invoiceId,
        object: 'invoice',
        customer,
        amount_paid: amountPaid,
        billing_reason: billingReason,
        period_start: 1788180000,
        parent: {
          type: 'subscription_details',
          subscription_details: {
            subscription: subscriptionId,
            metadata: { userId },
          },
        },
      },
    },
  };
}

test.beforeEach(() => resetState());

test('subscription Checkout links Stripe customer but never grants Premium before paid lifecycle', async () => {
  seedProfile('u_sub', { tier: 'free' });

  const unpaid = checkoutEvent({
    id: 'evt_sub_unpaid', sessionId: 'cs_sub_unpaid', userId: 'u_sub', customer: 'cus_sub',
    purchaseType: 'subscription', mode: 'subscription', paymentStatus: 'unpaid',
  });
  const first = await deliver(unpaid);
  assert.equal(first.statusCode, 200);
  assert.equal(state.profiles.get('u_sub').stripe_customer_id, 'cus_sub');
  assert.equal(state.profiles.get('u_sub').subscription_tier, 'free');

  const paidCheckout = checkoutEvent({
    id: 'evt_sub_checkout_paid', sessionId: 'cs_sub_paid', userId: 'u_sub', customer: 'cus_sub',
    purchaseType: 'subscription', mode: 'subscription', paymentStatus: 'paid',
  });
  const second = await deliver(paidCheckout);
  assert.equal(second.statusCode, 200);
  assert.equal(state.profiles.get('u_sub').subscription_tier, 'free');
});

test('successful initial invoice activates Premium and Stripe retry does not duplicate affiliate commission', async () => {
  seedProfile('u_invoice', { tier: 'free', referral: 'AFF25', customer: 'cus_invoice' });
  state.invoicePayments.set('in_initial', [{ payment: { payment_intent: { id: 'pi_initial', latest_charge: 'ch_initial' } } }]);
  state.charges.set('ch_initial', { id: 'ch_initial', balance_transaction: { net: 450 } });

  const event = invoiceEvent({
    id: 'evt_invoice_initial', invoiceId: 'in_initial', userId: 'u_invoice', customer: 'cus_invoice',
    subscriptionId: 'sub_invoice', amountPaid: 499, billingReason: 'subscription_create',
  });

  const first = await deliver(event);
  assert.equal(first.statusCode, 200);
  assert.equal(state.profiles.get('u_invoice').subscription_tier, 'premium');
  assert.equal(state.commissions.length, 1);
  assert.equal(state.commissions[0].stripe_payment_id, 'in_initial');
  assert.equal(state.commissions[0].payment_amount_cents, 450);
  assert.equal(state.commissions[0].commission_amount_cents, 113);

  const retry = await deliver(event);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body?.duplicate, true);
  assert.equal(state.commissions.length, 1);
});

test('renewal succeeds on the 2026 invoice shape and failed payment does not immediately downgrade', async () => {
  seedProfile('u_renew', { tier: 'premium', customer: 'cus_renew' });
  state.invoicePayments.set('in_renew', [{ payment: { payment_intent: { id: 'pi_renew', latest_charge: 'ch_renew' } } }]);
  state.charges.set('ch_renew', { id: 'ch_renew', balance_transaction: { net: 3700 } });

  const renewal = await deliver(invoiceEvent({
    id: 'evt_renew', invoiceId: 'in_renew', userId: 'u_renew', customer: 'cus_renew',
    subscriptionId: 'sub_renew', amountPaid: 3999, billingReason: 'subscription_cycle',
  }));
  assert.equal(renewal.statusCode, 200);
  assert.equal(state.profiles.get('u_renew').subscription_tier, 'premium');

  state.invoicePayments.set('in_failed', []);
  const failed = await deliver(invoiceEvent({
    id: 'evt_failed', type: 'invoice.payment_failed', invoiceId: 'in_failed', userId: 'u_renew', customer: 'cus_renew',
    subscriptionId: 'sub_renew', amountPaid: 0, billingReason: 'subscription_cycle',
  }));
  assert.equal(failed.statusCode, 200);
  assert.equal(state.profiles.get('u_renew').subscription_tier, 'premium');
});

test('subscription status controls recovery/cancellation while lifetime is preserved', async () => {
  seedProfile('u_status', { tier: 'premium', customer: 'cus_status' });

  await deliver({
    id: 'evt_past_due', type: 'customer.subscription.updated',
    data: { object: { id: 'sub_status', customer: 'cus_status', status: 'past_due', metadata: { userId: 'u_status' } } },
  });
  assert.equal(state.profiles.get('u_status').subscription_tier, 'premium');

  await deliver({
    id: 'evt_unpaid', type: 'customer.subscription.updated',
    data: { object: { id: 'sub_status', customer: 'cus_status', status: 'unpaid', metadata: { userId: 'u_status' } } },
  });
  assert.equal(state.profiles.get('u_status').subscription_tier, 'free');

  seedProfile('u_life_status', { tier: 'lifetime', customer: 'cus_life_status' });
  await deliver({
    id: 'evt_deleted_lifetime', type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_old', customer: 'cus_life_status', status: 'canceled', metadata: { userId: 'u_life_status' } } },
  });
  assert.equal(state.profiles.get('u_life_status').subscription_tier, 'lifetime');
});

test('travel-credit packs grant once across distinct events and full refund revokes once without touching Premium', async () => {
  seedProfile('u_credit', { tier: 'premium', referral: 'AFF25', customer: 'cus_credit' });
  state.paymentIntents.set('pi_credit', {
    id: 'pi_credit', latest_charge: 'ch_credit', metadata: { userId: 'u_credit', purchaseType: 'travel_credits' },
  });
  state.charges.set('ch_credit', { id: 'ch_credit', balance_transaction: { net: 260 } });
  const sessionObject = {
    id: 'cs_credit', mode: 'payment', client_reference_id: 'u_credit',
    metadata: { userId: 'u_credit', purchaseType: 'travel_credits', creditAmount: '3' },
  };
  state.checkoutSessionsByPaymentIntent.set('pi_credit', [sessionObject]);

  const purchase = checkoutEvent({
    id: 'evt_credit_1', sessionId: 'cs_credit', userId: 'u_credit', customer: 'cus_credit',
    purchaseType: 'travel_credits', mode: 'payment', paymentStatus: 'paid', paymentIntent: 'pi_credit',
    creditAmount: '3', amountTotal: 299,
  });
  assert.equal((await deliver(purchase)).statusCode, 200);
  assert.equal(state.profiles.get('u_credit').travel_credits_balance, 3);
  assert.equal(state.commissions.filter(row => row.stripe_payment_id === 'cs_credit').length, 1);

  const distinctDuplicate = structuredClone(purchase);
  distinctDuplicate.id = 'evt_credit_2';
  assert.equal((await deliver(distinctDuplicate)).statusCode, 200);
  assert.equal(state.profiles.get('u_credit').travel_credits_balance, 3);
  assert.equal(state.commissions.filter(row => row.stripe_payment_id === 'cs_credit').length, 1);

  state.commissions.find(row => row.stripe_payment_id === 'cs_credit').status = 'paid';
  const refund = {
    id: 'evt_credit_refund', type: 'charge.refunded',
    data: { object: { id: 'ch_credit', customer: 'cus_credit', amount: 299, amount_refunded: 299, payment_intent: 'pi_credit' } },
  };
  assert.equal((await deliver(refund)).statusCode, 200);
  assert.equal(state.profiles.get('u_credit').travel_credits_balance, 0);
  assert.equal(state.profiles.get('u_credit').subscription_tier, 'premium');
  const clawback = state.commissions.find(row => row.stripe_payment_id === 'evt_credit_refund');
  assert.equal(clawback.status, 'refund');
  assert.equal(clawback.commission_rate, 25);
  assert.equal(clawback.commission_amount_cents, -65);

  const retry = await deliver(refund);
  assert.equal(retry.body?.duplicate, true);
  assert.equal(state.profiles.get('u_credit').travel_credits_balance, 0);
  assert.equal(state.commissions.filter(row => row.stripe_payment_id === 'evt_credit_refund').length, 1);
});

test('Lifetime full refund removes Lifetime, but an active recurring subscription falls back to Premium', async () => {
  seedProfile('u_life', { tier: 'free', customer: 'cus_life' });
  state.paymentIntents.set('pi_life', { id: 'pi_life', latest_charge: 'ch_life', metadata: { userId: 'u_life', purchaseType: 'lifetime' } });
  state.charges.set('ch_life', { id: 'ch_life', balance_transaction: { net: 8500 } });
  state.checkoutSessionsByPaymentIntent.set('pi_life', [{ id: 'cs_life', mode: 'payment', client_reference_id: 'u_life', metadata: { userId: 'u_life', purchaseType: 'lifetime' } }]);

  await deliver(checkoutEvent({
    id: 'evt_life_buy', sessionId: 'cs_life', userId: 'u_life', customer: 'cus_life',
    purchaseType: 'lifetime', mode: 'payment', paymentStatus: 'paid', paymentIntent: 'pi_life', amountTotal: 8999,
  }));
  assert.equal(state.profiles.get('u_life').subscription_tier, 'lifetime');

  state.subscriptionsByCustomer.set('cus_life', []);
  await deliver({
    id: 'evt_life_refund', type: 'charge.refunded',
    data: { object: { id: 'ch_life', customer: 'cus_life', amount: 8999, amount_refunded: 8999, payment_intent: 'pi_life' } },
  });
  assert.equal(state.profiles.get('u_life').subscription_tier, 'free');

  seedProfile('u_life_with_sub', { tier: 'lifetime', customer: 'cus_life_with_sub' });
  state.paymentIntents.set('pi_life_with_sub', { id: 'pi_life_with_sub', metadata: { userId: 'u_life_with_sub', purchaseType: 'lifetime' } });
  state.checkoutSessionsByPaymentIntent.set('pi_life_with_sub', [{ id: 'cs_life_with_sub', mode: 'payment', client_reference_id: 'u_life_with_sub', metadata: { userId: 'u_life_with_sub', purchaseType: 'lifetime' } }]);
  state.subscriptionsByCustomer.set('cus_life_with_sub', [{ id: 'sub_active', status: 'active' }]);
  await deliver({
    id: 'evt_life_with_sub_refund', type: 'charge.refunded',
    data: { object: { id: 'ch_life_with_sub', customer: 'cus_life_with_sub', amount: 8999, amount_refunded: 8999, payment_intent: 'pi_life_with_sub' } },
  });
  assert.equal(state.profiles.get('u_life_with_sub').subscription_tier, 'premium');
});

test('subscription refund does not directly remove Premium and claws back a paid affiliate commission using original economics', async () => {
  seedProfile('u_sub_refund', { tier: 'premium', customer: 'cus_sub_refund' });
  state.paymentIntents.set('pi_sub_refund', {
    id: 'pi_sub_refund',
    metadata: { userId: 'u_sub_refund', purchaseType: 'subscription' },
    payment_details: { order_reference: 'in_sub_refund' },
  });
  state.commissions.push({
    affiliate_id: 'aff_25', referred_user_id: 'u_sub_refund', stripe_payment_id: 'in_sub_refund',
    payment_amount_cents: 3700, gross_amount_cents: 3999, commission_rate: 25,
    commission_amount_cents: 925, status: 'paid', period_month: '2026-08',
  });

  const refund = await deliver({
    id: 'evt_sub_refund', type: 'charge.refunded',
    data: { object: { id: 'ch_sub_refund', customer: 'cus_sub_refund', amount: 3999, amount_refunded: 3999, payment_intent: 'pi_sub_refund' } },
  });
  assert.equal(refund.statusCode, 200);
  assert.equal(state.profiles.get('u_sub_refund').subscription_tier, 'premium');
  const clawback = state.commissions.find(row => row.stripe_payment_id === 'evt_sub_refund');
  assert.equal(clawback.payment_amount_cents, -3700);
  assert.equal(clawback.commission_amount_cents, -925);
  assert.equal(clawback.commission_rate, 25);
});

test('busy event claim returns retryable 409 without side effects', async () => {
  seedProfile('u_busy', { tier: 'free' });
  state.events.set('evt_busy', { status: 'processing' });
  const res = await deliver(checkoutEvent({
    id: 'evt_busy', sessionId: 'cs_busy', userId: 'u_busy', customer: 'cus_busy',
    purchaseType: 'lifetime', mode: 'payment', paymentStatus: 'paid', paymentIntent: 'pi_busy', amountTotal: 8999,
  }));
  assert.equal(res.statusCode, 409);
  assert.equal(state.profiles.get('u_busy').subscription_tier, 'free');
});
