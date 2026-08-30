from pathlib import Path

webhook = Path('api/stripe-webhook.js').read_text(encoding='utf-8', errors='ignore')
checkout = Path('api/create-checkout.js').read_text(encoding='utf-8', errors='ignore')
migration = Path('supabase/migrations/20260830093208_stripe_webhook_idempotency_foundation.sql').read_text(encoding='utf-8', errors='ignore').lower()

checks = {
    'Stripe signature is verified against the raw request body': (
        'bodyParser: false' in webhook and
        'webhooks.constructEvent(rawBody' in webhook and
        "req.headers['stripe-signature']" in webhook
    ),
    'missing Stripe webhook secret fails closed': (
        'STRIPE_WEBHOOK_SECRET' in webhook and
        "status(503).json({ error: 'Webhook secret not configured' })" in webhook
    ),
    'billing events are atomically claimed by Stripe event id': (
        "claim_stripe_webhook_event" in webhook and
        'p_event_id: event.id' in webhook and
        "claim === 'processed'" in webhook and
        "claim === 'busy'" in webhook
    ),
    'billing event claims are durably finished on success and failure': (
        'await finishStripeEvent(event.id, true)' in webhook and
        'await finishStripeEvent(event.id, false, error.message)' in webhook
    ),
    'customer email runs only after durable successful event completion': (
        webhook.find('await finishStripeEvent(event.id, true)') < webhook.find('for (const notify of notifications) await notify()')
    ),
    'travel credits use the atomic one-time grant RPC': (
        "grant_travel_credits_once" in webhook and
        'grantTravelCreditsOnce(session.id, userId, creditAmount)' in webhook
    ),
    'legacy read-modify-write travel credit grant is gone': (
        'travel_credits_balance: newBalance' not in webhook and
        'currentBalance + creditAmount' not in webhook
    ),
    'travel-credit refunds use a one-time revocation RPC': (
        'revoke_travel_credits_once' in webhook and
        'revokeTravelCreditsOnce(context.checkoutSession.id, context.userId, event.id)' in webhook
    ),
    '2026 Stripe invoice subscription path is supported': (
        'invoice?.parent?.subscription_details?.subscription' in webhook
    ),
    'renewal charge is resolved through the current invoice payments resource': (
        "stripeGet('invoice_payments'" in webhook and
        "'expand[]': 'data.payment.payment_intent'" in webhook and
        'pi.latest_charge' in webhook
    ),
    'renewal handler no longer gates only on legacy top-level invoice.subscription': (
        'if (invoice.subscription)' not in webhook
    ),
    'renewal commission no longer reads legacy invoice.charge': (
        'getNetCents(invoice.charge' not in webhook
    ),
    'payment failed sends recovery email without immediate entitlement downgrade': (
        "case 'invoice.payment_failed'" in webhook and
        'sendPaymentFailedEmail' in webhook and
        "updateUserTier(invoice.customer, 'free'" not in webhook
    ),
    'subscription status is authoritative for recurring entitlement': (
        "case 'customer.subscription.updated'" in webhook and
        "status === 'active' || status === 'trialing'" in webhook and
        "status === 'canceled' || status === 'unpaid'" in webhook
    ),
    'past_due is not treated as immediate cancellation': (
        "status === 'past_due'" not in webhook
    ),
    'refund handler distinguishes travel credits, lifetime, and subscription': (
        "context.purchaseType === 'travel_credits'" in webhook and
        "context.purchaseType === 'lifetime'" in webhook and
        "context.purchaseType === 'subscription'" in webhook
    ),
    'generic charge refund no longer unconditionally moves customer to free': (
        "updateUserTier(charge.customer, 'free')" not in webhook and
        "await updateUserTier(charge.customer, 'free'" not in webhook
    ),
    'lifetime entitlement is removed only on full refund': (
        "context.purchaseType === 'lifetime' && fullRefund" in webhook and
        'hasActiveSubscription(charge.customer)' in webhook
    ),
    'affiliate refund clawback uses original Stripe source and refund event id': (
        'sourcePaymentId: context.sourcePaymentId' in webhook and
        'refundEventId: event.id' in webhook and
        'stripe_payment_id: refundEventId' in webhook
    ),
    'affiliate commission insert tolerates duplicate Stripe source safely': (
        'insertRes.status === 409' in webhook and
        'affiliate_commissions_stripe_payment_id_unique' in migration
    ),
    'Checkout propagates trusted metadata to Checkout Session': (
        'client_reference_id: auth.userId' in checkout and
        'metadata: billingMetadata' in checkout
    ),
    'payment-mode Checkout propagates trusted metadata to PaymentIntent': (
        'sessionParams.payment_intent_data = { metadata: billingMetadata }' in checkout
    ),
    'subscription Checkout propagates trusted metadata to Subscription': (
        'sessionParams.subscription_data = { metadata: billingMetadata }' in checkout
    ),
    'Stripe event ledger table has RLS and no public/authenticated access': (
        'create table public.stripe_webhook_events' in migration and
        'alter table public.stripe_webhook_events enable row level security' in migration and
        'revoke all privileges on table public.stripe_webhook_events from public, anon, authenticated' in migration
    ),
    'Stripe travel-credit grant ledger has RLS and no public/authenticated access': (
        'create table public.stripe_credit_grants' in migration and
        'alter table public.stripe_credit_grants enable row level security' in migration and
        'revoke all privileges on table public.stripe_credit_grants from public, anon, authenticated' in migration
    ),
    'billing RPCs are not executable by public/anon/authenticated roles': (
        migration.count('revoke execute on function public.') >= 4 and
        migration.count('grant execute on function public.') >= 4 and
        ' to service_role' in migration
    ),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit('Stripe webhook lifecycle audit failed: ' + ', '.join(failed))

print(f'Stripe webhook lifecycle audit passed ({len(checks)}/{len(checks)}).')
