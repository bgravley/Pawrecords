import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'service-test-key';
delete process.env.RESEND_API_KEY;

const { default: handler } = await import('../api/report-bug.js');

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';

function responseJson(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
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
    end() { return this; },
  };
}

function installMock() {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url: String(url), method, body: options.body || null });

    if (String(url) === `${process.env.SUPABASE_URL}/auth/v1/user`) {
      return responseJson({ id: AUTH_USER_ID, email: 'real-user@example.com' });
    }
    if (String(url).includes('/rest/v1/rate_limit_log?')) {
      return responseJson([], 200, { 'content-range': '0-0/0' });
    }
    if (String(url).endsWith('/rest/v1/rate_limit_log') && method === 'POST') {
      return new Response(null, { status: 201 });
    }
    if (String(url).endsWith('/rest/v1/bug_reports') && method === 'POST') {
      return responseJson([{ id: 'report-1' }], 201);
    }
    return responseJson({ error: 'unexpected request' }, 500);
  };
  return calls;
}

function request(body) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer valid-user-token', 'x-forwarded-for': '203.0.113.10' },
    socket: {},
    body,
  };
}

function insertedReport(calls) {
  const call = calls.find(c => c.url.endsWith('/rest/v1/bug_reports') && c.method === 'POST');
  assert.ok(call, 'expected bug_reports insert');
  return JSON.parse(call.body);
}

test('feature requests are stored in the existing authenticated feedback queue', async () => {
  const calls = installMock();
  const res = makeRes();
  await handler(request({
    reportType: 'feature',
    description: 'Please add a printable trip packet.',
    userId: '99999999-9999-4999-8999-999999999999',
    userEmail: 'spoof@example.com',
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.submitted, true);
  assert.equal(res.body?.reportType, 'feature');
  const row = insertedReport(calls);
  assert.equal(row.report_type, 'feature');
  assert.equal(row.user_id, AUTH_USER_ID);
  assert.equal(row.user_email, 'real-user@example.com');
  assert.equal(row.description, 'Please add a printable trip packet.');
});

test('general feedback is accepted as its own category', async () => {
  const calls = installMock();
  const res = makeRes();
  await handler(request({ reportType: 'feedback', description: 'The records screen feels much clearer now.' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(insertedReport(calls).report_type, 'feedback');
});

test('older clients still default to bug reports', async () => {
  const calls = installMock();
  const res = makeRes();
  await handler(request({ description: 'The save button did not respond.' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(insertedReport(calls).report_type, 'bug');
});

test('unknown report categories fail closed and are never inserted', async () => {
  const calls = installMock();
  const res = makeRes();
  await handler(request({ reportType: 'billing_override', description: 'invalid category' }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error, 'Invalid feedback type.');
  assert.equal(calls.some(c => c.url.endsWith('/rest/v1/bug_reports')), false);
});
