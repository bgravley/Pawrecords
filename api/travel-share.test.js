import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './travel-share.js';

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

test('invalid public tokens fail closed before database access', async () => {
  const res = response();
  await handler({ method: 'GET', query: { token: 'not-a-token' }, headers: {} }, res);
  assert.equal(res.statusCode, 404);
  assert.match(res.body.error, /not available/i);
  assert.equal(res.headers['Cache-Control'], 'private, no-store, max-age=0');
});

test('preflight exposes only the summary endpoint methods', async () => {
  const res = response();
  await handler({ method: 'OPTIONS', headers: { origin: 'https://yourpetpass.com' } }, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
});

