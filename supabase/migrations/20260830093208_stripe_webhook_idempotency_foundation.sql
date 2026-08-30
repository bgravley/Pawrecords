create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing',
  attempts integer not null default 1,
  processing_started_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_webhook_events_status_check check (status in ('processing','processed','failed')),
  constraint stripe_webhook_events_attempts_check check (attempts > 0)
);

alter table public.stripe_webhook_events enable row level security;
revoke all privileges on table public.stripe_webhook_events from public, anon, authenticated;
grant select, insert, update on table public.stripe_webhook_events to service_role;

create table public.stripe_credit_grants (
  stripe_session_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  credit_amount integer not null,
  refunded_event_id text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint stripe_credit_grants_amount_check check (credit_amount > 0),
  constraint stripe_credit_grants_refund_event_unique unique (refunded_event_id)
);

alter table public.stripe_credit_grants enable row level security;
revoke all privileges on table public.stripe_credit_grants from public, anon, authenticated;
grant select, insert, update on table public.stripe_credit_grants to service_role;

create unique index affiliate_commissions_stripe_payment_id_unique
  on public.affiliate_commissions (stripe_payment_id)
  where stripe_payment_id is not null;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted text;
  v_status text;
  v_started timestamptz;
begin
  if p_event_id is null or length(p_event_id) < 3 or length(p_event_id) > 255 then
    raise exception 'invalid Stripe event id';
  end if;
  if p_event_type is null or length(p_event_type) < 3 or length(p_event_type) > 255 then
    raise exception 'invalid Stripe event type';
  end if;

  insert into public.stripe_webhook_events (
    event_id, event_type, status, attempts, processing_started_at, created_at, updated_at
  ) values (
    p_event_id, p_event_type, 'processing', 1, now(), now(), now()
  )
  on conflict (event_id) do nothing
  returning event_id into v_inserted;

  if v_inserted is not null then
    return 'claimed';
  end if;

  select status, processing_started_at
    into v_status, v_started
  from public.stripe_webhook_events
  where event_id = p_event_id
  for update;

  if v_status = 'processed' then
    return 'processed';
  end if;

  if v_status = 'processing' and v_started > now() - interval '10 minutes' then
    return 'busy';
  end if;

  update public.stripe_webhook_events
  set status = 'processing',
      attempts = attempts + 1,
      processing_started_at = now(),
      processed_at = null,
      last_error = null,
      updated_at = now()
  where event_id = p_event_id;

  return 'claimed';
end;
$$;

revoke execute on function public.claim_stripe_webhook_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text) to service_role;

create or replace function public.finish_stripe_webhook_event(
  p_event_id text,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.stripe_webhook_events
  set status = case when p_success then 'processed' else 'failed' end,
      processed_at = case when p_success then now() else null end,
      last_error = case when p_success then null else left(coalesce(p_error, 'unknown error'), 1000) end,
      updated_at = now()
  where event_id = p_event_id;

  if not found then
    raise exception 'Stripe event claim not found';
  end if;
end;
$$;

revoke execute on function public.finish_stripe_webhook_event(text, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_stripe_webhook_event(text, boolean, text) to service_role;

create or replace function public.grant_travel_credits_once(
  p_session_id text,
  p_user_id uuid,
  p_credit_amount integer
)
returns table(customer_email text, new_balance integer, granted boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted text;
  v_email text;
  v_balance integer;
begin
  if p_session_id is null or length(p_session_id) < 3 or length(p_session_id) > 255 then
    raise exception 'invalid Stripe session id';
  end if;
  if p_user_id is null then
    raise exception 'missing user id';
  end if;
  if p_credit_amount is null or p_credit_amount <= 0 or p_credit_amount > 1000 then
    raise exception 'invalid credit amount';
  end if;

  insert into public.stripe_credit_grants (stripe_session_id, user_id, credit_amount)
  values (p_session_id, p_user_id, p_credit_amount)
  on conflict (stripe_session_id) do nothing
  returning stripe_session_id into v_inserted;

  if v_inserted is null then
    select p.email, coalesce(p.travel_credits_balance, 0)
      into v_email, v_balance
    from public.profiles p
    where p.id = p_user_id;

    if not found then
      raise exception 'profile not found';
    end if;

    return query select v_email, v_balance, false;
    return;
  end if;

  update public.profiles p
  set travel_credits_balance = coalesce(p.travel_credits_balance, 0) + p_credit_amount
  where p.id = p_user_id
  returning p.email, p.travel_credits_balance into v_email, v_balance;

  if not found then
    raise exception 'profile not found';
  end if;

  return query select v_email, v_balance, true;
end;
$$;

revoke execute on function public.grant_travel_credits_once(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.grant_travel_credits_once(text, uuid, integer) to service_role;

create or replace function public.revoke_travel_credits_once(
  p_session_id text,
  p_user_id uuid,
  p_refund_event_id text
)
returns table(customer_email text, new_balance integer, revoked boolean, credit_amount integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_amount integer;
  v_revoked_at timestamptz;
  v_email text;
  v_balance integer;
begin
  select g.credit_amount, g.revoked_at
    into v_amount, v_revoked_at
  from public.stripe_credit_grants g
  where g.stripe_session_id = p_session_id
    and g.user_id = p_user_id
  for update;

  if not found then
    return query select null::text, null::integer, false, null::integer;
    return;
  end if;

  if v_revoked_at is not null then
    select p.email, coalesce(p.travel_credits_balance, 0)
      into v_email, v_balance
    from public.profiles p
    where p.id = p_user_id;
    return query select v_email, v_balance, false, v_amount;
    return;
  end if;

  update public.profiles p
  set travel_credits_balance = greatest(0, coalesce(p.travel_credits_balance, 0) - v_amount)
  where p.id = p_user_id
  returning p.email, p.travel_credits_balance into v_email, v_balance;

  if not found then
    raise exception 'profile not found';
  end if;

  update public.stripe_credit_grants
  set revoked_at = now(),
      refunded_event_id = p_refund_event_id
  where stripe_session_id = p_session_id;

  return query select v_email, v_balance, true, v_amount;
end;
$$;

revoke execute on function public.revoke_travel_credits_once(text, uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_travel_credits_once(text, uuid, text) to service_role;
