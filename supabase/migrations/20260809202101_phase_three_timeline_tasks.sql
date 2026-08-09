alter table public.trip_checklist_items
  add column if not exists timeline_stage text,
  add column if not exists responsible_party text,
  add column if not exists document_name text,
  add column if not exists source_authority text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists dependencies jsonb not null default '[]'::jsonb,
  add column if not exists applies_to_pet_ids jsonb not null default '[]'::jsonb,
  add column if not exists applies_to_species text,
  add column if not exists applies_to_segment text,
  add column if not exists travel_method text,
  add column if not exists task_status text not null default 'not_started';

alter table public.trip_checklist_items
  drop constraint if exists trip_checklist_items_timeline_stage_check,
  add constraint trip_checklist_items_timeline_stage_check check (timeline_stage is null or timeline_stage in ('start_now','months_6_12','months_3_6','days_30_90','days_10_30','within_10_days','hours_72','departure_day','transit','arrival','after_arrival')),
  drop constraint if exists trip_checklist_items_dependencies_array,
  add constraint trip_checklist_items_dependencies_array check (jsonb_typeof(dependencies) = 'array'),
  drop constraint if exists trip_checklist_items_pet_ids_array,
  add constraint trip_checklist_items_pet_ids_array check (jsonb_typeof(applies_to_pet_ids) = 'array'),
  drop constraint if exists trip_checklist_items_task_status_check,
  add constraint trip_checklist_items_task_status_check check (task_status in ('not_started','in_progress','complete','blocked','not_applicable'));

update public.trip_checklist_items
set task_status = case when is_completed then 'complete' else 'not_started' end
where task_status = 'not_started';

create index if not exists trip_checklist_items_timeline_idx
  on public.trip_checklist_items (trip_id, timeline_stage, deadline_date, sort_order);
