#!/usr/bin/env python3
from pathlib import Path

migration = Path('supabase/migrations/20261018160000_pet_travel_knowledge_system.sql').read_text(encoding='utf-8').lower()
index_migration = Path('supabase/migrations/20261018164500_index_pet_travel_knowledge_foreign_keys.sql').read_text(encoding='utf-8').lower()
api = Path('api/travel-requirements.js').read_text(encoding='utf-8')
ai = Path('api/ai-travel.js').read_text(encoding='utf-8')
hub = Path('public/pet-travel-requirements/index.html').read_text(encoding='utf-8')
finder = Path('public/pet-travel-requirements/finder.js').read_text(encoding='utf-8')
timeline = Path('src/lib/travelTimeline.js').read_text(encoding='utf-8')
travel = Path('src/Travel.jsx').read_text(encoding='utf-8')

tables = (
    'travel_jurisdictions', 'travel_sources', 'travel_requirements',
    'travel_requirement_versions', 'travel_guide_candidates', 'travel_route_demand',
)

checks = []
for table in tables:
    checks.extend([
        (f'create table if not exists public.{table}' in migration, f'{table}: migration creates the table'),
        (f'alter table public.{table} enable row level security' in migration, f'{table}: RLS is enabled'),
        (f'revoke all privileges on table public.{table} from public, anon, authenticated' in migration,
         f'{table}: browser roles have no direct table privileges'),
    ])

checks.extend([
    (index_migration.count('create index if not exists') == 6,
     'all foreign keys flagged by the database advisor have covering indexes'),
    ('grant select, insert, update, delete on table public.travel_requirements to service_role' in migration,
     'explicit service-role grant survives the October 2026 Data API change'),
    ('security definer' in migration and 'set search_path = \'\'' in migration,
     'aggregate-demand RPC uses a fixed empty search path'),
    ('revoke execute on function public.record_travel_route_demand(text, text, text, text) from public, anon, authenticated' in migration,
     'aggregate-demand RPC is not callable by browser roles'),
    ("'draft',\n      true" in migration,
     'new route candidates remain draft and no-index'),
    ('review_state=eq.published' in api and 'review_state=eq.source_verified' in api,
     'public API queries published requirements and verified sources only'),
    ('publishedKnowledge(requirements, sources)' in api,
     'public API applies a second in-process publication gate'),
    ('SUPABASE_SERVICE_KEY' in api and 'SUPABASE_SERVICE_KEY' not in hub and 'SUPABASE_SERVICE_KEY' not in finder,
     'service credentials stay server-side'),
    ('record_travel_route_demand' in ai and 'p_origin_country' in ai,
     'authenticated trip research records aggregate route demand'),
    ('user_id' not in ai[ai.find('async function recordRouteDemand'):ai.find('// ── GPT-4o')],
     'route demand does not store a user identity'),
    ('name="origin"' in hub and 'name="destination"' in hub and 'name="species"' in hub and 'name="departure"' in hub,
     'destination finder collects the route inputs needed to start a trip'),
    ('Build my trip requirements' in hub and '/api/travel-requirements?destination=' in finder,
     'destination finder uses the reviewed-guide lookup'),
    ('tripIntentFromSearch' in travel and 'destinationCountry' in finder and 'departureDate' in finder,
     'missing-destination route details carry into the new-trip form'),
    ('/api/travel-research-candidate' not in finder and 'record_travel_route_demand' not in finder,
     'public finder cannot write research candidates or demand directly'),
    ('calculateRequirementWindow' in timeline and "!['before_departure', 'before_arrival'].includes(direction)" in timeline,
     'timeline date math is deterministic and does not invent unknown event dates'),
    ('fee_amount numeric' in migration and 'fee_source_updated_at date' in migration,
     'exact official fees have amount, currency/basis, and source-date fields'),
    ('estimated_fee' not in migration and 'trip_cost' not in migration,
     'knowledge system does not introduce estimated fees or a trip-cost calculator'),
])

failed = [message for passed, message in checks if not passed]
for passed, message in checks:
    print(('PASS' if passed else 'FAIL') + ': ' + message)
if failed:
    raise SystemExit(f'{len(failed)} travel knowledge system check(s) failed')
print(f'Travel knowledge system audit passed: {len(checks)}/{len(checks)} checks')

