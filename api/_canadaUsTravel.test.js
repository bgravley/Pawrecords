import test from 'node:test';
import assert from 'node:assert/strict';
import { canadaUsBaseline, finalizeCanadaUs, routeRuleCacheKey, validCanadaUsCache, isCanadaUs } from './_canadaUsTravel.js';
import handler from './ai-travel.js';

const item = (description, applies_to = 'dog') => ({title:'Travel task', description, applies_to, requirement_type:'airline_policy', source_type:'airline', source_url:'https://www.aircanada.com/'});
const regressions = [
  item('Cats require the same Canadian health certificate endorsed by CFIA.', 'cat'),
  item('Mandatory for all dogs leaving Canada: CFIA-endorsed export certificate.'),
  item('Complete the CDC Dog Import Form no more than 30 days before travel.'),
  item('Microchip number must be provided on required forms.'),
  item('No additional requirements for cats entering by land.', 'cat'),
  {...item('Check travel details'), notes:'CFIA endorsement mandatory (verify before travel)'},
];
for (const bad of regressions) test(`rejects audited error: ${bad.description}`, () => {
  assert.throws(() => finalizeCanadaUs([bad], 'Canada', 'United States'), /protected rules/);
});
test('canonical baseline contains all species-specific corrections with sources and no invented day window', () => {
  const baseline = canadaUsBaseline();
  assert.equal(baseline.length, 7);
  assert.ok(baseline.every(x => x.source_type === 'government' && /^https:\/\//.test(x.source_url)));
  const find = id => baseline.find(x => x.rule_id === id);
  assert.match(find('cat-certificate').description, /endorsement is not required/);
  assert.match(find('dog-certificate').description, /not a universal requirement/);
  assert.match(find('dog-form').description, /six months from issuance/);
  assert.equal(find('dog-form').window_end_days, null);
  assert.equal(find('dog-form').deadline_days_before, null);
  assert.match(find('dog-chip').description, /does not ask for the microchip number/);
  assert.match(find('cat-entry').description, /including land borders/);
  assert.match(find('cat-state').description, /Hawaii and Guam/);
  assert.match(find('dog-history').description, /history is unknown/);
});
test('versions date/arrangement identity and recognizes aliases without changing other routes', () => {
  for (const dest of ['United States', 'USA', 'U.S.', ' united states of america ']) {
    assert.ok(isCanadaUs(' Canada ', dest));
    assert.notEqual(routeRuleCacheKey('Canada', dest), 'unspecified');
  }
  assert.match(routeRuleCacheKey('Canada', 'US', 'travel-support-v2:2026-12-01:cabin'), /2026-12-01:cabin$/);
  assert.equal(routeRuleCacheKey('US', 'Canada', 'abc'), 'abc');
  assert.equal(routeRuleCacheKey('France', 'US'), 'unspecified');
});
test('cached baseline must be complete and untampered; old and malformed caches miss', () => {
  const baseline = canadaUsBaseline();
  assert.ok(validCanadaUsCache(baseline, 'Canada', 'US'));
  const jsonbOrder = baseline.map(entry => Object.fromEntries(Object.entries(entry).reverse()));
  assert.ok(validCanadaUsCache(jsonbOrder, 'Canada', 'US'), 'JSONB object key ordering must not invalidate a cache hit');
  for (const stale of [regressions, [], null, baseline.slice(1)]) assert.equal(validCanadaUsCache(stale, 'Canada', 'US'), false);
  baseline[1].deadline_days_before = 30;
  assert.equal(validCanadaUsCache(baseline, 'Canada', 'US'), false);
});
test('safe supplemental logistics survive; other routes retain original behavior', () => {
  const extras = [item('Reserve a pet carrier space with your airline.')];
  assert.deepEqual(finalizeCanadaUs(extras, 'Canada', 'US').slice(7), extras);
  assert.equal(finalizeCanadaUs(regressions, 'US', 'Canada'), regressions);
  assert.throws(() => finalizeCanadaUs([null], 'Canada', 'US'), /malformed/);
});
function response() { return {statusCode:200, setHeader(){}, status(n){this.statusCode=n;return this;}, json(x){this.body=x;return this;}, end(){return this;}}; }
test('prewarm pipeline never writes or returns rejected generation; valid output is versioned and cached', async () => {
  const originalFetch = global.fetch;
  const oldEnv = {...process.env};
  Object.assign(process.env, {CRON_SECRET:'test-only',OPENAI_API_KEY:'test-only',SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_KEY:'test-only'});
  delete process.env.ANTHROPIC_API_KEY;
  try {
    for (const [generated, expected] of [[regressions,500],[[],200]]) {
      const calls = [];
      global.fetch = async (url, options = {}) => {
        calls.push({url, options});
        if (url.includes('openai.com')) return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(generated)}]}],usage:{}}));
        if (url.includes('travel_route_cache') && !options.method) return new Response(JSON.stringify([{checklist_json:regressions}]));
        return new Response('[]');
      };
      const res = response();
      await handler({method:'POST',headers:{'x-prewarm-secret':'test-only'},body:{messages:[{content:'Research Canada to US'}],originCountry:'Canada',destinationCountry:'United States',transportationType:'land'}},res);
      assert.equal(res.statusCode,expected);
      const writes = calls.filter(c => c.url.includes('travel_route_cache') && c.options.method === 'POST');
      assert.match(calls.find(c => c.url.includes('travel_route_cache')).url, /ca-us-2026-10-18-v1/);
      if (expected === 500) {
        assert.equal(writes.length,0);
        assert.ok(calls.filter(c => c.url.includes('ai_usage_log')).every(c => JSON.parse(c.options.body).success === false));
      } else {
        assert.equal(writes.length,1);
        assert.deepEqual(JSON.parse(res.body.choices[0].message.content),canadaUsBaseline());
        assert.match(JSON.parse(writes[0].options.body).travel_arrangement_key,/ca-us-2026-10-18-v1/);
      }
    }
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env,oldEnv);
  }
});
