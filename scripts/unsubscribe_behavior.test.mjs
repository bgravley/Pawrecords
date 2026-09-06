import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_SERVICE_KEY = 'test-service-key-'.padEnd(64, 'x');
process.env.SUPABASE_URL = 'https://example.supabase.co';

const { createUnsubscribeToken, verifyUnsubscribeToken } = await import('../api/_unsubscribe.js');
const { default: handler } = await import('../api/unsubscribe.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';

function responseJson(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function installMock(initial = true) {
  let enabled = initial;
  let patchCount = 0;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body || null });
    if (!String(url).startsWith(`${process.env.SUPABASE_URL}/rest/v1/profiles`)) {
      return responseJson({ error: 'unexpected URL' }, 500);
    }

    if ((options.method || 'GET') === 'GET') {
      return responseJson([{ id: USER_ID, email_notifications: enabled }]);
    }
    if (options.method === 'PATCH') {
      const parsed = JSON.parse(options.body || '{}');
      assert.equal(parsed.email_notifications, false);
      enabled = false;
      patchCount += 1;
      return new Response(null, { status: 204 });
    }
    return responseJson({ error: 'unexpected method' }, 500);
  };

  return {
    get enabled() { return enabled; },
    get patchCount() { return patchCount; },
    calls,
  };
}

test('unsubscribe tokens are signed and reject tampering', () => {
  const token = createUnsubscribeToken(USER_ID);
  assert.equal(verifyUnsubscribeToken(token)?.userId, USER_ID);
  assert.equal(verifyUnsubscribeToken(`${token}x`), null);
  assert.equal(verifyUnsubscribeToken('v1.Zm9yZ2Vk.invalid'), null);
});

test('GET cannot change notification preferences', async () => {
  const state = installMock(true);
  const res = makeRes();
  await handler({ method: 'GET', url: '/api/unsubscribe', body: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(state.calls.length, 0);
  assert.equal(state.enabled, true);
});

test('invalid signed token is rejected without Supabase access', async () => {
  const state = installMock(true);
  const res = makeRes();
  await handler({ method: 'POST', url: '/api/unsubscribe?token=v1.Zm9yZ2Vk.invalid', body: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(state.calls.length, 0);
  assert.equal(state.enabled, true);
});

test('valid query token disables reminders exactly once and duplicate delivery is idempotent', async () => {
  const state = installMock(true);
  const token = createUnsubscribeToken(USER_ID);
  const url = `/api/unsubscribe?token=${encodeURIComponent(token)}`;

  let res = makeRes();
  await handler({ method: 'POST', url, body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
  assert.equal(state.enabled, false);
  assert.equal(state.patchCount, 1);

  res = makeRes();
  await handler({ method: 'POST', url, body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
  assert.equal(state.enabled, false);
  assert.equal(state.patchCount, 1);
});

test('valid body token supports the privacy-minimal unsubscribe page flow', async () => {
  const state = installMock(true);
  const token = createUnsubscribeToken(USER_ID);
  const res = makeRes();

  await handler({ method: 'POST', url: '/api/unsubscribe', body: { token } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
  assert.equal(state.enabled, false);
  assert.equal(state.patchCount, 1);
});
