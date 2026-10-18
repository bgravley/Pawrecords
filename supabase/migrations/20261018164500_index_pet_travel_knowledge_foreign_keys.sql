-- Cover foreign keys used by editorial joins and safe parent/source cleanup.
create index if not exists travel_jurisdictions_parent_idx
  on public.travel_jurisdictions (parent_jurisdiction_id);

create index if not exists travel_sources_jurisdiction_idx
  on public.travel_sources (jurisdiction_id);

create index if not exists travel_requirements_origin_idx
  on public.travel_requirements (origin_jurisdiction_id);

create index if not exists travel_requirements_source_idx
  on public.travel_requirements (source_id);

create index if not exists travel_requirement_versions_source_idx
  on public.travel_requirement_versions (source_id);

create index if not exists travel_guide_candidates_origin_idx
  on public.travel_guide_candidates (origin_jurisdiction_id);
