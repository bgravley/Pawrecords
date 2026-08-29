from pathlib import Path

CHECKOUT = Path('api/create-checkout.js').read_text()
VERIFY = Path('api/_verifyUser.js').read_text()
SMOKE = Path('.github/workflows/live-smoke.yml').read_text()

checks = []
def check(name, ok):
    checks.append((name, bool(ok)))

check('Checkout verifies the signed-in user', 'verifyUser(req)' in CHECKOUT)
check('Shared verifier supports the secure same-origin cookie', "SESSION_COOKIE = 'ypp_file_session'" in VERIFY and 'readCookie(req, SESSION_COOKIE)' in VERIFY)
check('Checkout has a fixed product allowlist', 'const PRODUCTS = Object.freeze' in CHECKOUT and CHECKOUT.count("'price_") >= 4)
check('Unknown price IDs are rejected', 'const product = PRODUCTS[priceId]' in CHECKOUT and '!product' in CHECKOUT)
check('Checkout metadata uses server-verified user ID', 'userId: auth.userId' in CHECKOUT)
check('Checkout email uses server-verified account email', 'customer_email: auth.email' in CHECKOUT)
check('Mode is derived from the product allowlist', 'mode: product.mode' in CHECKOUT)
check('Purchase type is derived from the product allowlist', 'purchaseType: product.purchaseType' in CHECKOUT)
check('Travel credit amount is derived from the product allowlist', 'creditAmount: product.creditAmount' in CHECKOUT)
check('Browser user identity fields are not destructured', 'const { priceId, userId' not in CHECKOUT and 'const { priceId, userEmail' not in CHECKOUT)
check('Referral discount eligibility is rechecked server-side', 'referralDiscountEligible(userId)' in CHECKOUT and "profile.subscription_tier !== 'free'" in CHECKOUT and '48 * 60 * 60 * 1000' in CHECKOUT)
check('Customer-entered discount is resolved as an active Promotion Code', 'stripe.promotionCodes.list' in CHECKOUT and 'active: true' in CHECKOUT and 'promotion_code: promotion.id' in CHECKOUT)
check('Arbitrary client text is not used as a raw coupon', 'discounts = [{ coupon: couponCode }]' not in CHECKOUT)
check('Checkout response is not cached', "Cache-Control', 'private, no-store" in CHECKOUT)
check('Production smoke probes anonymous checkout spoof rejection', 'Verify checkout rejects anonymous identity spoofing' in SMOKE and '/api/create-checkout' in SMOKE and SMOKE.count('test "$STATUS" = "401"') >= 2)

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'}: {name}")

print(f"\nCheckout security audit: {len(checks) - len(failed)}/{len(checks)} checks passed")
if failed:
    raise SystemExit(1)
