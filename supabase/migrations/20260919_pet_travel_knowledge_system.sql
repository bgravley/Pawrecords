-- REVIEW-ONLY MIGRATION
-- Do not apply to production before explicit approval.
-- Pet Travel Requirements shared knowledge layer.

create table if not exists public.travel_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  jurisdiction_type text not null default 'country' check (jurisdiction_type in ('country','territory','regulatory_group')),
  iso2 text,
  parent_jurisdiction_id uuid references public.travel_jurisdictions(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_sources (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid references public.travel_jurisdictions(id) on delete set null,
  authority_name text not null,
  authority_type text not null check (authority_type in ('government','airline','airport','other_official')),
  source_scope text not null check (source_scope in ('legal_requirement','carrier_policy','airport_logistics','official_guidance')),
  url text not null,
  title text,
  effective_date date,
  expires_at date,
  last_checked_at timestamptz,
  review_state text not null default 'draft' check (review_state in ('draft','source_verified','needs_review','stale','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (url)
);

create table if not exists public.travel_requirements (
  id uuid primary key default gen_random_uuid(),
  destination_jurisdiction_id uuid not null references public.travel_jurisdictions(id) on delete cascade,
  origin_jurisdiction_id uuid references public.travel_jurisdictions(id) on delete set null,
  origin_category text,
  species text not null default 'all' check (species in ('all','dog','cat')),
  transportation_mode text not null default 'all' check (transportation_mode in ('all','air','land','sea')),
  travel_arrangement text not null default 'all',
  requirement_type text not null check (requirement_type in ('microchip','rabies','titer','health_certificate','endorsement','treatment','permit','quarantine','arrival','export','transit','other')),
  title text not null,
  rule_text text not null,
  timing_basis text,
  timing_min integer,
  timing_max integer,
  timing_unit text check (timing_unit is null or timing_unit in ('hours','days','weeks','months')),
  timing_direction text check (timing_direction is null or timing_direction in ('before_departure','before_arrival','after_event','valid_for')),
  source_id uuid not null references public.travel_sources(id) on delete restrict,
  effective_date date,
  expires_at date,
  review_state text not null default 'draft' check (review_state in ('draft','source_verified','editorial_reviewed','published','needs_review','stale','withdrawn')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_requirements_lookup_idx
  on public.travel_requirements(destination_jurisdiction_id, origin_jurisdiction_id, species, transportation_mode, review_state);

create table if not exists public.travel_requirement_versions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.travel_requirements(id) on delete cascade,
  change_type text not null check (change_type in ('created','text_change','timing_change','scope_change','source_change','status_change')),
  previous_value jsonb,
  new_value jsonb not null,
  source_id uuid references public.travel_sources(id) on delete set null,
  effective_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.travel_guide_candidates (
  id uuid primary key default gen_random_uuid(),
  destination_jurisdiction_id uuid not null references public.travel_jurisdictions(id) on delete cascade,
  origin_jurisdiction_id uuid references public.travel_jurisdictions(id) on delete set null,
  species text not null default 'all',
  transportation_mode text not null default 'all',
  proposed_slug text,
  proposed_title text,
  distinct_intent text,
  parent_cluster text not null default 'pet-travel-requirements',
  status text not null default 'draft' check (status in ('draft','source_verified','editorial_reviewed','published','needs_review','stale','withdrawn')),
  noindex boolean not null default true,
  source_reviewed_at timestamptz,
  editorial_reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_route_demand (
  id uuid primary key default gen_random_uuid(),
  origin_country text not null,
  destination_country text not null,
  species text not null default 'unknown',
  transportation_mode text not null default 'unknown',
  request_count bigint not null default 1 check (request_count > 0),
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  unique(origin_country, destination_country, species, transportation_mode)
);

-- These knowledge tables are service/editorial infrastructure, not public client-write tables.
alter table public.travel_jurisdictions enable row level security;
alter table public.travel_sources enable row level security;
alter table public.travel_requirements enable row level security;
alter table public.travel_requirement_versions enable row level security;
alter table public.travel_guide_candidates enable row level security;
alter table public.travel_route_demand enable row level security;

-- No permissive client policies are intentionally created in this migration.
-- Public guide delivery should use a controlled server endpoint that exposes only
-- editorial_reviewed/published records and never draft candidate data.
