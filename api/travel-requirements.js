// REVIEW BRANCH ONLY — do not deploy to production before explicit approval.
// Read-only public knowledge endpoint. It exposes only editorially reviewed/published
// rules and sources; draft candidates and private trip data are never returned.

import { setCorsHeaders } from './_cors.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const headers = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
});

const cleanSlug = value => (value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

async function rest(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
  if (!response.ok) throw new Error(`Knowledge query failed (${response.status})`);
  return response.json();
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({ error: 'Knowledge service is not configured' });

  const destination = cleanSlug(req.query?.destination);

  try {
    if (!destination) {
      const jurisdictions = await rest(
        'travel_jurisdictions?is_active=eq.true&select=id,slug,display_name,jurisdiction_type,iso2&order=display_name.asc'
      );
      return res.status(200).json({ jurisdictions });
    }

    const jurisdictions = await rest(
      `travel_jurisdictions?slug=eq.${encodeURIComponent(destination)}&is_active=eq.true&select=id,slug,display_name,jurisdiction_type,iso2&limit=1`
    );
    const jurisdiction = jurisdictions?.[0];
    if (!jurisdiction) return res.status(404).json({ error: 'Destination guide not found' });

    const requirements = await rest(
      `travel_requirements?destination_jurisdiction_id=eq.${jurisdiction.id}&review_state=in.(editorial_reviewed,published)&select=id,species,transportation_mode,travel_arrangement,requirement_type,title,rule_text,timing_basis,timing_min,timing_max,timing_unit,timing_direction,effective_date,expires_at,last_reviewed_at,source_id&order=requirement_type.asc`
    );

    const sourceIds = [...new Set(requirements.map(r => r.source_id).filter(Boolean))];
    let sources = [];
    if (sourceIds.length) {
      sources = await rest(
        `travel_sources?id=in.(${sourceIds.join(',')})&review_state=eq.source_verified&select=id,authority_name,authority_type,source_scope,url,title,effective_date,expires_at,last_checked_at`
      );
    }

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
    return res.status(200).json({
      jurisdiction,
      requirements,
      sources,
      editorial_status: requirements.length ? 'reviewed' : 'not_yet_reviewed',
    });
  } catch (error) {
    console.error('travel-requirements error:', error.message);
    return res.status(500).json({ error: 'Could not load travel requirements' });
  }
}
