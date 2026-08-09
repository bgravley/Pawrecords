alter table public.trip_checklist_items
  add column if not exists importance text not null default 'critical',
  add column if not exists readiness_weight smallint not null default 3,
  add column if not exists readiness_status text not null default 'missing',
  add column if not exists document_expires_at date,
  add column if not exists review_notes text;

alter table public.trip_checklist_items
  drop constraint if exists trip_checklist_items_importance_check,
  add constraint trip_checklist_items_importance_check check (importance in ('critical','supporting')),
  drop constraint if exists trip_checklist_items_readiness_weight_check,
  add constraint trip_checklist_items_readiness_weight_check check (readiness_weight between 1 and 5),
  drop constraint if exists trip_checklist_items_readiness_status_check,
  add constraint trip_checklist_items_readiness_status_check check (readiness_status in ('missing','uploaded_awaiting_review','needs_correction','complete','not_applicable','blocked','expired'));

update public.trip_checklist_items
set readiness_status = case when is_completed then 'complete' else 'missing' end
where readiness_status = 'missing';

create index if not exists trip_checklist_items_readiness_idx
  on public.trip_checklist_items (trip_id, importance, readiness_status, deadline_date);
