// api/prewarm-cache.js
// Pre-warms the travel route cache for a curated list of common routes,
// so the FIRST real customer asking about a popular route gets an instant,
// free result instead of paying the full research cost themselves.
//
// The route list itself lives in the prewarm_routes table (not hardcoded
// here anymore) so it can grow over time as real routes get researched,
// reviewed and approved in Admin -> Pre-warm Route Cache, without a code
// deploy. See admin-data.js: prewarm_routes / prewarm_route_suggestions /
// prewarm_route_add / prewarm_route_remove.
//
// Can be triggered two ways:
// 1. Manually, on demand, from Admin (POST with a specific route)
// 2. Automatically every week via Vercel cron (runs the full active list)

async function loadActiveRoutes() {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/prewarm_routes?active=eq.true&select=origin_country,destination_country,transportation_mode`,
    { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
  );
  if (!res.ok) {
    console.error('Failed to load prewarm_routes:', res.status, await res.text().catch(() => ''));
    return [];
  }
  const rows = await res.json();
  return rows.map(r => [r.origin_country, r.destination_country, r.transportation_mode]);
}

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.VITE_APP_URL || 'https://yourpetpass.com';

async function warmOneRoute(originCountry, destinationCountry, transportationType) {
  // Calls ai-travel.js the exact same way a real user's browser would —
  // no userId, so it skips the premium/quota check entirely. A generic
  // prompt is built here since there's no real trip/pet attached.
  const prompt = `Generate a complete pet travel checklist for a dog traveling from ${originCountry} to ${destinationCountry} by ${transportationType === 'air' ? 'airplane' : transportationType === 'land' ? 'car (driving across the border)' : transportationType}. Include health certificates, vaccination requirements, and any country-specific import rules. Tag every item with "applies_to": "dog" or "cat" as appropriate, researching cat-specific requirements (FeLV/FIV testing, etc.) where they could plausibly differ from dog requirements. Return ONLY a JSON array of checklist items with fields: title, description, category, applies_to, deadline_days_before, window_start_days, window_end_days, requires_document, source_url, notes.`;

  const res = await fetch(`${APP_URL}/api/ai-travel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Proves this is the trusted prewarm job, not an anonymous caller —
      // see the matching check in ai-travel.js. Without this, ai-travel.js's
      // verifyUser() rejects the request outright (no Authorization header),
      // which is exactly what was happening before this was added: every
      // single prewarm attempt failed at the auth check, 100% of the time.
      'x-prewarm-secret': CRON_SECRET || '',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      userId: null, // no quota check, no premium gate — this is a backend job, not a user request
      userEmail: null,
      destination: `${originCountry} to ${destinationCountry} (prewarm)`,
      originCountry, destinationCountry, transportationType,
    }),
  });

  const data = await res.json();
  return { route: `${originCountry} → ${destinationCountry} (${transportationType})`, ok: res.ok, cached: data.cached || false, error: data.error || null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Two legitimate ways to trigger this: Vercel's cron (sends CRON_SECRET),
  // or a verified admin from the dashboard. Nothing else gets through —
  // this triggers real AI spend, so it can't be left open.
  const isCron = req.headers['authorization'] === `Bearer ${CRON_SECRET}`;
  let isAdmin = false;

  if (!isCron) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const userToken = authHeader.replace('Bearer ', '');
      const verifyRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${userToken}`, 'apikey': process.env.SUPABASE_SERVICE_KEY },
      });
      if (verifyRes.ok) {
        const userData = await verifyRes.json();
        const profileRes = await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}&select=is_admin,email`,
          { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
        );
        if (!profileRes.ok) {
          console.error('Admin profile check failed (failing closed, denying access):', profileRes.status);
        } else {
          const profiles = await profileRes.json();
          isAdmin = profiles?.[0]?.is_admin === true || profiles?.[0]?.email === 'bgravley@rdmarketingllc.com';
        }
      }
    }
  }

  if (!isCron && !isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let routesToWarm;
  if (req.body?.originCountry) {
    // Single specific route, triggered manually from Admin
    routesToWarm = [[req.body.originCountry, req.body.destinationCountry, req.body.transportationType || 'air']];
  } else {
    // Full active list — either the weekly cron, or an admin manually running it all
    routesToWarm = await loadActiveRoutes();
  }

  // Run in parallel — sequential would risk exceeding even a 5-minute
  // function timeout once you're warming a full list of routes.
  const results = await Promise.all(
    routesToWarm.map(async ([origin, destination, mode]) => {
      try {
        return await warmOneRoute(origin, destination, mode);
      } catch (err) {
        return { route: `${origin} → ${destination} (${mode})`, ok: false, error: err.message };
      }
    })
  );

  const newlyWarmed = results.filter(r => r.ok && !r.cached).length;
  const alreadyCached = results.filter(r => r.cached).length;
  const failed = results.filter(r => !r.ok).length;

  console.log(`Pre-warm run: ${newlyWarmed} newly generated, ${alreadyCached} already cached, ${failed} failed`);

  return res.status(200).json({ summary: { newlyWarmed, alreadyCached, failed, total: results.length }, results });
}
