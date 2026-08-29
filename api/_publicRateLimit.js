// Shared fail-closed rate limiting for intentionally public YourPetPass forms.
// If the backing log cannot be checked or written, the form is temporarily
// unavailable rather than silently accepting unlimited submissions.

export async function checkPublicRateLimit({ ip, form, limit, windowMs }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(`Public rate-limit configuration missing (${form || 'unknown-form'})`);
    return {
      ok: false,
      status: 503,
      error: 'Submission service is temporarily unavailable. Please try again shortly.',
    };
  }

  const safeIp = String(ip || 'unknown').slice(0, 128);
  const safeForm = String(form || 'public-form').slice(0, 64);
  const since = new Date(Date.now() - windowMs).toISOString();
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const countRes = await fetch(
      `${supabaseUrl}/rest/v1/rate_limit_log?ip=eq.${encodeURIComponent(safeIp)}&form=eq.${encodeURIComponent(safeForm)}&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { headers: { ...headers, Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' } }
    );
    if (!countRes.ok) {
      const detail = await countRes.text().catch(() => '');
      throw new Error(`count failed ${countRes.status}: ${detail.slice(0, 120)}`);
    }

    const countHeader = countRes.headers.get('content-range');
    const count = countHeader ? parseInt(countHeader.split('/')[1], 10) || 0 : 0;

    const logRes = await fetch(`${supabaseUrl}/rest/v1/rate_limit_log`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ ip: safeIp, form: safeForm }),
    });
    if (!logRes.ok) {
      const detail = await logRes.text().catch(() => '');
      throw new Error(`log failed ${logRes.status}: ${detail.slice(0, 120)}`);
    }

    return { ok: true, limited: count >= limit };
  } catch (error) {
    console.error(`Public rate-limit backend unavailable (${safeForm}):`, error.message);
    return {
      ok: false,
      status: 503,
      error: 'Submission service is temporarily unavailable. Please try again shortly.',
    };
  }
}
