from pathlib import Path

NOTIFY = Path('api/notify-user-action.js').read_text()
SMOKE = Path('.github/workflows/live-smoke.yml').read_text()

checks = []
def check(name, ok):
    checks.append((name, bool(ok)))

check('Notification endpoint verifies a signed-in Supabase user', 'authenticatedUser(req)' in NOTIFY and '/auth/v1/user' in NOTIFY)
check('Notification endpoint accepts same-origin HttpOnly session', "SESSION_COOKIE = 'ypp_file_session'" in NOTIFY and 'readCookie(req, SESSION_COOKIE)' in NOTIFY)
check('Notification recipient is server-derived', 'to: user.email' in NOTIFY)
check('Caller-supplied recipient is not used', 'to: recipientEmail' not in NOTIFY and 'const { actionType, recipientEmail' not in NOTIFY)
check('Unauthenticated callers receive 401', "return res.status(401).json({ error: 'Unauthorized' })" in NOTIFY)
check('Notification response is not cached', "Cache-Control', 'private, no-store" in NOTIFY)
check('Missing Resend configuration fails closed', '!RESEND_API_KEY' in NOTIFY and '503' in NOTIFY)
check('Only allowlisted action templates can send', '!TEMPLATES[actionType]' in NOTIFY)
check('Production smoke probes anonymous relay rejection', 'Verify notification endpoint rejects anonymous relay' in SMOKE and '/api/notify-user-action' in SMOKE and 'test "$STATUS" = "401"' in SMOKE)

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'}: {name}")

print(f"\nNotification security audit: {len(checks) - len(failed)}/{len(checks)} checks passed")
if failed:
    raise SystemExit(1)
