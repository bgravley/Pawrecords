-- Expand the existing authenticated bug-report queue into a unified
-- feedback queue without creating a second user-reporting system.

alter table public.bug_reports
  add column if not exists report_type text not null default 'bug';

alter table public.bug_reports
  drop constraint if exists bug_reports_report_type_check;

alter table public.bug_reports
  add constraint bug_reports_report_type_check
  check (report_type in ('bug', 'feature', 'feedback'));

create index if not exists idx_bug_reports_type_status_created
  on public.bug_reports (report_type, status, created_at desc);

comment on column public.bug_reports.report_type is
  'Authenticated user submission category: bug, feature, or feedback.';
