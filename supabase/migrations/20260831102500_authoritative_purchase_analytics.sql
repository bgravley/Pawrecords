create table public.stripe_purchase_confirmations (
  stripe_session_id text primary key,
  stripe_event_id text not null unique references public.stripe_webhook_events(event_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  purchase_type text not null,
  created_at timestamptz not null default now(),
  constraint stripe_purchase_confirmations_session_check check (length(stripe_session_id) between 3 and 255),
  constraint stripe_purchase_confirmations_event_check check (length(stripe_event_id) between 3 and 255),
  constraint stripe_purchase_confirmations_type_check check (purchase_type in ('subscription', 'lifetime', 'travel_credits'))
);

create index stripe_purchase_confirmations_user_id_idx
  on public.stripe_purchase_confirmations (user_id);

alter table public.stripe_purchase_confirmations enable row level security;
revoke all privileges on table public.stripe_purchase_confirmations from public, anon, authenticated;
grant select, insert on table public.stripe_purchase_confirmations to service_role;
