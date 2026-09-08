#!/usr/bin/env python3
"""Keep generated runtime URLs on the canonical www YourPetPass host.

The bare domain intentionally remains accepted by CORS because real visitors
can arrive there before Vercel redirects them. Runtime-generated navigation,
server-to-server callbacks, email assets, Wallet assets, Stripe return URLs,
and referral links should not deliberately introduce that redirect.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = 'https://yourpetpass.com'
CANONICAL = 'https://www.yourpetpass.com'
ALLOWED_OLD_HOST_FILES = {'api/_cors.js'}

failures = []
checked = 0

for base in ('api', 'src'):
    for path in (ROOT / base).rglob('*'):
        if not path.is_file() or path.suffix not in {'.js', '.jsx'}:
            continue
        checked += 1
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding='utf-8', errors='ignore')
        if OLD in text and rel not in ALLOWED_OLD_HOST_FILES:
            failures.append(f'{rel} generates or embeds the redirecting bare YourPetPass host')

cors = (ROOT / 'api/_cors.js').read_text(encoding='utf-8')
if OLD not in cors or CANONICAL not in cors:
    failures.append('CORS allowlist must continue accepting both bare and www production origins')

for rel in (
    'api/create-checkout.js',
    'api/create-portal-session.js',
    'api/cron-notifications.js',
    'api/prewarm-cache.js',
    'api/send-notifications.js',
    'api/wallet/google.js',
    'src/AffiliatePortal.jsx',
):
    text = (ROOT / rel).read_text(encoding='utf-8')
    if CANONICAL not in text:
        failures.append(f'{rel} does not contain the canonical www host where expected')

ops = (ROOT / 'scripts/platform_audit.md').read_text(encoding='utf-8')
if OLD in ops:
    failures.append('platform audit documentation still names the redirecting bare webhook host')

if failures:
    print('Runtime host audit failed:')
    for failure in failures:
        print(f'  - {failure}')
    raise SystemExit(1)

print(f'PASS: runtime-generated URLs use {CANONICAL}; bare host remains CORS-compatible ({checked} source files checked)')
