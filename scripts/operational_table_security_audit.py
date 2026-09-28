#!/usr/bin/env python3
from pathlib import Path

migration = Path('supabase/migrations/20260928144500_harden_operational_table_writes.sql').read_text(encoding='utf-8')
travel = Path('src/Travel.jsx').read_text(encoding='utf-8')
paw = Path('src/PawRecord.jsx').read_text(encoding='utf-8')
ai_scan = Path('api/ai-scan.js').read_text(encoding='utf-8')
ai_travel = Path('api/ai-travel.js').read_text(encoding='utf-8')

checks = [
    ('revoke all privileges on table public.ai_usage_log from anon, authenticated;' in migration,
     'ai_usage_log removes all browser-role table grants'),
    ('drop policy if exists "Service role insert" on public.ai_usage_log;' in migration,
     'ai_usage_log removes unconditional insert policy'),
    ('grant all privileges on table public.ai_usage_log to service_role;' in migration,
     'ai_usage_log retains server-side service access'),
    (migration.count('with check ((select auth.uid()) = user_id);') == 2,
     'activity/error client inserts are both bound to the authenticated owner'),
    ('grant insert on table public.activity_log to authenticated;' in migration,
     'activity_log exposes only authenticated INSERT after revoke-all'),
    ('grant insert on table public.error_log to authenticated;' in migration,
     'error_log exposes only authenticated INSERT after revoke-all'),
    ('grant insert on table public.ai_usage_log to authenticated;' not in migration
     and 'grant insert on table public.ai_usage_log to anon;' not in migration,
     'ai_usage_log is not re-granted to browser roles'),
    ("session?.access_token || supabaseKey" in travel and "session?.access_token || supabaseKey" in paw,
     'existing client telemetry uses authenticated JWT when a session exists and anonymous fallback will be rejected'),
    ('SUPABASE_SERVICE_KEY' in ai_scan and '/rest/v1/ai_usage_log' in ai_scan,
     'document AI usage logging is server-side with service credentials'),
    ('SUPABASE_SERVICE_KEY' in ai_travel and '/rest/v1/ai_usage_log' in ai_travel,
     'travel AI usage logging is server-side with service credentials'),
]

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)
if failed:
    raise SystemExit(f'{len(failed)} operational table security check(s) failed')
print(f'Operational table security audit passed: {len(checks)}/{len(checks)} checks')
