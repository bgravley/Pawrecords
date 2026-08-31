from pathlib import Path

ANALYTICS = Path('src/lib/analytics.js').read_text()
SUPABASE = Path('src/lib/supabase.js').read_text()
BRIDGE = Path('src/PurchaseAnalyticsBridge.jsx').read_text()
CONFIRM = Path('api/confirm-purchase.js').read_text()
CHECKOUT = Path('api/create-checkout.js').read_text()

checks = []
def check(name, ok):
    checks.append((name, bool(ok)))

check('GA4 receives product events', "window.gtag?.('event', name)" in ANALYTICS)
check('Clarity receives product events', "window.clarity?.('event', name)" in ANALYTICS)
check('Vercel receives product events', 'vercelTrack(name)' in ANALYTICS)
check('Synthetic E2E traffic is excluded', 'YourPetPass-Authenticated-E2E' in ANALYTICS and 'YourPetPass-Isolation-E2E' in ANALYTICS)
check('Local development traffic is excluded', "window.location.hostname === 'localhost'" in ANALYTICS)
check('Analytics event names are allowlisted constants', 'PRODUCT_EVENTS = Object.freeze' in ANALYTICS and 'SAFE_EVENT_NAME' in ANALYTICS)
check('Successful inserts drive funnel events', 'INSERT_EVENT_BY_TABLE' in SUPABASE and "method !== 'POST'" in SUPABASE and '!response.ok' in SUPABASE)
check('Core funnel covers signup', 'SIGNUP_COMPLETED' in SUPABASE)
check('Core funnel covers pet creation', 'dogs: PRODUCT_EVENTS.PET_CREATED' in SUPABASE)
check('Core funnel covers vaccinations', 'vaccinations: PRODUCT_EVENTS.VACCINATION_RECORDED' in SUPABASE)
check('Core funnel covers documents', 'documents: PRODUCT_EVENTS.DOCUMENT_ADDED' in SUPABASE)
check('Core funnel covers trips', 'trips: PRODUCT_EVENTS.TRIP_CREATED' in SUPABASE)
check('Core funnel covers authoritative purchase conversion', "PURCHASE_COMPLETED: 'purchase_completed'" in ANALYTICS)
check('Checkout return includes Stripe session id placeholder', 'session_id={CHECKOUT_SESSION_ID}' in CHECKOUT)
check('Purchase bridge asks authenticated confirmation endpoint', "fetch('/api/confirm-purchase'" in BRIDGE and 'Authorization: `Bearer ${token}`' in BRIDGE)
check('Purchase bridge tracks only confirmed webhook-backed result', 'result?.confirmed === true' in BRIDGE and 'trackProductEvent(PRODUCT_EVENTS.PURCHASE_COMPLETED)' in BRIDGE)
check('Purchase bridge never sends checkout session id to analytics', 'trackProductEvent(PRODUCT_EVENTS.PURCHASE_COMPLETED)' in BRIDGE and 'trackProductEvent(sessionId' not in BRIDGE)
check('Purchase confirmation endpoint requires signed-in identity', 'verifyUser(req)' in CONFIRM and 'checkoutUserId !== auth.userId' in CONFIRM)
check('One-time conversion requires paid Checkout completion', "checkout.payment_status !== 'paid'" in CONFIRM and "eventType = 'checkout.session.completed'" in CONFIRM)
check('Subscription conversion requires initial invoice payment success', "eventType = 'invoice.payment_succeeded'" in CONFIRM and 'checkout.invoice' in CONFIRM)
check('Conversion requires durable signed-webhook processing', 'stripe_webhook_events' in CONFIRM and 'status=eq.processed' in CONFIRM and 'matchingEvent.id' in CONFIRM)
check('Analytics wrapper does not inspect request bodies', '.json()' not in SUPABASE.split('const analyticsFetch', 1)[1].split('const client', 1)[0] and '.text()' not in SUPABASE.split('const analyticsFetch', 1)[1].split('const client', 1)[0])

# Guard against accidentally adding obvious PII/health fields to the analytics helper.
for forbidden in ['email', 'pet_name', 'dog_name', 'document_name', 'file_path', 'diagnosis', 'medication_name', 'allergen', 'origin_city', 'destination_city']:
    check(f'Analytics helper excludes {forbidden}', forbidden not in ANALYTICS.lower())

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'}: {name}")

print(f"\nProduct analytics privacy audit: {len(checks) - len(failed)}/{len(checks)} checks passed")
if failed:
    raise SystemExit(1)
