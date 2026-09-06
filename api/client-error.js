// Privacy-minimized crash reporting for the authenticated YourPetPass web app.
// Client identity is always derived server-side. The browser sends only a
// coarse error type, a sanitized runtime message, and the pathname (no query
// string, request body, stack trace, pet data, medical data, or document data).

import { verifyUser } from './_verifyUser.js';

const ALLOWED_TYPES = new Set(['window_error', 'unhandled_rejection', 'react_error']);
const MAX_REPORTS_PER_HOUR = 20;

function serviceHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    ...extra,
  };
}

function sanitizeMessage(value) {
  let text = typeof value === 'string' ? value : 'Client application error';
  text = text.slice(0, 1200);

  // Remove common identifiers/secrets that can appear inside library errors.
  text = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]{10,})?\b/g, '[token]')
    .replace(/\b(?:access_token|refresh_token|apikey|api_key|token)=([^\s&]+)/gi, '$1=[redacted]')
    .replace(/https?:\/\/[^\s)\]}]+/gi, (raw) => {
      try {
        const url = new URL(raw);
        return `${url.origin}${url.pathname}`;
      } catch {
        return '[url]';
      }
    })
    // JSON/quoted values are the likeliest place for user-entered record data
    // to leak into a thrown server/library message. Keep the field shape while
    // dropping the value.
    .replace(/"[^"\r\n]{1,160}"/g, '"[redacted]"')
    .replace(/'[^'\r\n]{1,160}'/g, "'[redacted]'")
    .replace(/\s+/g, ' ')
    .trim();

  return text.slice(0, 500) || 'Client application error';
}

function sanitizeRoute(value) {
  if (typeof value !== 'string') return '/';
  const withoutQuery = value.split(/[?#]/, 1)[0] || '/';
  if (!withoutQuery.startsWith('/')) return '/';
  // The route is diagnostic context only. Restrict it to path-like characters
  // so arbitrary record text cannot be smuggled into error_log via this field.
  if (!/^\/[A-Za-z0-9/_\-.]*$/.test(withoutQuery)) return '/';
  return withoutQuery.slice(0, 160);
}

async function recentReportCount(userId) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/error_log?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(since)}&context=like.client%3A*&select=id`,
    {
      headers: serviceHeaders({
        Prefer: 'count=exact',
        'Range-Unit': 'items',
        Range: '0-0',
      }),
    }
  );
  if (!response.ok) throw new Error(`client error rate-limit query failed (${response.status})`);
  const contentRange = response.headers.get('content-range') || '';
  const total = Number(contentRange.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

async function insertReport({ userId, userEmail, type, route, message }) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/error_log`, {
    method: 'POST',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({
      user_id: userId,
      user_email: userEmail || null,
      context: `client:${type}:${route}`.slice(0, 300),
      error_message: message,
      reviewed: false,
    }),
  });
  if (!response.ok) throw new Error(`client error insert failed (${response.status})`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Crash reporting unavailable' });
  }

  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const type = typeof body.type === 'string' ? body.type : '';
  if (!ALLOWED_TYPES.has(type)) return res.status(400).json({ error: 'Invalid error type' });

  const route = sanitizeRoute(body.route);
  const message = sanitizeMessage(body.message);

  try {
    const count = await recentReportCount(auth.userId);
    if (count >= MAX_REPORTS_PER_HOUR) {
      // Deliberately return success so a crash loop does not keep retrying.
      return res.status(202).json({ accepted: false, rateLimited: true });
    }

    await insertReport({
      userId: auth.userId,
      userEmail: auth.email,
      type,
      route,
      message,
    });
    return res.status(202).json({ accepted: true });
  } catch (error) {
    console.error('Client crash reporting backend failed:', error.message);
    return res.status(503).json({ error: 'Crash reporting unavailable' });
  }
}
