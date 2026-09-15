-- Phase Six: owner-controlled, expiring travel-summary share links.
-- Existing trips remain private and require no backfill.

alter table public.trips
  add column if not exists travel_share_enabled boolean not null default false,
  add column if not exists travel_share_token uuid,
  add column if not exists travel_share_expires_at timestamptz;

create unique index if not exists trips_travel_share_token_key
  on public.trips (travel_share_token)
  where travel_share_token is not null;

alter table public.trips
  drop constraint if exists trips_travel_share_state_valid,
  add constraint trips_travel_share_state_valid check (
    travel_share_enabled = false
    or (travel_share_token is not null and travel_share_expires_at is not null)
  );

comment on column public.trips.travel_share_enabled is 'Owner-controlled switch for the read-only travel summary.';
comment on column public.trips.travel_share_token is 'Unpredictable token used only by the server-side shared-summary endpoint.';
comment on column public.trips.travel_share_expires_at is 'Automatic expiry for the active shared-summary token.';

