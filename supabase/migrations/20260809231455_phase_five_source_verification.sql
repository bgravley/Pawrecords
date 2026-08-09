alter table public.trip_checklist_items
  add column if not exists source_type text,
  add column if not exists jurisdiction text,
  add column if not exists requirement_type text,
  add column if not exists origin_country_scope text,
  add column if not exists destination_country_scope text,
  add column if not exists transit_countries jsonb not null default '[]'::jsonb,
  add column if not exists airline_scope text,
  add column if not exists effective_date date,
  add column if not exists source_expires_at date,
  add column if not exists change_detected boolean not null default false,
  add column if not exists human_review_status text not null default 'pending';

alter table public.trip_checklist_items
  drop constraint if exists trip_checklist_items_source_type_check,
  add constraint trip_checklist_items_source_type_check check (source_type is null or source_type in ('government','airline','airport')),
  drop constraint if exists trip_checklist_items_requirement_type_check,
  add constraint trip_checklist_items_requirement_type_check check (requirement_type is null or requirement_type in ('entry','export','transit','quarantine','health','vaccination','treatment','permit','customs','airline_policy','airport_logistics','other')),
  drop constraint if exists trip_checklist_items_transit_countries_array,
  add constraint trip_checklist_items_transit_countries_array check (jsonb_typeof(transit_countries) = 'array'),
  drop constraint if exists trip_checklist_items_human_review_status_check,
  add constraint trip_checklist_items_human_review_status_check check (human_review_status in ('pending','verified','needs_review','rejected'));

create index if not exists trip_checklist_items_source_verification_idx
  on public.trip_checklist_items (trip_id, source_type, human_review_status, change_detected);
