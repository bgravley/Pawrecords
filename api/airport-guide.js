import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';
import { normalizeAirportGuide } from './_airportGuideNormalize.js';

const CACHE_TTL_DAYS = 90;
const serviceHeaders = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` });

async function getCached(airportCode) {
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400000).toISOString();
  const url = `${process.env.SUPABASE_URL}/rest/v1/airport_relief_areas?airport_code=eq.${encodeURIComponent(airportCode)}&last_verified_at=gte.${encodeURIComponent(cutoff)}&guide_json=not.is.null&select=guide_json&limit=1`;
  const response = await fetch(url, { headers: serviceHeaders() });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0]?.guide_json || null;
}

async function research(airportCode) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const prompt = `Research a practical pet-travel airport guide for ${airportCode}. Use ONLY the airport's official website or airport authority for airport logistics, and official government agencies for security, customs, transit, and veterinary inspection. Do not use blogs, aggregators, airline pages, or estimated costs. If an item cannot be confirmed from an official source, use an empty string rather than guessing.

Return only valid JSON with this shape:
{"airportName":"","summary":"","petReliefAreas":[{"location":"","terminal":null,"type":"indoor or outdoor","notes":""}],"petCheckIn":"","cargoLocations":"","securityScreening":"","customsProcess":"","veterinaryInspection":"","serviceAnimalProcess":"","operatingHours":"","emergencyVet":"nearest confirmed emergency veterinary facility and contact details, if an official source confirms it","officialSources":[{"authority":"","sourceType":"airport or government","url":"https://...","supports":"fields supported by this source"}]}`;
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: 'gpt-4o', input: prompt, tools: [{ type: 'web_search' }] }) });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error?.message || `OpenAI request failed (${response.status})`);
  const data = await response.json();
  const fullText = (data.output || []).filter(item => item.type === 'message').flatMap(item => item.content || []).filter(item => ['output_text', 'text'].includes(item.type)).map(item => item.text).join('\n') || data.choices?.[0]?.message?.content || '';
  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Response did not contain valid JSON');
  return JSON.parse(jsonMatch[0]);
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const airportCode = String(req.body?.airportCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(airportCode)) return res.status(400).json({ error: 'A valid airport code is required' });

  try {
    const cached = await getCached(airportCode);
    if (cached) return res.status(200).json({ data: { ...cached, cached: true } });
    const verifiedAt = new Date().toISOString();
    const guide = normalizeAirportGuide(await research(airportCode), airportCode, verifiedAt);
    const relief = { airportName: guide.airportName, areas: guide.petReliefAreas, summary: guide.summary };
    const cacheResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/airport_relief_areas`, { method: 'POST', headers: { ...serviceHeaders(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ airport_code: airportCode, airport_name: guide.airportName, relief_areas_json: relief, researched_at: verifiedAt, guide_json: guide, source_urls: guide.officialSources, last_verified_at: verifiedAt, verification_status: 'ai_researched' }) });
    if (!cacheResponse.ok) console.error('Failed to cache airport guide:', cacheResponse.status, await cacheResponse.text());
    return res.status(200).json({ data: { ...guide, cached: false } });
  } catch (error) {
    console.error('Airport guide research failed:', error.message);
    return res.status(500).json({ error: 'Could not research this airport right now — please try again.' });
  }
}
