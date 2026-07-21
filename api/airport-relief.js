// api/airport-relief.js
// Pet relief area info for a specific airport (IATA code) -- where to take
// a dog/cat to go to the bathroom before/after/during a flight, indoor vs
// outdoor, which terminal, etc. Same cache-then-research pattern as
// ai-travel.js: check airport_relief_areas first (90-day TTL -- these
// locations don't change nearly as often as country entry requirements),
// research with OpenAI's web search if missing or stale, cache the result.

import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

const CACHE_TTL_DAYS = 90;

async function getCached(airportCode) {
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/airport_relief_areas?airport_code=eq.${encodeURIComponent(airportCode)}&researched_at=gte.${cutoff}&select=*&limit=1`,
    { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

async function research(airportCode) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const prompt = `Research the pet relief area(s) at airport ${airportCode} (IATA code). A pet relief area is a designated spot for service animals and pets to go to the bathroom.

Search the web now for official airport information (the airport's own website is the best source; airport pet policy pages, TSA/airport authority pages).

Return ONLY a valid JSON object, no markdown, no backticks, no explanation text, in this exact shape:
{
  "airportName": "full airport name",
  "areas": [
    { "location": "specific location description, e.g. 'Terminal 3, near Gate D5, pre-security'", "terminal": "terminal identifier if known, else null", "type": "indoor" or "outdoor", "notes": "any relevant detail -- artificial turf, water fountain, bags provided, pre- or post-security" }
  ],
  "summary": "one or two sentence plain-language summary a pet owner could read at a glance"
}

If you cannot find reliable official information for this airport, return areas as an empty array and say so honestly in the summary -- do not invent locations.`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o', input: prompt, tools: [{ type: 'web_search' }] }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI request failed (${response.status})`);
  }
  const data = await response.json();

  let fullText = '';
  try {
    const messageItems = (data.output || []).filter(item => item.type === 'message');
    const textParts = [];
    for (const item of messageItems) {
      for (const c of (item.content || [])) {
        if (c.type === 'output_text' && c.text) textParts.push(c.text);
        if (c.type === 'text' && c.text) textParts.push(c.text);
      }
    }
    fullText = textParts.join('\n');
  } catch (e) {
    console.error('Unexpected response shape:', e.message);
  }
  if (!fullText && data.choices?.[0]?.message?.content) fullText = data.choices[0].message.content;
  if (!fullText) throw new Error('Could not extract a response from OpenAI');

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

  const airportCode = (req.body?.airportCode || '').trim().toUpperCase();
  if (!airportCode || airportCode.length > 4) {
    return res.status(400).json({ error: 'A valid airport code is required' });
  }

  try {
    const cached = await getCached(airportCode);
    if (cached) {
      return res.status(200).json({ data: { ...cached.relief_areas_json, airportCode, cached: true } });
    }

    const result = await research(airportCode);

    // Cache regardless of whether areas were found, so a "we don't have
    // reliable info for this one" answer doesn't trigger a fresh (paid)
    // research call every single time someone views this trip.
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/airport_relief_areas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        airport_code: airportCode,
        airport_name: result.airportName || null,
        relief_areas_json: result,
        researched_at: new Date().toISOString(),
      }),
    }).catch(e => console.error('Failed to cache relief area result (non-critical):', e.message));

    return res.status(200).json({ data: { ...result, airportCode, cached: false } });
  } catch (err) {
    console.error('Airport relief research failed:', err.message);
    return res.status(500).json({ error: 'Could not research this airport right now — please try again.' });
  }
}
