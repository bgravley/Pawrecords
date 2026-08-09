alter table public.trips
  add column if not exists air_travel_arrangements jsonb;

alter table public.trips
  drop constraint if exists trips_air_travel_arrangements_object_check;
alter table public.trips
  add constraint trips_air_travel_arrangements_object_check
  check (air_travel_arrangements is null or jsonb_typeof(air_travel_arrangements) = 'object') not valid;
alter table public.trips
  validate constraint trips_air_travel_arrangements_object_check;

alter table public.travel_route_cache
  add column if not exists travel_arrangement_key text not null default 'unspecified';

create index if not exists travel_route_cache_lookup_v2_idx
  on public.travel_route_cache (origin_country, destination_country, transportation_mode, travel_arrangement_key, created_at desc);
