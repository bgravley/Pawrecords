import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let adminClient;

function admin() {
  if (!adminClient) adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}

function expiresInThirtyDays() {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + 30);
  return value.toISOString();
}

async function publicSummary(token) {
  const db = admin();
  const { data: trip, error } = await db.from('trips')
    .select('id,user_id,name,origin_city,origin_country,destination_city,destination_country,departure_date,return_date,airline,flight_number,transportation_type,air_travel_arrangements,pet_ids,travel_share_expires_at')
    .eq('travel_share_token', token).eq('travel_share_enabled', true)
    .gt('travel_share_expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw error;
  if (!trip) return null;

  const petIds = Array.isArray(trip.pet_ids) ? trip.pet_ids.filter(id => UUID_RE.test(id)) : [];
  const [legsResult, documentsResult, checklistResult, petsResult] = await Promise.all([
    db.from('trip_legs').select('origin_city,origin_country,origin_airport_code,destination_city,destination_country,destination_airport_code,departure_date,transportation_type,airline,flight_number,leg_order').eq('trip_id', trip.id).eq('user_id', trip.user_id).order('leg_order'),
    db.from('trip_documents').select('name,doc_type,doc_date,is_entry_document,notes').eq('trip_id', trip.id).eq('user_id', trip.user_id).order('created_at'),
    db.from('trip_checklist_items').select('title,category,is_completed,readiness_status,document_name,source_url,source_authority,last_verified_at').eq('trip_id', trip.id).eq('user_id', trip.user_id).order('sort_order'),
    petIds.length ? db.from('dogs').select('id,name,species,breed,color,photo_url,microchip,pet_type,is_service_animal,is_esa,emergency_contact,emergency_phone').eq('user_id', trip.user_id).in('id', petIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [legsResult, documentsResult, checklistResult, petsResult]) if (result.error) throw result.error;
  delete trip.user_id;
  delete trip.pet_ids;
  return { trip, legs: legsResult.data || [], documents: documentsResult.data || [], checklist: checklistResult.data || [], pets: petsResult.data || [] };
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  if (req.method === 'GET') {
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    if (!UUID_RE.test(token)) return res.status(404).json({ error: 'This travel summary link is not available.' });
    try {
      const summary = await publicSummary(token);
      if (!summary) return res.status(404).json({ error: 'This travel summary link is unavailable or has expired.' });
      return res.status(200).json(summary);
    } catch (error) {
      console.error('Travel share lookup failed:', error.message);
      return res.status(500).json({ error: 'The travel summary could not be loaded.' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const verified = await verifyUser(req);
  if (!verified.ok) return res.status(verified.status).json({ error: verified.error });
  const tripId = typeof req.body?.tripId === 'string' ? req.body.tripId : '';
  const action = req.body?.action;
  if (!UUID_RE.test(tripId) || !['enable', 'regenerate', 'disable'].includes(action)) return res.status(400).json({ error: 'Invalid share request.' });

  const update = action === 'disable'
    ? { travel_share_enabled: false, travel_share_token: null, travel_share_expires_at: null }
    : { travel_share_enabled: true, travel_share_token: randomUUID(), travel_share_expires_at: expiresInThirtyDays() };
  const { data, error } = await admin().from('trips').update(update).eq('id', tripId).eq('user_id', verified.userId)
    .select('travel_share_enabled,travel_share_token,travel_share_expires_at').maybeSingle();
  if (error) {
    console.error('Travel share update failed:', error.message);
    return res.status(500).json({ error: 'Your secure link could not be updated.' });
  }
  if (!data) return res.status(404).json({ error: 'Trip not found.' });
  return res.status(200).json(data);
}
