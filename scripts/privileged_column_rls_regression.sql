-- Run only in disposable ypp_security_test after the fixture and migration.
-- psql -v ON_ERROR_STOP=1 fails on any denied-access regression.
do $$ begin
  if current_database() <> 'ypp_security_test' then
    raise exception 'Refusing to test privilege mutations outside ypp_security_test';
  end if;
end $$;

do $$ begin
  if has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE') or
     has_column_privilege('authenticated', 'public.profiles', 'subscription_tier', 'UPDATE') or
     has_column_privilege('authenticated', 'public.profiles', 'travel_credits_balance', 'UPDATE') or
     has_column_privilege('authenticated', 'public.profiles', 'referral_code_used', 'UPDATE') or
     has_column_privilege('authenticated', 'public.profiles', 'stripe_customer_id', 'UPDATE') or
     has_column_privilege('authenticated', 'public.affiliates', 'commission_rate', 'UPDATE') or
     has_column_privilege('authenticated', 'public.affiliates', 'status', 'UPDATE') or
     has_table_privilege('authenticated', 'public.affiliate_commissions', 'UPDATE') or
     has_table_privilege('anon', 'public.profiles', 'SELECT') or
     not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') or
     not has_column_privilege('authenticated', 'public.affiliates', 'payout_paypal', 'UPDATE') then
    raise exception 'Role-column grants do not meet the security contract';
  end if;
end $$;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
declare changed_rows int;
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Owner must see exactly one profile';
  end if;
  update public.profiles set full_name = 'Owner Edited';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then raise exception 'Owner may edit only their own profile'; end if;

  begin
    update public.profiles set is_admin = true;
    raise exception 'Admin self-escalation was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set subscription_tier = 'lifetime';
    raise exception 'Subscription self-escalation was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set travel_credits_balance = 999;
    raise exception 'Travel-credit self-escalation was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set referral_code_used = 'OVERRIDE';
    raise exception 'Referral-code overwrite was allowed';
  exception when insufficient_privilege then null;
  end;

  if (select count(*) from public.affiliates) <> 1 then
    raise exception 'Affiliate sees someone else''s record';
  end if;
  update public.affiliates set payout_paypal = 'owner@example.test';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then raise exception 'Affiliate payout update must remain allowed'; end if;
  begin
    update public.affiliates set commission_rate = 1;
    raise exception 'Affiliate commission self-escalation was allowed';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.affiliate_commissions) <> 1 then
    raise exception 'Affiliate sees someone else''s commission';
  end if;
  begin
    delete from public.affiliate_commissions;
    raise exception 'Affiliate commission deletion was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.profiles limit 1;
    raise exception 'Anonymous profile access was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'PASS: disposable PostgreSQL role grants and owner RLS behavior' as result;
