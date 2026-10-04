-- ai_usage_log is operational billing/telemetry data written only by server APIs.
-- Remove its browser API surface while preserving service-role access.

revoke all privileges on table public.ai_usage_log from anon, authenticated;
grant all privileges on table public.ai_usage_log to service_role;

drop policy if exists "Admin only read" on public.ai_usage_log;
drop policy if exists "Service role insert" on public.ai_usage_log;
