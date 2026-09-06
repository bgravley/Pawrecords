import crypto from 'node:crypto';

const TOKEN_VERSION = 'v1';
const PURPOSE = 'yourpetpass:notification-unsubscribe:v1';
const CANONICAL_HOST = 'https://www.yourpetpass.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signingSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_KEY;
  if (!secret || secret.length < 32) {
    const error = new Error('Unsubscribe signing unavailable');
    error.status = 503;
    throw error;
  }
  return secret;
}

function signatureFor(userId) {
  return crypto
    .createHmac('sha256', signingSecret())
    .update(`${PURPOSE}:${userId}`)
    .digest('base64url');
}

export function createUnsubscribeToken(userId) {
  if (!UUID_RE.test(userId || '')) throw new Error('Invalid unsubscribe subject');
  const subject = Buffer.from(userId, 'utf8').toString('base64url');
  return `${TOKEN_VERSION}.${subject}.${signatureFor(userId)}`;
}

export function verifyUnsubscribeToken(token) {
  if (typeof token !== 'string' || token.length > 256) return null;
  const [version, encodedSubject, suppliedSignature, ...extra] = token.split('.');
  if (version !== TOKEN_VERSION || !encodedSubject || !suppliedSignature || extra.length) return null;

  let userId = '';
  try {
    userId = Buffer.from(encodedSubject, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!UUID_RE.test(userId)) return null;

  const expected = Buffer.from(signatureFor(userId));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length) return null;
  if (!crypto.timingSafeEqual(expected, supplied)) return null;
  return { userId };
}

export function unsubscribePageUrlForUser(userId) {
  const token = createUnsubscribeToken(userId);
  return `${CANONICAL_HOST}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function unsubscribeApiUrlForUser(userId) {
  const token = createUnsubscribeToken(userId);
  return `${CANONICAL_HOST}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}
