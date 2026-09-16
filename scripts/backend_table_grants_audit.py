#!/usr/bin/env python3
from pathlib import Path
import re

migration = Path('supabase/migrations/20260916190000_revoke_client_grants_backend_tables.sql').read_text(encoding='utf-8')
client_text = '\n'.join(
    p.read_text(encoding='utf-8', errors='ignore')
    for p in Path('src').rglob('*')
    if p.is_file() and p.suffix in {'.js', '.jsx', '.ts', '.tsx'}
)

tables = [
    'airport_relief_areas',
    'bug_reports',
    'newsletter_subscribers',
    'prewarm_routes',
    'rate_limit_log',
    'travel_route_cache',
]

checks = []
for table in tables:
    revoke = f'revoke all privileges on table public.{table} from anon, authenticated;'
    checks.append((revoke in migration, f'{table}: anon/auth table privileges revoked'))

    direct_patterns = [
        re.compile(rf"\\.from\\(\\s*['\\\"]{re.escape(table)}['\\\"]\\s*\\)"),
        re.compile(rf"/rest/v1/{re.escape(table)}(?:\\?|['\\\"])"),
    ]
    direct_client = any(p.search(client_text) for p in direct_patterns)
    checks.append((not direct_client, f'{table}: no direct browser table access remains'))

server_files = {
    'airport_relief_areas': ['api/airport-relief.js', 'api/airport-guide.js'],
    'bug_reports': ['api/report-bug.js', 'api/admin-data.js'],
    'newsletter_subscribers': ['api/newsletter-signup.js'],
    'prewarm_routes': ['api/prewarm-cache.js', 'api/admin-data.js'],
    'rate_limit_log': ['api/_publicRateLimit.js'],
    'travel_route_cache': ['api/ai-travel.js', 'api/admin-data.js'],
}
for table, paths in server_files.items():
    for path in paths:
        text = Path(path).read_text(encoding='utf-8', errors='ignore')
        checks.append(('SUPABASE_SERVICE_KEY' in text, f'{table}: {path} uses service-role credential path'))

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + msg)

if failed:
    raise SystemExit(f'{len(failed)} backend-table grant hardening check(s) failed')

print(f'Backend-only table grant audit passed: {len(checks)}/{len(checks)} checks')
