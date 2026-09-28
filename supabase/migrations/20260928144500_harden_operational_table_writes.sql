-- Harden operational telemetry tables.
-- ai_usage_log is server-only. activity_log/error_log accept authenticated
-- owner-bound inserts only; no client reads/updates/deletes/truncates.

revoke all privileges on table public.ai_usage_log from anon, authenticated;
revoke all privileges on table public.activity_log from anon, authenticated;
revoke all privileges on table public.error_log from anon, authenticated;

-- Service-side APIs/admin tooling use the service role and must retain access.
grant all privileges on table public.ai_usage_log to service_role;
grant all privileges on table public.activity_log to service_role;
grant all privileges on table public.error_log to service_role;

drop policy if exists "Admin only read" on public.ai_usage_log;
drop policy if exists "Service role insert" on public.ai_usage_log;

drop policy if exists "Admin read activity" on public.activity_log;
drop policy if exists "Insert only activity" on public.activity_log;
create policy "Authenticated owner activity insert"
  on public.activity_log
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Admin read errors" on public.error_log;
drop policy if exists "Insert only errors" on public.error_log;
create policy "Authenticated owner error insert"
  on public.error_log
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant insert on table public.activity_log to authenticated;
grant insert on table public.error_log to authenticated;
