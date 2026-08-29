import { timingSafeEqual } from 'node:crypto';

export function verifyInternalWebhook(req) {
  const expected = process.env.SIGNUP_WEBHOOK_SECRET;
  if (!expected) {
    return { ok: false, status: 503, error: 'Webhook authentication is not configured' };
  }

  const raw = req.headers['x-webhook-secret'];
  const supplied = Array.isArray(raw) ? raw[0] : raw;
  if (!supplied || typeof supplied !== 'string') {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
}
