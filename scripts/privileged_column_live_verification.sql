-- Read-only verification of the PRODUCTION privilege migration.
-- Run after the approved release, using the Supabase SQL editor or MCP.
-- Do not treat passing static CI checks as proof this migration ran live.
-- Every result must be true, and the full RLS behavior test must pass too.

select 'profiles admin flag cannot be changed by customers' as check_name,
       not has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE') as passed
union all
select 'profiles paid tier cannot be changed by customers',
       not has_column_privilege('authenticated', 'public.profiles', 'subscription_tier', 'UPDATE')
union all
select 'profiles credits cannot be changed by customers',
       not has_column_privilege('authenticated', 'public.profiles', 'travel_credits_balance', 'UPDATE')
union all
select 'profiles Stripe customer cannot be changed by customers',
       not has_column_privilege('authenticated', 'public.profiles', 'stripe_customer_id', 'UPDATE')
union all
select 'profiles referral code cannot be changed by customers',
       not has_column_privilege('authenticated', 'public.profiles', 'referral_code_used', 'UPDATE')
union all
select 'profiles admin flag cannot be inserted by customers',
       not has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'INSERT')
union all
select 'profiles cannot be deleted by customers',
       not has_table_privilege('authenticated', 'public.profiles', 'DELETE')
union all
select 'profiles ordinary name edit remains allowed',
       has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
union all
select 'affiliates commission rate cannot be changed by affiliates',
       not has_column_privilege('authenticated', 'public.affiliates', 'commission_rate', 'UPDATE')
union all
select 'affiliates status cannot be changed by affiliates',
       not has_column_privilege('authenticated', 'public.affiliates', 'status', 'UPDATE')
union all
select 'affiliates payout information remains editable',
       has_column_privilege('authenticated', 'public.affiliates', 'payout_paypal', 'UPDATE')
union all
select 'commission history cannot be written by customers',
       not has_table_privilege('authenticated', 'public.affiliate_commissions', 'UPDATE')
union all
select 'anonymous role cannot write profiles',
       not has_table_privilege('anon', 'public.profiles', 'UPDATE');
