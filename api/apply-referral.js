// Applies an active affiliate referral to the authenticated account once.
// The browser cannot update referral_code_used directly after the matching
// column-privilege migration, and cannot claim somebody else's account.
import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

const REFERRAL_CODE_RE = /^[A-Z0-9_-]{1,80}$/;

function serviceHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function readRows(path) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: serviceHeaders(),
  });
  if (!response.ok) throw new Error(`Referral lookup unavailable (${response.status})`);
  return response.json();
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const code = typeof req.body?.referralCode === 'string'
    ? req.body.referralCode.trim().toUpperCase()
    : '';
  if (!REFERRAL_CODE_RE.test(code)) {
    return res.status(400).json({ error: 'Invalid referral code' });
  }

  try {
    const affiliates = await readRows(
      `affiliates?referral_code=eq.${encodeURIComponent(code)}&status=eq.active&select=user_id,referral_code&limit=2`
    );
    if (affiliates?.length !== 1) {
      return res.status(400).json({ error: 'Referral code is unavailable' });
    }
    if (affiliates[0].user_id === auth.userId) {
      return res.status(403).json({ error: 'You cannot use your own referral code' });
    }

    const profilePath = `profiles?id=eq.${encodeURIComponent(auth.userId)}`;
    const profiles = await readRows(`${profilePath}&select=referral_code_used&limit=1`);
    if (!profiles?.length) {
      return res.status(409).json({ error: 'Account setup is still in progress' });
    }
    if (profiles[0].referral_code_used) {
      return res.status(200).json({ applied: false, alreadyApplied: true });
    }

    // The conditional update prevents concurrent requests from overwriting an
    // earlier referral. Only the trusted server role has column write access.
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/${profilePath}&referral_code_used=is.null`,
      {
        method: 'PATCH',
        headers: serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify({ referral_code_used: code }),
      }
    );
    if (!response.ok) throw new Error(`Referral save unavailable (${response.status})`);
    const rows = await response.json();
    return res.status(200).json({ applied: rows.length === 1, alreadyApplied: rows.length === 0 });
  } catch (error) {
    console.error('Referral application failed:', error.message);
    return res.status(503).json({ error: 'Could not apply your referral right now' });
  }
}
