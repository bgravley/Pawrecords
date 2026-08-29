// api/_verifyUser.js
// Shared helper: verifies the caller's Supabase auth token and returns their
// REAL, server-verified user id + email. Never trust a userId sent in the
// request body — anyone can type any id there. This confirms the caller
// actually holds a valid session token for that account.
//
// Browser callers can authenticate either with an explicit Bearer token or
// with the short-lived HttpOnly `ypp_file_session` cookie synchronized by the
// signed-in app. The cookie is Secure + SameSite=Lax and the token is always
// revalidated with Supabase before use.

const SESSION_COOKIE = 'ypp_file_session';

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== name) continue;
    try { return decodeURIComponent(rest.join('=')); } catch { return null; }
  }
  return null;
}

function readUserToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return readCookie(req, SESSION_COOKIE);
}

export async function verifyUser(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: 500, error: 'Server not configured' };
  }

  const userToken = readUserToken(req);
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
  if (!userData?.id) {
    return { ok: false, status: 401, error: 'Your session has expired — please sign in again.' };
  }

  return { ok: true, userId: userData.id, email: userData.email || null };
}
