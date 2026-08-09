alter table public.airport_relief_areas
  add column if not exists guide_json jsonb,
  add column if not exists source_urls jsonb not null default '[]'::jsonb,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verification_status text not null default 'legacy';

alter table public.airport_relief_areas
  drop constraint if exists airport_relief_areas_source_urls_array,
  add constraint airport_relief_areas_source_urls_array check (jsonb_typeof(source_urls) = 'array'),
  drop constraint if exists airport_relief_areas_guide_object,
  add constraint airport_relief_areas_guide_object check (guide_json is null or jsonb_typeof(guide_json) = 'object'),
  drop constraint if exists airport_relief_areas_verification_status,
  add constraint airport_relief_areas_verification_status check (verification_status in ('legacy', 'ai_researched', 'human_verified'));

create index if not exists airport_relief_areas_last_verified_idx
  on public.airport_relief_areas (airport_code, last_verified_at desc);
