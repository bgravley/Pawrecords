-- Publish the reviewed Canada -> United States dog/cat guide requested by
-- aggregate route demand. The public guide combines air and land travel into
-- one route page because the federal rules share one decision tree; mode-
-- specific instructions remain structured requirements.

insert into public.travel_sources (
  jurisdiction_id, authority_name, authority_type, source_scope, url, title,
  source_updated_at, last_checked_at, reviewed_by, review_notes, review_state
)
select j.id, s.authority_name, 'government', s.source_scope, s.url, s.title,
       s.source_updated_at, '2026-10-18T14:15:00Z'::timestamptz,
       'YourPetPass Travel Desk — solo-maintainer exception',
       s.review_notes, 'source_verified'
from (values
  ('united-states', 'U.S. Centers for Disease Control and Prevention', 'legal_requirement',
   'https://www.cdc.gov/importation/dogs/rabies-free-low-risk-countries.html',
   'Entry Requirements for Dogs from Dog-Rabies Free or Low-Risk Countries',
   '2024-07-22'::date,
   'Primary federal entry rule for dogs that have remained in rabies-free or low-risk countries for the six months before U.S. entry.'),
  ('united-states', 'U.S. Centers for Disease Control and Prevention', 'official_guidance',
   'https://www.cdc.gov/importation/dogs/dog-import-form-instructions.html',
   'CDC Dog Import Form and Instructions',
   '2026-04-28'::date,
   'Current form, receipt, air-carrier and Customs presentation instructions.'),
  ('united-states', 'U.S. Centers for Disease Control and Prevention', 'legal_requirement',
   'https://www.cdc.gov/importation/dogs/faqs.html',
   'Frequently Asked Questions on Dog Importations',
   '2026-08-27'::date,
   'Current port-of-entry and Canada/Mexico guidance, including high-risk travel-history exceptions.'),
  ('united-states', 'U.S. Centers for Disease Control and Prevention', 'legal_requirement',
   'https://www.cdc.gov/importation/bringing-an-animal-into-the-us/',
   'Bringing an Animal into the United States',
   '2025-08-22'::date,
   'Primary federal cat health, inspection and rabies-proof guidance.'),
  ('united-states', 'USDA APHIS', 'official_guidance',
   'https://www.aphis.usda.gov/pet-travel/another-country-to-us-import',
   'Bring a Pet From Another Country into the United States',
   '2026-03-19'::date,
   'Federal entry overview and destination-state requirement reminder.'),
  ('canada', 'Canadian Food Inspection Agency', 'official_guidance',
   'https://inspection.canada.ca/en/animal-health/terrestrial-animals/exports/pets/dogs-usa',
   'Dogs travelling to the United States',
   '2024-08-01'::date,
   'Origin-government coordination guidance for dogs departing Canada.'),
  ('canada', 'Canadian Food Inspection Agency', 'official_guidance',
   'https://inspection.canada.ca/en/animal-health/terrestrial-animals/exports/pets/export-cats-and-ferrets-united-states',
   'Export of cats and ferrets to the United States',
   '2024-06-21'::date,
   'Origin-government guidance confirming that CFIA endorsement is not required for cat documentation.' )
) as s(jurisdiction_slug, authority_name, source_scope, url, title, source_updated_at, review_notes)
join public.travel_jurisdictions j on j.slug = s.jurisdiction_slug
on conflict (url) do update set
  jurisdiction_id = excluded.jurisdiction_id,
  authority_name = excluded.authority_name,
  authority_type = excluded.authority_type,
  source_scope = excluded.source_scope,
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
select destination.id, origin.id, 'all', 'all', 'united-states',
       'United States Pet Entry Requirements',
       '/pet-travel-requirements/united-states/',
       'Canada → United States · dogs & cats · air & land',
       'CDC dog-import rules, cat entry guidance, route-history checks and separate air and land instructions for personal pets arriving from Canada.',
       'Aggregate demand requested both air and land travel. One combined page avoids duplicate route content while preserving mode-specific instructions.',
       'published', false,
       '2026-10-18T14:15:00Z'::timestamptz,
       '2026-10-18T14:15:00Z'::timestamptz,
       'YourPetPass Travel Desk — solo-maintainer exception',
       'CDC, USDA APHIS and CFIA sources checked. Reviewed against the protected Canada-to-U.S. application baseline.',
       '2026-10-18T14:15:00Z'::timestamptz
from public.travel_jurisdictions destination
join public.travel_jurisdictions origin on origin.slug = 'canada'
where destination.slug = 'united-states'
on conflict (destination_jurisdiction_id, origin_jurisdiction_id, species, transportation_mode)
do update set
  proposed_slug = excluded.proposed_slug,
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

-- Keep demand-created air/land rows for history, but make their supersession
-- explicit so only the reviewed combined route is publication-eligible.
update public.travel_guide_candidates candidate
set status = 'withdrawn',
    noindex = true,
    review_notes = 'Superseded by the reviewed combined Canada → United States air-and-land guide.',
    reviewed_by = 'YourPetPass Travel Desk — solo-maintainer exception'
from public.travel_jurisdictions destination, public.travel_jurisdictions origin
where candidate.destination_jurisdiction_id = destination.id
  and candidate.origin_jurisdiction_id = origin.id
  and destination.slug = 'united-states'
  and origin.slug = 'canada'
  and candidate.status <> 'published';

insert into public.travel_requirements (
  destination_jurisdiction_id, origin_jurisdiction_id, species, transportation_mode,
  travel_arrangement, requirement_type, title, rule_text, timing_basis, timing_min,
  timing_max, timing_unit, timing_direction, responsible_party, importance,
  fee_amount, fee_currency, fee_basis, fee_source_updated_at,
  source_id, effective_date, review_state, last_reviewed_at, reviewed_by
)
select destination.id, origin.id, seed.species, seed.mode, 'all', seed.requirement_type,
       seed.title, seed.rule_text, seed.timing_basis, seed.timing_min, seed.timing_max,
       seed.timing_unit, seed.timing_direction, seed.responsible_party, seed.importance,
       seed.fee_amount, seed.fee_currency, seed.fee_basis, seed.fee_source_updated_at,
       source.id, seed.effective_date, 'published',
       '2026-10-18T14:15:00Z'::timestamptz,
       'YourPetPass Travel Desk — solo-maintainer exception'
from (values
  ('dog', 'all', 'arrival',
   'Check every country your dog visited in the last six months',
   'Canada is a dog-rabies-free or low-risk departure country, but eligibility depends on the dog’s complete six-month travel history. If the dog visited a high-risk country, do not use the low-risk checklist; the documents and allowed port of entry can change.',
   'arrival', 0, 6, 'months', 'before_arrival', 'pet parent', 'critical',
   null::numeric, null::text, null::text, null::date,
   'https://www.cdc.gov/importation/dogs/faqs.html', null::date),
  ('dog', 'all', 'permit',
   'Complete one CDC Dog Import Form for each dog',
   'For a dog that has been only in rabies-free or low-risk countries during the six months before U.S. entry, the CDC Dog Import Form receipt is the only CDC document required. The form is free, and each dog needs a separate receipt.',
   'arrival', 0, 6, 'months', 'before_arrival', 'pet parent or importer', 'critical',
   0::numeric, 'USD', 'per CDC Dog Import Form', '2024-07-22'::date,
   'https://www.cdc.gov/importation/dogs/rabies-free-low-risk-countries.html', '2024-08-01'::date),
  ('dog', 'all', 'arrival',
   'Confirm age, health and a universally readable microchip',
   'The dog must be at least six months old, appear healthy on arrival and have a microchip detectable by a universal scanner.',
   'arrival', 0, 0, 'days', 'before_arrival', 'pet parent', 'critical',
   null::numeric, null::text, null::text, null::date,
   'https://www.cdc.gov/importation/dogs/rabies-free-low-risk-countries.html', '2024-08-01'::date),
  ('dog', 'air', 'customs',
   'Show the CDC receipt before boarding and keep it for U.S. arrival',
   'For air travel, show the CDC Dog Import Form receipt to the airline before boarding and keep the printed or electronic receipt available for U.S. Customs and Border Protection on arrival.',
   'departure', 0, 0, 'days', 'before_departure', 'pet parent or importer', 'critical',
   null::numeric, null::text, null::text, null::date,
   'https://www.cdc.gov/importation/dogs/dog-import-form-instructions.html', null::date),
  ('dog', 'land', 'customs',
   'Use the low-risk land-border pathway only when the dog qualifies',
   'A qualifying dog that has been only in rabies-free or low-risk countries for six months can enter at any U.S. land border crossing. Dogs with high-risk travel history may face different port restrictions, including no land-border entry for some foreign-vaccinated dogs.',
   'arrival', 0, 0, 'days', 'before_arrival', 'pet parent or importer', 'critical',
   null::numeric, null::text, null::text, null::date,
   'https://www.cdc.gov/importation/dogs/faqs.html', null::date),
  ('dog', 'all', 'other',
   'Do not treat service-animal status as an entry-rule exemption',
   'CDC dog-import rules apply to all dogs, including service animals and dogs returning to the United States. Airline service-animal documentation is a separate carrier process.',
   null::text, null::int, null::int, null::text, null::text, 'pet parent', 'critical',
   null::numeric, null::text, null::text, null::date,
   'https://www.cdc.gov/importation/bringing-an-animal-into-the-us/', null::date),
  ('cat', 'all', 'arrival',
   'Make sure your cat appears healthy at entry',
   'Cats are inspected at U.S. ports of entry and must appear healthy. An ill cat may require a veterinary examination at the owner’s expense or may be denied entry.',
   'arrival', 0, 0, 'days', 'before_arrival', 'pet parent', 'critical',
   null::numeric, null::text, null::text, null::date,
   'https://www.cdc.gov/importation/bringing-an-animal-into-the-us/', null::date),
  ('cat', 'all', 'rabies',
   'Check destination rabies rules even though CDC does not require proof',
   'CDC does not require proof of rabies vaccination for cats entering the United States, but recommends vaccination. The destination state or territory can impose additional vaccination, certificate or quarantine requirements.',
   null::text, null::int, null::int, null::text, null::text, 'pet parent', 'critical',
   null::numeric, null::text, null::text, null::date,
   'https://www.cdc.gov/importation/bringing-an-animal-into-the-us/', null::date),
  ('all', 'all', 'other',
   'Check the final U.S. state or territory requirements',
   'Federal entry rules are not the whole checklist. Confirm the receiving state or territory requirements; Hawaii and Guam have locally imposed quarantine pathways, and other destinations may require health or vaccination records.',
   null::text, null::int, null::int, null::text, null::text, 'pet parent', 'critical',
   null::numeric, null::text, null::text, null::date,
   'https://www.aphis.usda.gov/pet-travel/another-country-to-us-import', null::date)
) as seed(species, mode, requirement_type, title, rule_text, timing_basis, timing_min, timing_max, timing_unit, timing_direction, responsible_party, importance, fee_amount, fee_currency, fee_basis, fee_source_updated_at, source_url, effective_date)
join public.travel_jurisdictions destination on destination.slug = 'united-states'
join public.travel_jurisdictions origin on origin.slug = 'canada'
join public.travel_sources source on source.url = seed.source_url
where not exists (
  select 1 from public.travel_requirements existing
  where existing.destination_jurisdiction_id = destination.id
    and existing.origin_jurisdiction_id = origin.id
    and existing.title = seed.title
);
