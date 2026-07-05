// api/_verifyUser.js
// Shared helper: verifies the caller's Supabase auth token and returns their
// REAL, server-verified user id + email. Never trust a userId sent in the
// request body — anyone can type any id there. This confirms the caller
// actually holds a valid session token for that account.
//
// Usage inside a handler:
//   const auth = await verifyUser(req);
//   if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
//   const userId = auth.userId;   // trustworthy from here on
//
// Files prefixed with "_" are treated as helpers by Vercel and are not
// exposed as their own callable endpoints.

export async function verifyUser(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: 500, error: 'Server not configured' };
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    return { ok: false, status: 401, error: 'You must be signed in to do that.' };
  }

  const userToken = authHeader.replace('Bearer ', '').trim();
  if (!userToken) {
    return { ok: false, status: 401, error: 'You must be signed in to do that.' };
  }

  let verifyRes;
  try {
    verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'apikey': serviceKey },
    });
  } catch (err) {
    return { ok: false, status: 502, error: 'Could not verify your session — please try again.' };
  }

  if (!verifyRes.ok) {
    return { ok: false, status: 401, error: 'Your session has expired — please sign in again.' };
  }

  const userData = await verifyRes.json().catch(() => null);
  if (!userData || !userData.id) {
    return { ok: false, status: 401, error: 'Your session has expired — please sign in again.' };
  }

  return { ok: true, userId: userData.id, email: userData.email || null };
}
