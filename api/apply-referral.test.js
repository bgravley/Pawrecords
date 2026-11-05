import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import handler from './apply-referral.js';

const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
const AFFILIATE_ID = '22222222-2222-4222-8222-222222222222';
let originalFetch;
let originalEnv;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalEnv = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY };
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_KEY = 'server-test-key';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function mockResponse() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(status) { this.statusCode = status; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

function mockRequest(referralCode = ' PETPASS ') {
  return { method: 'POST', headers: { authorization: 'Bearer customer-token' }, body: { referralCode } };
}

function mockBackend({ affiliateId = AFFILIATE_ID, existingReferral = null, profileExists = true } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    calls.push({ path, options });
    if (path.endsWith('/auth/v1/user')) return Response.json({ id: CUSTOMER_ID, email: 'customer@example.com' });
    if (path.includes('/rest/v1/affiliates?')) return Response.json([{ user_id: affiliateId, referral_code: 'PETPASS' }]);
    if (path.includes('/rest/v1/profiles?')) {
      if (options.method === 'PATCH') return Response.json([{ referral_code_used: 'PETPASS' }]);
      return Response.json(profileExists ? [{ referral_code_used: existingReferral }] : []);
    }
    throw new Error(`Unexpected URL: ${path}`);
  };
  return calls;
}

test('valid active referral is written only by the server and only for its verified customer', async () => {
  const calls = mockBackend();
  const res = await handler(mockRequest(), mockResponse());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { applied: true, alreadyApplied: false });
  const patch = calls.find(call => call.options.method === 'PATCH');
  assert.ok(patch);
  assert.match(patch.path, new RegExp(`id=eq.${CUSTOMER_ID}`));
  assert.match(patch.path, /referral_code_used=is.null/);
  assert.deepEqual(JSON.parse(patch.options.body), { referral_code_used: 'PETPASS' });
});

test('self-referral is denied without any account write', async () => {
  const calls = mockBackend({ affiliateId: CUSTOMER_ID });
  const res = await handler(mockRequest(), mockResponse());
  assert.equal(res.statusCode, 403);
  assert.equal(calls.some(call => call.options.method === 'PATCH'), false);
});

test('an existing referral cannot be replaced', async () => {
  const calls = mockBackend({ existingReferral: 'ORIGINAL' });
  const res = await handler(mockRequest(), mockResponse());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { applied: false, alreadyApplied: true });
  assert.equal(calls.some(call => call.options.method === 'PATCH'), false);
});

test('a pending account setup is retriable instead of losing the referral', async () => {
  mockBackend({ profileExists: false });
  const res = await handler(mockRequest(), mockResponse());
  assert.equal(res.statusCode, 409);
});

test('invalid referral input is rejected', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ id: CUSTOMER_ID }); };
  const res = await handler(mockRequest('<script>'), mockResponse());
  assert.equal(res.statusCode, 400);
  assert.equal(calls, 1); // identity verification only
});
