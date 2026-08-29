import { timingSafeEqual } from 'node:crypto';

function safeEqual(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyCronRequest(req, { header = 'authorization', bearer = true } = {}) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, status: 503, error: 'Cron authentication is not configured' };
  }

  const raw = req.headers[header];
  const supplied = Array.isArray(raw) ? raw[0] : raw;
  const expected = bearer ? `Bearer ${secret}` : secret;
  if (typeof supplied !== 'string' || !safeEqual(supplied, expected)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true, secret };
}
