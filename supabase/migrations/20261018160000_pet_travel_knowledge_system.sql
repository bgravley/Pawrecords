-- Shared, reviewed pet-travel knowledge. This is editorial infrastructure:
-- browser roles never read or write these tables directly. Public delivery is
-- through /api/travel-requirements, which returns published records only.

create table if not exists public.travel_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(display_name) between 2 and 100),
  jurisdiction_type text not null default 'country'
    check (jurisdiction_type in ('country', 'territory', 'regulatory_group')),
  iso2 text check (iso2 is null or iso2 ~ '^[A-Z]{2}$'),
  parent_jurisdiction_id uuid references public.travel_jurisdictions(id) on delete set null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_sources (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid references public.travel_jurisdictions(id) on delete set null,
  authority_name text not null,
  authority_type text not null
    check (authority_type in ('government', 'airline', 'airport', 'other_official')),
  source_scope text not null
    check (source_scope in ('legal_requirement', 'carrier_policy', 'airport_logistics', 'official_guidance')),
  url text not null unique check (url ~ '^https://'),
  title text not null,
  effective_date date,
  expires_at date,
  source_updated_at date,
  last_checked_at timestamptz,
  reviewed_by text,
  review_notes text,
  review_state text not null default 'draft'
    check (review_state in ('draft', 'source_verified', 'needs_review', 'stale', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or effective_date is null or expires_at >= effective_date),
  check (review_state <> 'source_verified' or (last_checked_at is not null and reviewed_by is not null))
);

create table if not exists public.travel_requirements (
  id uuid primary key default gen_random_uuid(),
  destination_jurisdiction_id uuid not null references public.travel_jurisdictions(id) on delete cascade,
  origin_jurisdiction_id uuid references public.travel_jurisdictions(id) on delete set null,
  origin_category text,
  species text not null default 'all' check (species in ('all', 'dog', 'cat')),
  transportation_mode text not null default 'all'
    check (transportation_mode in ('all', 'air', 'land', 'sea', 'bus')),
  travel_arrangement text not null default 'all'
    check (travel_arrangement in ('all', 'in_cabin_pet', 'in_cabin_service_animal', 'checked_pet', 'manifest_cargo', 'not_decided')),
  requirement_type text not null
    check (requirement_type in ('microchip', 'rabies', 'titer', 'health_certificate', 'endorsement', 'treatment', 'permit', 'quarantine', 'arrival', 'export', 'transit', 'customs', 'other')),
  title text not null,
  rule_text text not null,
  timing_basis text,
  timing_min integer check (timing_min is null or timing_min >= 0),
  timing_max integer check (timing_max is null or timing_max >= 0),
  timing_unit text check (timing_unit is null or timing_unit in ('hours', 'days', 'weeks', 'months')),
  timing_direction text
    check (timing_direction is null or timing_direction in ('before_departure', 'before_arrival', 'after_event', 'valid_for')),
  responsible_party text,
  importance text not null default 'critical' check (importance in ('critical', 'supporting')),
  fee_amount numeric check (fee_amount is null or fee_amount >= 0),
  fee_currency text check (fee_currency is null or fee_currency ~ '^[A-Z]{3}$'),
  fee_basis text,
  fee_source_updated_at date,
  source_id uuid not null references public.travel_sources(id) on delete restrict,
  effective_date date,
  expires_at date,
  review_state text not null default 'draft'
    check (review_state in ('draft', 'source_verified', 'editorial_reviewed', 'published', 'needs_review', 'stale', 'withdrawn')),
  last_reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (timing_max is null or timing_min is null or timing_max >= timing_min),
  check (expires_at is null or effective_date is null or expires_at >= effective_date),
  check (fee_amount is null or (fee_currency is not null and fee_basis is not null and fee_source_updated_at is not null)),
  check (review_state <> 'published' or (last_reviewed_at is not null and reviewed_by is not null))
);

create index if not exists travel_requirements_lookup_idx
  on public.travel_requirements (
    destination_jurisdiction_id,
    origin_jurisdiction_id,
    species,
    transportation_mode,
    travel_arrangement,
    review_state
  );

create table if not exists public.travel_requirement_versions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.travel_requirements(id) on delete cascade,
  change_type text not null
    check (change_type in ('created', 'text_change', 'timing_change', 'scope_change', 'source_change', 'status_change', 'updated')),
  previous_value jsonb,
  new_value jsonb not null,
  source_id uuid references public.travel_sources(id) on delete set null,
  effective_date date,
  created_at timestamptz not null default now()
);

create index if not exists travel_requirement_versions_requirement_idx
  on public.travel_requirement_versions (requirement_id, created_at desc);

create table if not exists public.travel_guide_candidates (
  id uuid primary key default gen_random_uuid(),
  destination_jurisdiction_id uuid not null references public.travel_jurisdictions(id) on delete cascade,
  origin_jurisdiction_id uuid references public.travel_jurisdictions(id) on delete set null,
  species text not null default 'all' check (species in ('all', 'dog', 'cat', 'unknown')),
  transportation_mode text not null default 'all'
    check (transportation_mode in ('all', 'air', 'land', 'sea', 'bus', 'unknown')),
  proposed_slug text,
  proposed_title text,
  public_path text check (public_path is null or public_path ~ '^/pet-travel-requirements/[a-z0-9-]+/$'),
  scope_label text,
  guide_summary text,
  distinct_intent text,
  parent_cluster text not null default 'pet-travel-requirements',
  status text not null default 'draft'
    check (status in ('draft', 'source_verified', 'editorial_reviewed', 'published', 'needs_review', 'stale', 'withdrawn')),
  noindex boolean not null default true,
  source_reviewed_at timestamptz,
  editorial_reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (destination_jurisdiction_id, origin_jurisdiction_id, species, transportation_mode),
  check (status <> 'published' or (
    noindex = false and public_path is not null and source_reviewed_at is not null
    and editorial_reviewed_at is not null and reviewed_by is not null and published_at is not null
  ))
);

create index if not exists travel_guide_candidates_public_idx
  on public.travel_guide_candidates (status, noindex, destination_jurisdiction_id);

create table if not exists public.travel_route_demand (
  id uuid primary key default gen_random_uuid(),
  origin_country text not null check (char_length(origin_country) between 2 and 100),
  destination_country text not null check (char_length(destination_country) between 2 and 100),
  species text not null default 'unknown' check (species in ('all', 'dog', 'cat', 'unknown')),
  transportation_mode text not null default 'unknown'
    check (transportation_mode in ('all', 'air', 'land', 'sea', 'bus', 'unknown')),
  request_count bigint not null default 1 check (request_count > 0),
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  unique (origin_country, destination_country, species, transportation_mode)
);

alter table public.travel_jurisdictions enable row level security;
alter table public.travel_sources enable row level security;
alter table public.travel_requirements enable row level security;
alter table public.travel_requirement_versions enable row level security;
alter table public.travel_guide_candidates enable row level security;
alter table public.travel_route_demand enable row level security;

revoke all privileges on table public.travel_jurisdictions from public, anon, authenticated;
revoke all privileges on table public.travel_sources from public, anon, authenticated;
revoke all privileges on table public.travel_requirements from public, anon, authenticated;
revoke all privileges on table public.travel_requirement_versions from public, anon, authenticated;
revoke all privileges on table public.travel_guide_candidates from public, anon, authenticated;
revoke all privileges on table public.travel_route_demand from public, anon, authenticated;

grant select, insert, update, delete on table public.travel_jurisdictions to service_role;
grant select, insert, update, delete on table public.travel_sources to service_role;
grant select, insert, update, delete on table public.travel_requirements to service_role;
grant select, insert, update, delete on table public.travel_requirement_versions to service_role;
grant select, insert, update, delete on table public.travel_guide_candidates to service_role;
grant select, insert, update, delete on table public.travel_route_demand to service_role;

create or replace function public.touch_travel_knowledge_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.touch_travel_knowledge_updated_at() from public, anon, authenticated;
grant execute on function public.touch_travel_knowledge_updated_at() to service_role;

drop trigger if exists touch_travel_jurisdictions_updated_at on public.travel_jurisdictions;
create trigger touch_travel_jurisdictions_updated_at
before update on public.travel_jurisdictions
for each row execute function public.touch_travel_knowledge_updated_at();

drop trigger if exists touch_travel_sources_updated_at on public.travel_sources;
create trigger touch_travel_sources_updated_at
before update on public.travel_sources
for each row execute function public.touch_travel_knowledge_updated_at();

drop trigger if exists touch_travel_requirements_updated_at on public.travel_requirements;
create trigger touch_travel_requirements_updated_at
before update on public.travel_requirements
for each row execute function public.touch_travel_knowledge_updated_at();

drop trigger if exists touch_travel_guide_candidates_updated_at on public.travel_guide_candidates;
create trigger touch_travel_guide_candidates_updated_at
before update on public.travel_guide_candidates
for each row execute function public.touch_travel_knowledge_updated_at();

create or replace function public.version_travel_requirement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_change_type text := 'updated';
begin
  if tg_op = 'INSERT' then
    v_change_type := 'created';
  elsif old.review_state is distinct from new.review_state then
    v_change_type := 'status_change';
  elsif old.source_id is distinct from new.source_id then
    v_change_type := 'source_change';
  elsif old.timing_basis is distinct from new.timing_basis
     or old.timing_min is distinct from new.timing_min
     or old.timing_max is distinct from new.timing_max
     or old.timing_unit is distinct from new.timing_unit
     or old.timing_direction is distinct from new.timing_direction then
    v_change_type := 'timing_change';
  elsif old.species is distinct from new.species
     or old.transportation_mode is distinct from new.transportation_mode
     or old.travel_arrangement is distinct from new.travel_arrangement
     or old.origin_jurisdiction_id is distinct from new.origin_jurisdiction_id
     or old.destination_jurisdiction_id is distinct from new.destination_jurisdiction_id then
    v_change_type := 'scope_change';
  elsif old.title is distinct from new.title or old.rule_text is distinct from new.rule_text then
    v_change_type := 'text_change';
  end if;

  insert into public.travel_requirement_versions (
    requirement_id, change_type, previous_value, new_value, source_id, effective_date
  ) values (
    new.id,
    v_change_type,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    new.source_id,
    new.effective_date
  );
  return new;
end;
$$;

revoke execute on function public.version_travel_requirement() from public, anon, authenticated;
grant execute on function public.version_travel_requirement() to service_role;

drop trigger if exists version_travel_requirement on public.travel_requirements;
create trigger version_travel_requirement
after insert or update on public.travel_requirements
for each row execute function public.version_travel_requirement();

-- Atomically records aggregate demand and creates a private/no-index candidate.
-- It deliberately stores no user, pet, city, flight, or travel-date information.
create or replace function public.record_travel_route_demand(
  p_origin_country text,
  p_destination_country text,
  p_species text default 'unknown',
  p_transportation_mode text default 'unknown'
)
returns table(request_count bigint, candidate_id uuid, candidate_status text, candidate_noindex boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin text := lower(regexp_replace(trim(coalesce(p_origin_country, '')), '\s+', ' ', 'g'));
  v_destination text := lower(regexp_replace(trim(coalesce(p_destination_country, '')), '\s+', ' ', 'g'));
  v_species text := lower(trim(coalesce(p_species, 'unknown')));
  v_mode text := lower(trim(coalesce(p_transportation_mode, 'unknown')));
  v_origin_slug text;
  v_destination_slug text;
  v_origin_id uuid;
  v_destination_id uuid;
  v_count bigint;
  v_candidate public.travel_guide_candidates%rowtype;
begin
  if char_length(v_origin) not between 2 and 100 or char_length(v_destination) not between 2 and 100 then
    raise exception 'Origin and destination are required';
  end if;
  if v_species not in ('all', 'dog', 'cat', 'unknown') then v_species := 'unknown'; end if;
  if v_mode not in ('all', 'air', 'land', 'sea', 'bus', 'unknown') then v_mode := 'unknown'; end if;

  insert into public.travel_route_demand (
    origin_country, destination_country, species, transportation_mode
  ) values (v_origin, v_destination, v_species, v_mode)
  on conflict (origin_country, destination_country, species, transportation_mode)
  do update set
    request_count = public.travel_route_demand.request_count + 1,
    last_requested_at = now()
  returning public.travel_route_demand.request_count into v_count;

  v_origin_slug := trim(both '-' from regexp_replace(v_origin, '[^a-z0-9]+', '-', 'g'));
  v_destination_slug := trim(both '-' from regexp_replace(v_destination, '[^a-z0-9]+', '-', 'g'));

  if v_origin_slug <> '' and v_destination_slug <> '' then
    insert into public.travel_jurisdictions (slug, display_name, is_active)
    values (v_origin_slug, initcap(v_origin), false)
    on conflict (slug) do update set display_name = public.travel_jurisdictions.display_name
    returning id into v_origin_id;

    insert into public.travel_jurisdictions (slug, display_name, is_active)
    values (v_destination_slug, initcap(v_destination), false)
    on conflict (slug) do update set display_name = public.travel_jurisdictions.display_name
    returning id into v_destination_id;

    insert into public.travel_guide_candidates (
      destination_jurisdiction_id,
      origin_jurisdiction_id,
      species,
      transportation_mode,
      proposed_slug,
      proposed_title,
      distinct_intent,
      status,
      noindex
    ) values (
      v_destination_id,
      v_origin_id,
      v_species,
      v_mode,
      v_destination_slug,
      initcap(v_destination) || ' Pet Entry Requirements',
      'User-requested route; requires official-source verification and editorial review.',
      'draft',
      true
    )
    on conflict (destination_jurisdiction_id, origin_jurisdiction_id, species, transportation_mode)
    do update set updated_at = now()
    returning * into v_candidate;
  end if;

  return query select v_count, v_candidate.id, v_candidate.status, coalesce(v_candidate.noindex, true);
end;
$$;

revoke execute on function public.record_travel_route_demand(text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_travel_route_demand(text, text, text, text) to service_role;

-- Initial reviewed cohort. These mirror the two public guides already live.
insert into public.travel_jurisdictions (slug, display_name, jurisdiction_type, iso2, is_active)
values
  ('united-states', 'United States', 'country', 'US', true),
  ('canada', 'Canada', 'country', 'CA', true),
  ('france', 'France', 'country', 'FR', true),
  ('european-union', 'European Union', 'regulatory_group', null, true)
on conflict (slug) do update set
  display_name = excluded.display_name,
  jurisdiction_type = excluded.jurisdiction_type,
  iso2 = excluded.iso2,
  is_active = excluded.is_active;

insert into public.travel_sources (
  jurisdiction_id, authority_name, authority_type, source_scope, url, title,
  source_updated_at, last_checked_at, reviewed_by, review_notes, review_state
)
select j.id, s.authority_name, 'government', 'legal_requirement', s.url, s.title,
       s.source_updated_at, '2026-10-18T12:00:00Z'::timestamptz,
       'YourPetPass Travel Desk — solo-maintainer exception',
       'Official authority checked against the live destination guide.', 'source_verified'
from (values
  ('canada', 'Canadian Food Inspection Agency', 'https://inspection.canada.ca/en/travelling-pets-food-plants/travelling-pets', 'Travelling with a pet', '2026-08-14'::date),
  ('canada', 'Canadian Food Inspection Agency', 'https://inspection.canada.ca/en/travelling-pets-food-plants/travelling-pets/dog-travel', 'Travelling with your dog', '2026-01-09'::date),
  ('european-union', 'European Commission — Food Safety', 'https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/bringing-pet-eu-non-eu-country_en', 'Bringing a pet into the EU from a non-EU country', null::date),
  ('united-states', 'USDA APHIS', 'https://www.aphis.usda.gov/pet-travel/us-to-another-country-export/pet-travel-us-france', 'Pet Travel From the United States to France', '2026-09-01'::date),
  ('france', 'French Ministry of Agriculture', 'https://agriculture.gouv.fr/faq-modalites-dimportation-des-animaux-de-compagnie-en-provenance-de-pays-tiers', 'Importing companion animals from third countries — FAQ', null::date)
) as s(jurisdiction_slug, authority_name, url, title, source_updated_at)
join public.travel_jurisdictions j on j.slug = s.jurisdiction_slug
on conflict (url) do update set
  title = excluded.title,
  source_updated_at = excluded.source_updated_at,
  last_checked_at = excluded.last_checked_at,
  reviewed_by = excluded.reviewed_by,
  review_notes = excluded.review_notes,
  review_state = excluded.review_state;

insert into public.travel_guide_candidates (
  destination_jurisdiction_id, origin_jurisdiction_id, species, transportation_mode,
  proposed_slug, proposed_title, public_path, scope_label, guide_summary, distinct_intent,
  status, noindex, source_reviewed_at, editorial_reviewed_at, reviewed_by, review_notes, published_at
)
select destination.id, origin.id, 'all', 'all', seed.slug, seed.title, seed.public_path,
       seed.scope_label, seed.summary, seed.distinct_intent, 'published', false,
       '2026-10-18T12:00:00Z'::timestamptz, '2026-10-18T12:00:00Z'::timestamptz,
       'YourPetPass Travel Desk — solo-maintainer exception',
       'Existing public guide reconciled to current official sources.',
       '2026-10-18T12:00:00Z'::timestamptz
from (values
  ('canada', 'Canada Pet Travel Requirements', '/pet-travel-requirements/canada/', 'United States → Canada · dogs & cats', 'Age, rabies-document, transit and border-planning guidance for personal pets arriving from the United States.', 'Existing reviewed destination guide with a route-specific regulatory scope.'),
  ('france', 'France Pet Travel Requirements', '/pet-travel-requirements/france/', 'United States → France · dogs & cats', 'Microchip and rabies sequencing, health-certificate timing, endorsement and arrival planning for U.S.-origin pets.', 'Existing reviewed destination guide covering the October 2026 EU certificate transition.')
) as seed(slug, title, public_path, scope_label, summary, distinct_intent)
join public.travel_jurisdictions destination on destination.slug = seed.slug
join public.travel_jurisdictions origin on origin.slug = 'united-states'
on conflict (destination_jurisdiction_id, origin_jurisdiction_id, species, transportation_mode)
do update set
  proposed_title = excluded.proposed_title,
  public_path = excluded.public_path,
  scope_label = excluded.scope_label,
  guide_summary = excluded.guide_summary,
  distinct_intent = excluded.distinct_intent,
  status = excluded.status,
  noindex = excluded.noindex,
  source_reviewed_at = excluded.source_reviewed_at,
  editorial_reviewed_at = excluded.editorial_reviewed_at,
  reviewed_by = excluded.reviewed_by,
  review_notes = excluded.review_notes,
  published_at = excluded.published_at;

insert into public.travel_requirements (
  destination_jurisdiction_id, origin_jurisdiction_id, species, transportation_mode,
  travel_arrangement, requirement_type, title, rule_text, timing_basis, timing_min,
  timing_max, timing_unit, timing_direction, responsible_party, importance, source_id,
  effective_date, review_state, last_reviewed_at, reviewed_by
)
select destination.id, origin.id, seed.species, seed.mode, 'all', seed.requirement_type,
       seed.title, seed.rule_text, seed.timing_basis, seed.timing_min, seed.timing_max,
       seed.timing_unit, seed.timing_direction, seed.responsible_party, seed.importance,
       source.id, seed.effective_date, 'published', '2026-10-18T12:00:00Z'::timestamptz,
       'YourPetPass Travel Desk — solo-maintainer exception'
from (values
  ('canada', 'all', 'all', 'other', 'Confirm the CFIA pathway for your exact trip', 'Canada’s requirements depend on the pet’s species, origin, age, purpose of import and whether the pet travels with its owner. Use the CFIA import tool for the exact situation before travel.', null::text, null::int, null::int, null::text, null::text, 'pet parent', 'critical', 'https://inspection.canada.ca/en/travelling-pets-food-plants/travelling-pets', null::date),
  ('canada', 'dog', 'all', 'arrival', 'Carry complete and accurate dog-travel records', 'Keep the required records complete and accurate and carry both hard copies and digital copies. Border officials decide eligibility when an arriving dog does not meet the applicable import requirements.', null::text, null::int, null::int, null::text, null::text, 'pet parent', 'critical', 'https://inspection.canada.ca/en/travelling-pets-food-plants/travelling-pets/dog-travel', null::date),
  ('france', 'all', 'all', 'microchip', 'Microchip before the travel rabies vaccination', 'The pet must have a working microchip before the rabies vaccination used for EU travel. The veterinarian should scan the microchip before vaccination.', null::text, null::int, null::int, null::text, 'after_event', 'veterinarian', 'critical', 'https://www.aphis.usda.gov/pet-travel/us-to-another-country-export/pet-travel-us-france', null::date),
  ('france', 'all', 'all', 'rabies', 'Allow the primary-rabies waiting period', 'After a primary rabies vaccination, wait at least 21 days before travel. A timely booster may not require a new wait when the prior vaccination remained valid.', 'primary rabies vaccination', 21, 21, 'days', 'after_event', 'pet parent and veterinarian', 'critical', 'https://www.aphis.usda.gov/pet-travel/us-to-another-country-export/pet-travel-us-france', null::date),
  ('france', 'all', 'all', 'health_certificate', 'Use the current EU animal health certificate', 'For this non-commercial U.S.-to-France scope, use the current EU animal health certificate and complete the required competent-authority endorsement process. The certificate is valid for entry for 10 days from issue, with the official sea-journey extension where applicable.', 'arrival', 0, 10, 'days', 'before_arrival', 'veterinarian and government authority', 'critical', 'https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/bringing-pet-eu-non-eu-country_en', '2026-10-01'::date),
  ('france', 'all', 'all', 'arrival', 'Plan for the designated entry check', 'Use a designated travellers’ point of entry when required and contact the competent authority there for the documentary and identity checks.', 'arrival', 0, 0, 'days', 'before_arrival', 'pet parent', 'critical', 'https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/bringing-pet-eu-non-eu-country_en', null::date)
) as seed(destination_slug, species, mode, requirement_type, title, rule_text, timing_basis, timing_min, timing_max, timing_unit, timing_direction, responsible_party, importance, source_url, effective_date)
join public.travel_jurisdictions destination on destination.slug = seed.destination_slug
join public.travel_jurisdictions origin on origin.slug = 'united-states'
join public.travel_sources source on source.url = seed.source_url
where not exists (
  select 1 from public.travel_requirements existing
  where existing.destination_jurisdiction_id = destination.id
    and existing.origin_jurisdiction_id = origin.id
    and existing.title = seed.title
);
