#!/usr/bin/env python3
"""Regression gate for customer-profile and affiliate privilege escalation."""

from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
migrations = list((root / 'supabase/migrations').glob('*_lock_privileged_profile_affiliate_columns.sql'))
assert len(migrations) == 1, 'Exactly one privileged-column hardening migration is required'
sql = migrations[0].read_text(encoding='utf-8').lower()

def normalized(value):
    return re.sub(r'\s+', ' ', value.strip().lower())

checks = []
def check(condition, label):
    checks.append((bool(condition), label))

for table in ('profiles', 'affiliates', 'affiliate_commissions'):
    check(
        f'revoke all privileges on table public.{table} from public, anon, authenticated;' in normalized(sql),
        f'{table}: all legacy browser grants revoked',
    )

check('drop policy if exists "own profile" on public.profiles;' in sql,
      'profiles: overly broad FOR ALL RLS policy removed')
check('for select to authenticated' in sql and 'for update to authenticated' in sql,
      'profiles: owner policies separate read and update')
check('grant select on table public.profiles to authenticated;' in sql,
      'profiles: owned profile reading remains possible')

for table, allowed in {
    'profiles': {
        'full_name', 'phone', 'phone_country_code', 'whatsapp', 'whatsapp_country_code',
        'address', 'city', 'state', 'zip', 'country', 'instagram', 'facebook', 'twitter',
        'photo_url', 'avatar_url', 'email_notifications',
    },
    'affiliates': {'payout_paypal', 'payout_stripe_email'},
}.items():
    match = re.search(r'grant\s+update\s*\(([^)]+)\)\s+on\s+table\s+public\.' + table +
                      r'\s+to\s+authenticated\s*;', sql, re.S)
    actual = set(re.findall(r'[a-z_]+', match.group(1))) if match else set()
    check(actual == allowed, f'{table}: only approved browser-editable columns granted')

for table in ('profiles', 'affiliates', 'affiliate_commissions'):
    check(not re.search(r'grant\s+(?:all|insert|delete|truncate)\b[^;]*\bon\s+(?:table\s+)?public\.'
                        + table + r'\s+to\s+(?:anon|authenticated)', sql),
          f'{table}: migration does not re-open inserts, deletes or other writes')

app = (root / 'src/App.jsx').read_text(encoding='utf-8')
admin_helper = (root / 'api/_requireAdmin.js').read_text(encoding='utf-8')
referral = (root / 'api/apply-referral.js').read_text(encoding='utf-8')
check('/api/apply-referral' in app and 'profiles\').update({ referral_code_used' not in app,
      'referral: browser delegates protected write to authenticated API')
check('verifyUser(req)' in referral and 'referral_code_used=is.null' in referral,
      'referral: verified caller and one-time conditional update')
check('profiles?.[0]?.is_admin !== true' in admin_helper and 'ADMIN_EMAIL' not in admin_helper,
      'admin: server checks only protected admin flag')

for path in ('api/admin-data.js', 'api/notify-affiliate.js', 'api/prewarm-cache.js'):
    code = (root / path).read_text(encoding='utf-8')
    check('requireAdmin(req)' in code, f'{path}: centralized admin check')
check('session.user.email === ADMIN_EMAIL' not in app,
      'app: founder email no longer bypasses role check')

failures = [label for ok, label in checks if not ok]
for ok, label in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + label)
if failures:
    raise SystemExit(f'Privileged-column security audit failed: {len(failures)} of {len(checks)}')
print(f'Privileged-column security audit passed: {len(checks)}/{len(checks)} checks')
