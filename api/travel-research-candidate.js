// REVIEW BRANCH ONLY — do not deploy to production before explicit approval.
// Records aggregate route demand and creates/updates a NOINDEX publication candidate.
// It deliberately does not publish content and does not store private itinerary details.

import { setCorsHeaders } from './_cors.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const authHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

const cleanCountry = value => String(value || '').trim().slice(0, 100);
const cleanSpecies = value => ['dog','cat'].includes(value) ? value : 'unknown';
const cleanMode = value => ['air','land','sea'].includes(value) ? value : 'unknown';
const slugify = value => cleanCountry(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

async function rest(path, options={}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const body = await response.json().catch(()=>[]);
  if (!response.ok) throw new Error(`Knowledge write failed (${response.status})`);
  return body;
}

async function findJurisdiction(slug) {
  const rows = await rest(`travel_jurisdictions?slug=eq.${encodeURIComponent(slug)}&select=id,slug,display_name&limit=1`);
  return rows?.[0] || null;
}

export default async function handler(req,res) {
  setCorsHeaders(req,res);
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({error:'Knowledge service is not configured'});

  const origin=cleanCountry(req.body?.origin);
  const destination=cleanCountry(req.body?.destination);
  const species=cleanSpecies(req.body?.species);
  const transportationMode=cleanMode(req.body?.transportation_mode);
  if (!origin || !destination) return res.status(400).json({error:'Origin and destination are required'});

  try {
    // Aggregate only: no travel date, user ID, pet ID, city, airline, notes, or other itinerary data.
    const demandPath = `travel_route_demand?origin_country=eq.${encodeURIComponent(origin)}&destination_country=eq.${encodeURIComponent(destination)}&species=eq.${species}&transportation_mode=eq.${transportationMode}&select=id,request_count&limit=1`;
    const existing=(await rest(demandPath))?.[0];
    if (existing) {
      await rest(`travel_route_demand?id=eq.${existing.id}`,{
        method:'PATCH',
        body:JSON.stringify({request_count:Number(existing.request_count||0)+1,last_requested_at:new Date().toISOString()})
      });
    } else {
      await rest('travel_route_demand',{
        method:'POST',
        body:JSON.stringify({origin_country:origin,destination_country:destination,species,transportation_mode:transportationMode})
      });
    }

    const destinationJurisdiction=await findJurisdiction(slugify(destination));
    const originJurisdiction=await findJurisdiction(slugify(origin));

    let candidate=null;
    if (destinationJurisdiction) {
      const query=`travel_guide_candidates?destination_jurisdiction_id=eq.${destinationJurisdiction.id}&species=eq.${species}&transportation_mode=eq.${transportationMode}&status=neq.withdrawn&select=id,status,noindex,proposed_slug&limit=1`;
      candidate=(await rest(query))?.[0] || null;
      if (!candidate) {
        const created=await rest('travel_guide_candidates',{
          method:'POST',
          body:JSON.stringify({
            destination_jurisdiction_id:destinationJurisdiction.id,
            origin_jurisdiction_id:originJurisdiction?.id || null,
            species,
            transportation_mode:transportationMode,
            proposed_slug:destinationJurisdiction.slug,
            proposed_title:`${destinationJurisdiction.display_name} Pet Entry Requirements`,
            distinct_intent:'User-requested route; requires source verification and cannibalization/material-distinction review.',
            status:'draft',
            noindex:true
          })
        });
        candidate=created?.[0] || null;
      }
    }

    return res.status(200).json({
      recorded:true,
      candidate: candidate ? {id:candidate.id,status:candidate.status,noindex:true} : null,
      publication_status:'review_required',
      message:'Route demand recorded. Any publication candidate remains noindex until source and editorial review.'
    });
  } catch(error) {
    console.error('travel-research-candidate error:',error.message);
    return res.status(500).json({error:'Could not record route research candidate'});
  }
}
