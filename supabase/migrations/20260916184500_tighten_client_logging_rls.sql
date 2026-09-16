-- Tighten browser-written operational logs.
-- Client code still needs best-effort INSERT access for signed-in users, but
-- browsers never need SELECT/UPDATE/DELETE/TRUNCATE access to these tables.
-- Server/service-role paths and SECURITY DEFINER functions remain unaffected.

drop policy if exists "Insert only activity" on public.activity_log;
drop policy if exists "Insert only errors" on public.error_log;

revoke all privileges on table public.activity_log from anon, authenticated;
revoke all privileges on table public.error_log from anon, authenticated;

grant insert on table public.activity_log to authenticated;
grant insert on table public.error_log to authenticated;

create policy "authenticated self insert activity"
on public.activity_log
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    user_email is null
    or user_email = (auth.jwt() ->> 'email')
  )
);

create policy "authenticated self insert errors"
on public.error_log
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    user_email is null
    or user_email = (auth.jwt() ->> 'email')
  )
);
