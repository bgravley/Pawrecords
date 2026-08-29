import crypto from 'node:crypto';

const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks';
const AUDIENCE = 'yourpetpass-production-e2e';
const REPOSITORY = 'bgravley/Pawrecords';
const REPOSITORY_ID = '1248461693';
const REPOSITORY_OWNER = 'bgravley';
const REPOSITORY_OWNER_ID = '196063928';
const WORKFLOW_REF = 'bgravley/Pawrecords/.github/workflows/live-smoke.yml@refs/heads/main';
const ALLOWED_EVENTS = new Set(['push', 'schedule', 'workflow_dispatch']);
const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_AGE_SECONDS = 15 * 60;

let jwksCache = null;
let jwksCachedAt = 0;
const JWKS_CACHE_MS = 10 * 60 * 1000;

export class GitHubOidcError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function decodeJsonPart(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new GitHubOidcError(401, 'Invalid GitHub Actions identity token');
  }
}

async function getJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCachedAt < JWKS_CACHE_MS) return jwksCache;

  const response = await fetch(JWKS_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new GitHubOidcError(503, 'GitHub identity verification unavailable');

  const body = await response.json();
  if (!Array.isArray(body?.keys)) throw new GitHubOidcError(503, 'GitHub identity verification unavailable');
  jwksCache = body.keys;
  jwksCachedAt = now;
  return jwksCache;
}

function audienceMatches(aud) {
  if (typeof aud === 'string') return aud === AUDIENCE;
  return Array.isArray(aud) && aud.length === 1 && aud[0] === AUDIENCE;
}

export async function verifyGitHubActionsOidc(token) {
  if (typeof token !== 'string' || token.length < 100 || token.length > 20000) {
    throw new GitHubOidcError(401, 'GitHub Actions identity required');
  }

  const parts = token.split('.');
  if (parts.length !== 3) throw new GitHubOidcError(401, 'Invalid GitHub Actions identity token');

  const header = decodeJsonPart(parts[0]);
  const claims = decodeJsonPart(parts[1]);
  if (header.alg !== 'RS256' || header.typ !== 'JWT' || typeof header.kid !== 'string') {
    throw new GitHubOidcError(401, 'Invalid GitHub Actions identity token');
  }

  const jwks = await getJwks();
  const jwk = jwks.find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) {
    jwksCache = null;
    const refreshed = await getJwks();
    const refreshedJwk = refreshed.find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!refreshedJwk) throw new GitHubOidcError(401, 'Unknown GitHub signing key');
    return verifyWithKey(token, parts, claims, refreshedJwk);
  }

  return verifyWithKey(token, parts, claims, jwk);
}

function verifyWithKey(_token, parts, claims, jwk) {
  let publicKey;
  try {
    publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw new GitHubOidcError(503, 'GitHub identity verification unavailable');
  }

  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
  let signature;
  try {
    signature = Buffer.from(parts[2], 'base64url');
  } catch {
    throw new GitHubOidcError(401, 'Invalid GitHub Actions identity token');
  }

  const validSignature = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
  if (!validSignature) throw new GitHubOidcError(401, 'Invalid GitHub Actions identity token');

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER || !audienceMatches(claims.aud)) {
    throw new GitHubOidcError(403, 'GitHub Actions identity not authorized');
  }
  if (!Number.isFinite(claims.exp) || claims.exp < now - CLOCK_SKEW_SECONDS) {
    throw new GitHubOidcError(401, 'Expired GitHub Actions identity token');
  }
  if (Number.isFinite(claims.nbf) && claims.nbf > now + CLOCK_SKEW_SECONDS) {
    throw new GitHubOidcError(401, 'GitHub Actions identity token is not active');
  }
  if (!Number.isFinite(claims.iat) || claims.iat > now + CLOCK_SKEW_SECONDS || claims.iat < now - MAX_TOKEN_AGE_SECONDS) {
    throw new GitHubOidcError(401, 'Stale GitHub Actions identity token');
  }

  const allowed =
    claims.repository === REPOSITORY &&
    String(claims.repository_id) === REPOSITORY_ID &&
    claims.repository_owner === REPOSITORY_OWNER &&
    String(claims.repository_owner_id) === REPOSITORY_OWNER_ID &&
    claims.workflow_ref === WORKFLOW_REF &&
    claims.workflow === 'Live Production Smoke' &&
    claims.ref === 'refs/heads/main' &&
    claims.ref_type === 'branch' &&
    claims.runner_environment === 'github-hosted' &&
    claims.repository_visibility === 'public' &&
    ALLOWED_EVENTS.has(claims.event_name);

  if (!allowed) throw new GitHubOidcError(403, 'GitHub Actions workflow not authorized');

  return claims;
}

export function readGitHubOidcBearer(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) throw new GitHubOidcError(401, 'GitHub Actions identity required');
  return auth.slice(7).trim();
}
