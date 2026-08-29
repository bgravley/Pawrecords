from pathlib import Path

affiliate = Path('api/notify-affiliate.js').read_text()
signup = Path('api/notify-signup.js').read_text()
error = Path('api/notify-error.js').read_text()
helper = Path('api/_webhookAuth.js').read_text()

checks = {
    'affiliate email verifies signed-in user': "const auth = await verifyUser(req);" in affiliate,
    'affiliate email requires administrator': "Admin access required" in affiliate and "is_admin" in affiliate,
    'affiliate recipient comes from Supabase profile': "to: affiliate.email" in affiliate and "profiles?id=eq." in affiliate,
    'affiliate request only selects referral code': "const referralCode = typeof req.body?.referralCode" in affiliate,
    'affiliate notes are escaped': "const safeNotes = affiliate.notes ? esc(affiliate.notes) : '';" in affiliate,
    'shared webhook helper fails closed without secret': "status: 503" in helper and "SIGNUP_WEBHOOK_SECRET" in helper,
    'shared webhook helper uses constant-time compare': "timingSafeEqual" in helper,
    'signup webhook requires shared auth helper': "verifyInternalWebhook(req)" in signup,
    'error webhook requires shared auth helper': "verifyInternalWebhook(req)" in error,
    'error email alerts are capped': "const ALERT_LIMIT = 20" in error and "throttled: true" in error,
    'privileged notification responses are not cached': all("Cache-Control', 'private, no-store'" in text for text in (affiliate, signup, error)),
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")

if failed:
    raise SystemExit(f"Privileged notification security audit failed: {', '.join(failed)}")

print(f"Privileged notification security audit passed ({len(checks)}/{len(checks)}).")
