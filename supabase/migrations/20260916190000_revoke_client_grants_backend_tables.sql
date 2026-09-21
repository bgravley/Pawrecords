-- Defense-in-depth hardening for backend-only operational tables.
-- These tables are accessed through server APIs using the service role.
-- RLS is already enabled with no client policies; remove unnecessary SQL grants
-- so anon/authenticated roles cannot reach them even if a policy is added later.

revoke all privileges on table public.airport_relief_areas from anon, authenticated;
revoke all privileges on table public.bug_reports from anon, authenticated;
revoke all privileges on table public.newsletter_subscribers from anon, authenticated;
revoke all privileges on table public.prewarm_routes from anon, authenticated;
revoke all privileges on table public.rate_limit_log from anon, authenticated;
revoke all privileges on table public.travel_route_cache from anon, authenticated;
