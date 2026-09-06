#!/usr/bin/env python3
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
failures = []
passes = []


def read(path):
    return (ROOT / path).read_text(encoding='utf-8', errors='ignore')


def check(ok, message):
    (passes if ok else failures).append(message)


helper = read('api/_unsubscribe.js')
endpoint = read('api/unsubscribe.js')
notifications = read('api/send-notifications.js')
e2e = read('api/e2e-login.js')
page = read('public/unsubscribe.html')
page_js = read('public/unsubscribe.js')
vercel = read('vercel.json')
smoke = read('scripts/live_smoke.mjs')

check("createHmac('sha256'" in helper, 'Unsubscribe tokens use HMAC-SHA256')
check('timingSafeEqual' in helper, 'Unsubscribe signature verification is timing-safe')
check("yourpetpass:notification-unsubscribe:v1" in helper, 'Token signature is purpose/version scoped')
check('SUPABASE_SERVICE_KEY' in helper and 'UNSUBSCRIBE_SECRET' in helper, 'Token signing uses server-only high-entropy secret material')
check('CANONICAL_HOST' in helper and 'https://www.yourpetpass.com' in helper, 'Unsubscribe links use canonical production host')
check('email' not in helper.lower(), 'Unsubscribe token contains no email address')

check("req.method !== 'POST'" in endpoint, 'Unsubscribe endpoint changes state only on POST')
check('verifyUnsubscribeToken(token)' in endpoint, 'Endpoint requires a valid signed token')
check('email_notifications: false' in endpoint, 'Valid unsubscribe disables reminder emails')
check("rows[0].email_notifications !== false" in endpoint, 'Repeated unsubscribe is idempotent')
check('return res.status(200).json' in endpoint and 'rows.length' in endpoint, 'Missing/deleted account does not become a public existence oracle')
check("Referrer-Policy', 'no-referrer'" in endpoint and 'no-store' in endpoint, 'Endpoint is no-store and suppresses referrer leakage')
check('req.body?.email' not in endpoint and 'req.query?.email' not in endpoint, 'Caller cannot choose an account by email')
check("new URL(req.url || '/', 'https://www.yourpetpass.com')" in endpoint and "searchParams.get('token')" in endpoint, 'Endpoint parses one-click query tokens with the WHATWG URL API')
check('req.query' not in endpoint, 'Endpoint does not invoke the legacy request query parser')
check('console.log' not in endpoint and 'console.info' not in endpoint, 'Endpoint does not log unsubscribe tokens')

notification_import = "import { unsubscribeApiUrlForUser, unsubscribePageUrlForUser } from './_unsubscribe.js';"
e2e_import = "import { createUnsubscribeToken } from './_unsubscribe.js';"
check(notifications.count(notification_import) == 1, 'Reminder sender imports unsubscribe helpers exactly once')
check(e2e.count(e2e_import) == 1, 'E2E bootstrap imports unsubscribe token helper exactly once')
check('__YPP_UNSUBSCRIBE_URL__' in notifications, 'Reminder footer uses personalized signed unsubscribe URL')
check("'List-Unsubscribe'" in notifications and "'List-Unsubscribe-Post'" in notifications, 'Reminder emails include one-click unsubscribe headers')
check('unsubscribeApiUrlForUser(userId)' in notifications and 'unsubscribePageUrlForUser(userId)' in notifications, 'Email sender derives page and one-click links server-side')
check("profiles?select=id,email,full_name,email_notifications&email_notifications=neq.false" in notifications, 'Notification cron excludes unsubscribed profiles')
check(notifications.count('userId: profile.id') == 3, 'Every reminder email send is bound to the intended profile ID')

check('createUnsubscribeToken(userId)' in e2e, 'OIDC-gated E2E bootstrap can mint a synthetic unsubscribe token')
check('email_notifications: true' in e2e, 'Synthetic cleanup restores notification preference after production smoke')
check('verifyGitHubActionsOidc' in e2e and 'readGitHubOidcBearer' in e2e, 'Synthetic token mint remains OIDC-gated')

check('meta name="robots" content="noindex,nofollow"' in page, 'Unsubscribe page is excluded from search indexing')
check('meta name="referrer" content="no-referrer"' in page, 'Unsubscribe page suppresses token referrer leakage')
check('/privacy-consent.js' not in page and 'googletagmanager' not in page and 'clarity.ms' not in page and 'vercel-scripts' not in page, 'Unsubscribe page loads no optional analytics')
check("fetch('/api/unsubscribe'" in page_js and "method: 'POST'" in page_js, 'Unsubscribe page requires an explicit user action before changing preference')
check("new URLSearchParams(window.location.search).get('token')" in page_js, 'Unsubscribe page reads the signed token from its link')
check('email:' not in page_js.lower() and 'email=' not in page_js.lower() and "get('email')" not in page_js.lower(), 'Unsubscribe browser script sends no email address')

check('"source": "/unsubscribe"' in vercel and '"destination": "/unsubscribe.html"' in vercel, 'Clean /unsubscribe route maps to privacy-minimal page')
check('Signed unsubscribe link disables reminder emails and is idempotent' in smoke, 'Production smoke exercises a real signed unsubscribe against the synthetic account')
check('Unsubscribe endpoint rejects forged public tokens' in smoke, 'Production smoke verifies forged tokens fail closed')
check('Unsubscribe page is public and loads no optional analytics bootstrap' in smoke, 'Production smoke verifies unsubscribe page privacy boundary')

result = subprocess.run(
    ['node', '--test', 'scripts/unsubscribe_behavior.test.mjs'],
    cwd=ROOT,
    text=True,
    capture_output=True,
)
check(result.returncode == 0, 'Stateful unsubscribe behavior tests pass')
if result.stdout:
    print(result.stdout.rstrip())
if result.returncode != 0 and result.stderr:
    print(result.stderr.rstrip())

print('\nYourPetPass unsubscribe security audit')
print('=' * 42)
for item in passes:
    print(f'PASS  {item}')

if failures:
    print('\nFAILURES')
    for item in failures:
        print(f'FAIL  {item}')
    raise SystemExit(1)

print(f'\nAll {len(passes)} unsubscribe security checks passed.')
