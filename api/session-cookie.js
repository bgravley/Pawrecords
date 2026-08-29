// Synchronizes a validated Supabase access token into an HttpOnly cookie used
// only by same-origin private file requests. The raw token is never placed in
// document URLs.

const COOKIE_NAME = 'ypp_file_session';

function cookie(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function validateUser(token) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are not configured');

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookie('', 0));
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await validateUser(token);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    // Supabase access tokens are short lived and will be refreshed by the
    // client. The auth-state listener refreshes this cookie whenever that
    // happens, so keep the cookie short lived as well.
    res.setHeader('Set-Cookie', cookie(encodeURIComponent(token), 3600));
    return res.status(204).end();
  } catch (error) {
    console.error('Session cookie validation failed:', error);
    return res.status(503).json({ error: 'Session validation unavailable' });
  }
}
