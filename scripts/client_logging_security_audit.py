#!/usr/bin/env python3
from pathlib import Path

travel = Path('src/Travel.jsx').read_text(encoding='utf-8')
paw = Path('src/PawRecord.jsx').read_text(encoding='utf-8')
migration = Path('supabase/migrations/20260916184500_tighten_client_logging_rls.sql').read_text(encoding='utf-8')

checks = [
    ("session?.access_token || supabaseKey" not in travel,
     "Travel logging never falls back to anonymous authorization"),
    ("session?.access_token || supabaseKey" not in paw,
     "PawRecord logging never falls back to anonymous authorization"),
    ("user_id: session.user.id" in travel and "user_email: session.user.email || null" in travel,
     "Travel logs bind identity to the authenticated session"),
    ("user_id: session.user.id" in paw and "user_email: session.user.email || null" in paw,
     "PawRecord logs bind identity to the authenticated session"),
    ("revoke all privileges on table public.activity_log from anon, authenticated;" in migration,
     "Activity log broad client privileges are revoked"),
    ("revoke all privileges on table public.error_log from anon, authenticated;" in migration,
     "Error log broad client privileges are revoked"),
    ("grant insert on table public.activity_log to authenticated;" in migration,
     "Authenticated clients retain activity INSERT only"),
    ("grant insert on table public.error_log to authenticated;" in migration,
     "Authenticated clients retain error INSERT only"),
    ('create policy "authenticated self insert activity"' in migration
     and "user_id = (select auth.uid())" in migration,
     "Activity insert policy requires self ownership"),
    ('create policy "authenticated self insert errors"' in migration
     and migration.count("user_id = (select auth.uid())") >= 2,
     "Error insert policy requires self ownership"),
    ("user_email = (auth.jwt() ->> 'email')" in migration,
     "Client log email must match the authenticated JWT when present"),
]

failed = [msg for ok, msg in checks if not ok]
for ok, msg in checks:
    print(("PASS" if ok else "FAIL") + ": " + msg)

if failed:
    raise SystemExit(f"{len(failed)} client logging security check(s) failed")

print(f"Client logging security audit passed: {len(checks)}/{len(checks)} checks")
