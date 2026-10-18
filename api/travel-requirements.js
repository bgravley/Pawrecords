import { setCorsHeaders } from './_cors.js';
import { destinationSlug, publicGuide, publishedKnowledge, safeUuidList } from './_travelKnowledge.js';

function serviceHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };
}

async function rest(path) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: serviceHeaders(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`travel knowledge query failed (${response.status}): ${detail.slice(0, 160)}`);
  }
  return response.json();
}

async function listPublishedGuides() {
  const candidates = await rest(
    'travel_guide_candidates?status=eq.published&noindex=eq.false&select=destination_jurisdiction_id,status,noindex,public_path,proposed_title,scope_label,guide_summary,editorial_reviewed_at&order=proposed_title.asc'
  );
  const jurisdictionIds = safeUuidList(candidates.map(candidate => candidate.destination_jurisdiction_id));
  if (!jurisdictionIds.length) return [];
  const jurisdictions = await rest(
    `travel_jurisdictions?id=in.(${jurisdictionIds.join(',')})&is_active=eq.true&select=id,slug,display_name,iso2`
  );
  const byId = new Map(jurisdictions.map(jurisdiction => [jurisdiction.id, jurisdiction]));
  return candidates.map(candidate => publicGuide(candidate, byId.get(candidate.destination_jurisdiction_id))).filter(Boolean);
}

async function getPublishedGuide(slug) {
  const jurisdictions = await rest(
    `travel_jurisdictions?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=id,slug,display_name,iso2&limit=1`
  );
  const jurisdiction = jurisdictions?.[0];
  if (!jurisdiction) return null;

  const candidates = await rest(
    `travel_guide_candidates?destination_jurisdiction_id=eq.${jurisdiction.id}&status=eq.published&noindex=eq.false&select=destination_jurisdiction_id,origin_jurisdiction_id,status,noindex,public_path,proposed_title,scope_label,guide_summary,editorial_reviewed_at&order=published_at.desc&limit=1`
  );
  const candidate = candidates?.[0];
  const guide = publicGuide(candidate, jurisdiction);
  if (!guide) return null;

  const originFilter = candidate.origin_jurisdiction_id
    ? `&origin_jurisdiction_id=eq.${candidate.origin_jurisdiction_id}`
    : '';
  const requirements = await rest(
    `travel_requirements?destination_jurisdiction_id=eq.${jurisdiction.id}${originFilter}&review_state=eq.published&select=id,species,transportation_mode,travel_arrangement,requirement_type,title,rule_text,timing_basis,timing_min,timing_max,timing_unit,timing_direction,responsible_party,importance,fee_amount,fee_currency,fee_basis,fee_source_updated_at,effective_date,expires_at,last_reviewed_at,review_state,source_id&order=requirement_type.asc,title.asc`
  );
  const sourceIds = safeUuidList(requirements.map(requirement => requirement.source_id));
  const sources = sourceIds.length
    ? await rest(`travel_sources?id=in.(${sourceIds.join(',')})&review_state=eq.source_verified&select=id,authority_name,authority_type,source_scope,url,title,effective_date,expires_at,source_updated_at,last_checked_at,review_state`)
    : [];

  return { guide, requirements: publishedKnowledge(requirements, sources) };
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Travel guide service is temporarily unavailable' });
  }

  const rawDestination = req.query?.destination;
  const slug = destinationSlug(rawDestination);
  if (rawDestination && !slug) return res.status(400).json({ error: 'Enter a valid destination' });

  try {
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600');
    if (!slug) return res.status(200).json({ guides: await listPublishedGuides() });

    const result = await getPublishedGuide(slug);
    if (!result) {
      return res.status(404).json({
        status: 'not_published',
        message: 'A reviewed public guide is not available for this destination yet.',
      });
    }
    return res.status(200).json({ status: 'published', ...result });
  } catch (error) {
    console.error('travel-requirements error:', error.message);
    return res.status(500).json({ error: 'Could not load travel requirements' });
  }
}
