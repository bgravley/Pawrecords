-- Phase Seven: persist each owner's adaptive packing-checklist progress.

alter table public.trips
  add column if not exists packing_checklist jsonb not null
  default '{"version":1,"completed":{}}'::jsonb;

alter table public.trips
  drop constraint if exists trips_packing_checklist_valid,
  add constraint trips_packing_checklist_valid check (
    jsonb_typeof(packing_checklist) = 'object'
    and jsonb_typeof(packing_checklist -> 'completed') = 'object'
  );

comment on column public.trips.packing_checklist is 'Stable item completion map for the adaptive Phase Seven packing checklist.';

