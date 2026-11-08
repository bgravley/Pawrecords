// Centralized server-side administrator authorization.
// `profiles.is_admin` is a service-managed field. The database migration in
// this security release revokes all browser-role writes to that column.
// Never accept an email or admin flag supplied by the caller as proof of role.
import { verifyUser } from './_verifyUser.js';

export async function requireAdmin(req) {
  const auth = await verifyUser(req);
  if (!auth.ok) return auth;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  let response;
  try {
    response = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(auth.userId)}&select=is_admin&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
  } catch {
    return { ok: false, status: 502, error: 'Could not verify administrator access.' };
  }
  if (!response.ok) {
    return { ok: false, status: 502, error: 'Could not verify administrator access.' };
  }

  const profiles = await response.json().catch(() => null);
  if (profiles?.[0]?.is_admin !== true) {
    return { ok: false, status: 403, error: 'Admin access required' };
  }

  return auth;
}
