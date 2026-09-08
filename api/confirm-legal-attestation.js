import { createClient } from '@supabase/supabase-js';
import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

const LEGAL_ATTESTATION_VERSION = '2026-09-07';
const METHODS = new Set(['email_signup', 'google_signup', 'post_auth_gate']);

function noStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function adminClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    const error = new Error('Server not configured');
    error.status = 503;
    throw error;
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  noStore(res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const confirmed = req.body?.confirmed === true;
  const method = typeof req.body?.method === 'string' ? req.body.method : '';
  if (!confirmed) return res.status(400).json({ error: 'Explicit confirmation is required' });
  if (!METHODS.has(method)) return res.status(400).json({ error: 'Invalid confirmation method' });

  try {
    const supabase = adminClient();
    const { data: existing, error: readError } = await supabase.auth.admin.getUserById(auth.userId);
    if (readError || !existing?.user) throw new Error('Could not load account confirmation state');

    const current = existing.user.app_metadata || {};
    if (current.ypp_legal_attestation_version === LEGAL_ATTESTATION_VERSION && current.ypp_adult_attested_at) {
      return res.status(200).json({
        confirmed: true,
        version: LEGAL_ATTESTATION_VERSION,
        attestedAt: current.ypp_adult_attested_at,
        method: current.ypp_legal_attestation_method || null,
      });
    }

    const attestedAt = new Date().toISOString();
    const { error: updateError } = await supabase.auth.admin.updateUserById(auth.userId, {
      app_metadata: {
        ...current,
        ypp_legal_attestation_version: LEGAL_ATTESTATION_VERSION,
        ypp_adult_attested_at: attestedAt,
        ypp_legal_attestation_method: method,
      },
    });
    if (updateError) throw new Error('Could not save account confirmation');

    return res.status(200).json({
      confirmed: true,
      version: LEGAL_ATTESTATION_VERSION,
      attestedAt,
      method,
    });
  } catch (error) {
    console.error('Legal attestation error:', error.message);
    return res.status(error.status || 500).json({ error: 'Could not save your confirmation — please try again.' });
  }
}
