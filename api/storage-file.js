// Authenticated same-origin gateway for files in the private `documents`
// Supabase Storage bucket. Ordinary users can read only their own user-rooted
// paths. Admins can read any path for support/bug review. Explicitly shared
// PDFs under <user-id>/shared-records/ remain public by design.

const COOKIE_NAME = 'ypp_file_session';
const UUID_SHARED_RECORD = /^[0-9a-f-]{36}\/shared-records\//i;

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function safePath(value) {
  if (!value || typeof value !== 'string') return null;
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (decoded.startsWith('/') || decoded.includes('..') || decoded.includes('\\')) return null;
  if (!decoded.split('/').every(Boolean)) return null;
  return decoded;
}

async function getUser(token) {
  if (!token) return null;
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

async function isAdmin(userId) {
  if (!userId) return false;
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!response.ok) return false;
  const rows = await response.json();
  return rows?.[0]?.is_admin === true;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Storage gateway unavailable' });
  }

  const path = safePath(req.query?.path);
  if (!path) return res.status(400).json({ error: 'Invalid file path' });

  const intentionallyShared = UUID_SHARED_RECORD.test(path);
  let user = null;

  if (!intentionallyShared) {
    const token = readCookie(req, COOKIE_NAME);
    user = await getUser(token);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const ownsPath = path.startsWith(`${user.id}/`);
    const admin = ownsPath ? false : await isAdmin(user.id);
    if (!ownsPath && !admin) return res.status(403).json({ error: 'Forbidden' });
  }

  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };
  if (req.headers.range) headers.Range = req.headers.range;

  const upstream = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/object/documents/${encodedPath}`,
    { method: req.method, headers }
  );

  if (!upstream.ok && upstream.status !== 206) {
    const detail = await upstream.text().catch(() => '');
    console.error('Private storage read failed:', upstream.status, detail.slice(0, 250));
    return res.status(upstream.status === 404 ? 404 : 502).json({ error: 'File unavailable' });
  }

  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  res.setHeader('Cache-Control', intentionallyShared ? 'public, max-age=3600' : 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  res.status(upstream.status);
  if (req.method === 'HEAD') return res.end();

  const bytes = Buffer.from(await upstream.arrayBuffer());
  return res.send(bytes);
}
