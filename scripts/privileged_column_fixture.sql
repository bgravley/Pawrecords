-- Disposable PostgreSQL-only fixture for the CI permission regression test.
-- Deliberately refuses to run on any database except ypp_security_test.
do $$ begin
  if current_database() <> 'ypp_security_test' then
    raise exception 'Refusing to create privilege test fixtures outside ypp_security_test';
  end if;
end $$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  phone text,
  phone_country_code text,
  whatsapp text,
  whatsapp_country_code text,
  address text,
  city text,
  state text,
  zip text,
  country text,
  instagram text,
  facebook text,
  twitter text,
  photo_url text,
  avatar_url text,
  email_notifications boolean,
  is_admin boolean default false,
  subscription_tier text default 'free',
  stripe_customer_id text,
  travel_credits_balance integer default 0,
  ai_scan_limit_override integer,
  ai_travel_limit_override integer,
  referral_code_used text
);

create table public.affiliates (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  referral_code text,
  status text,
  commission_rate numeric,
  payout_paypal text,
  payout_stripe_email text
);

create table public.affiliate_commissions (
  id uuid primary key,
  affiliate_id uuid not null references public.affiliates(id),
  commission_rate numeric,
  status text
);

alter table public.profiles enable row level security;
alter table public.affiliates enable row level security;
alter table public.affiliate_commissions enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy "Affiliates can view own record" on public.affiliates
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Affiliates can update own payout info" on public.affiliates
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Affiliates can view own commissions" on public.affiliate_commissions
  for select to authenticated using (
    affiliate_id in (select id from public.affiliates where user_id = (select auth.uid()))
  );

grant all on table public.profiles, public.affiliates, public.affiliate_commissions
  to public, anon, authenticated, service_role;

insert into public.profiles(id, email, full_name)
values
  ('11111111-1111-4111-8111-111111111111', 'owner@example.test', 'Owner'),
  ('22222222-2222-4222-8222-222222222222', 'other@example.test', 'Other');
insert into public.affiliates(id, user_id, referral_code, status, commission_rate)
values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'TESTAFF', 'active', 0.25),
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'OTHER', 'active', 0.25);
insert into public.affiliate_commissions(id, affiliate_id, commission_rate, status)
values
  ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333', 0.25, 'pending'),
  ('66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444', 0.25, 'pending');
