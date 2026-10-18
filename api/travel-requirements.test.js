import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './travel-requirements.js';

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

test('published destination queries requirements from the guide origin only', async () => {
  const originalFetch = global.fetch;
  const oldEnv = { ...process.env };
  Object.assign(process.env, {
    SUPABASE_URL: 'https://example.invalid',
    SUPABASE_SERVICE_KEY: 'test-only',
  });
  const destinationId = '11111111-1111-4111-8111-111111111111';
  const originId = '22222222-2222-4222-8222-222222222222';
  const sourceId = '33333333-3333-4333-8333-333333333333';
  const urls = [];
  try {
    global.fetch = async url => {
      urls.push(String(url));
      if (String(url).includes('travel_jurisdictions?')) {
        return new Response(JSON.stringify([{ id: destinationId, slug: 'united-states', display_name: 'United States', iso2: 'US' }]));
      }
      if (String(url).includes('travel_guide_candidates?')) {
        return new Response(JSON.stringify([{
          destination_jurisdiction_id: destinationId,
          origin_jurisdiction_id: originId,
          status: 'published',
          noindex: false,
          public_path: '/pet-travel-requirements/united-states/',
          proposed_title: 'United States Pet Entry Requirements',
          scope_label: 'Canada → United States · dogs & cats · air & land',
          guide_summary: 'Reviewed route.',
          editorial_reviewed_at: '2026-10-18T14:15:00Z',
        }]));
      }
      if (String(url).includes('travel_requirements?')) {
        return new Response(JSON.stringify([{
          id: '44444444-4444-4444-8444-444444444444',
          species: 'dog',
          transportation_mode: 'all',
          travel_arrangement: 'all',
          requirement_type: 'permit',
          title: 'Complete the CDC form',
          rule_text: 'Each dog needs a receipt.',
          importance: 'critical',
          review_state: 'published',
          source_id: sourceId,
        }]));
      }
      if (String(url).includes('travel_sources?')) {
        return new Response(JSON.stringify([{
          id: sourceId,
          authority_name: 'CDC',
          authority_type: 'government',
          source_scope: 'legal_requirement',
          url: 'https://www.cdc.gov/importation/dogs/rabies-free-low-risk-countries.html',
          title: 'Entry Requirements',
          last_checked_at: '2026-10-18T14:15:00Z',
          review_state: 'source_verified',
        }]));
      }
      return new Response('[]');
    };

    const res = response();
    await handler({ method: 'GET', query: { destination: 'United States' }, headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'published');
    const requirementUrl = urls.find(url => url.includes('travel_requirements?'));
    assert.match(requirementUrl, new RegExp(`destination_jurisdiction_id=eq\\.${destinationId}`));
    assert.match(requirementUrl, new RegExp(`origin_jurisdiction_id=eq\\.${originId}`));
    assert.equal(res.body.requirements.length, 1);
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
  }
});
