-- Source-backed travel support: exact official fees and owner-entered trip references.
alter table public.trips
  add column if not exists travel_support jsonb not null default '{"version":1,"destination_vet":{}}'::jsonb;

alter table public.trips
  drop constraint if exists trips_travel_support_object,
  add constraint trips_travel_support_object check (jsonb_typeof(travel_support) = 'object');

comment on column public.trips.travel_support is 'Owner-entered pet-travel references, inspection details, and destination veterinarian contact. Excludes accommodation and general immigration planning.';

alter table public.trip_checklist_items
  add column if not exists fee_amount numeric(12,2),
  add column if not exists fee_currency text,
  add column if not exists fee_basis text,
  add column if not exists fee_notes text,
  add column if not exists fee_source_updated_at date,
  add column if not exists fee_last_checked_at timestamptz;

alter table public.trip_checklist_items
  drop constraint if exists trip_checklist_items_fee_amount_nonnegative,
  add constraint trip_checklist_items_fee_amount_nonnegative check (fee_amount is null or fee_amount >= 0),
  drop constraint if exists trip_checklist_items_fee_currency_iso,
  add constraint trip_checklist_items_fee_currency_iso check (fee_currency is null or fee_currency ~ '^[A-Z]{3}$'),
  drop constraint if exists trip_checklist_items_fee_requires_source,
  add constraint trip_checklist_items_fee_requires_source check (fee_amount is null or source_url is not null);

comment on column public.trip_checklist_items.fee_amount is 'Exact amount published by the official authority; never an estimate or calculated trip total.';
comment on column public.trip_checklist_items.fee_last_checked_at is 'When YourPetPass last confirmed the published fee at its official source.';
