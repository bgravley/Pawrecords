import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { requireAdmin } from './_requireAdmin.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ENV_KEYS = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_KEY: 'server-test-key' };
let originalFetch;
let originalEnv;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalEnv = Object.fromEntries(Object.keys(ENV_KEYS).map(key => [key, process.env[key]]));
  Object.assign(process.env, ENV_KEYS);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function mockRequest(auth = 'Bearer customer-token') {
  return { headers: { authorization: auth } };
}

function mockAuth(isAdmin, email = 'customer@example.com') {
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    if (String(url).endsWith('/auth/v1/user')) {
      return Response.json({ id: USER_ID, email });
    }
    if (String(url).includes('/rest/v1/profiles?')) {
      return Response.json([{ is_admin: isAdmin, email }]);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  return urls;
}

test('administrator access requires the server-managed is_admin flag', async () => {
  const urls = mockAuth(true);
  const result = await requireAdmin(mockRequest());
  assert.equal(result.ok, true);
  assert.equal(result.userId, USER_ID);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /select=is_admin/);
});

test('matching the former founder email never grants administrator access', async () => {
  mockAuth(false, 'bgravley@rdmarketingllc.com');
  const result = await requireAdmin(mockRequest());
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test('unauthenticated calls are rejected before a profile lookup', async () => {
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('unexpected'); };
  const result = await requireAdmin(mockRequest(''));
  assert.equal(result.status, 401);
  assert.equal(fetchCalls, 0);
});

test('profile service failure denies administrator access', async () => {
  globalThis.fetch = async url => String(url).endsWith('/auth/v1/user')
    ? Response.json({ id: USER_ID, email: 'admin@example.com' })
    : new Response(null, { status: 503 });
  const result = await requireAdmin(mockRequest());
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
});
