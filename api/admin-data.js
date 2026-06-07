// api/admin-data.js
// Server-side admin data fetcher — uses service role key to bypass RLS
// Only callable with a valid admin check

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { type, userId } = req.body;

  // Verify the requesting user is actually an admin
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const userToken = authHeader.replace('Bearer ', '');

  // Verify token and check admin status
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'apikey': serviceKey,
    }
  });

  if (!verifyRes.ok) return res.status(401).json({ error: 'Invalid token' });

  const userData = await verifyRes.json();
  const requestingUserId = userData.id;

  // Check if user is admin
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${requestingUserId}&select=is_admin,email`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  const profiles = await profileRes.json();
  const isAdmin = profiles?.[0]?.is_admin === true ||
    profiles?.[0]?.email === 'bgravley@rdmarketingllc.com';

  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    if (type === 'users') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'ai_logs') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/ai_usage_log?select=*&order=created_at.desc&limit=500`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'activity') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/activity_log?select=*&order=created_at.desc&limit=200`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'errors') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/error_log?select=*&order=created_at.desc&limit=200`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'user_pets') {
      // Get all pets for a specific user
      const r = await fetch(
        `${supabaseUrl}/rest/v1/dogs?user_id=eq.${userId}&select=*&order=created_at.desc`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'update_user') {
      const { targetUserId, updates } = req.body;
      const r = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify(updates),
        }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'mark_error_reviewed') {
      const { errorId } = req.body;
      const r = await fetch(
        `${supabaseUrl}/rest/v1/error_log?id=eq.${errorId}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ reviewed: true }),
        }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'error_count') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/error_log?reviewed=eq.false&select=id`,
        { headers: { ...headers, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' } }
      );
      const countHeader = r.headers.get('content-range');
      const count = countHeader ? parseInt(countHeader.split('/')[1]) || 0 : 0;
      return res.status(200).json({ count });
    }

    return res.status(400).json({ error: 'Unknown type' });

  } catch (err) {
    console.error('Admin data error:', err);
    return res.status(500).json({ error: err.message });
  }
}
