import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTravelSummaryHtml, categorizeTravelDocuments, escapeHtml, petTravelDetails } from './travelSummary.js';

test('escapes user-supplied summary text', () => {
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

test('groups health documents, permits and labs', () => {
  const grouped = categorizeTravelDocuments([
    { name: 'Health certificate' }, { name: 'Import permit' }, { name: 'Rabies titer lab' }, { name: 'Booking receipt' },
  ]);
  assert.deepEqual(Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, value.length])), { health: 1, permits: 1, labs: 1, other: 1 });
});

test('keeps service classification separate from travel arrangement', () => {
  const pets = petTravelDetails({ air_travel_arrangements: { version: 1, by_pet: { p1: { arrangement: 'in_cabin_service_animal' } } } }, [{ id: 'p1', pet_type: 'pet' }]);
  assert.equal(pets[0].pet_type, 'pet');
  assert.equal(pets[0].travel_arrangement, 'in_cabin_service_animal');
});

test('prints official fees individually without a calculated total', () => {
  const html = buildTravelSummaryHtml({ trip: { origin_city: 'Miami', origin_country: 'United States', destination_city: 'Quito', destination_country: 'Ecuador', travel_support: {} }, checklist: [{ title: 'Inspection fee', fee_amount: 25, fee_currency: 'USD', fee_basis: 'per pet', source_url: 'https://gov.example/fee', fee_last_checked_at: '2026-09-15' }] });
  assert.match(html, /Inspection fee: USD 25/);
  assert.match(html, /not an estimated trip total/);
  assert.doesNotMatch(html, /Estimated Total/);
});


test('rejects unsafe source URLs in printable HTML', () => {
  const html = buildTravelSummaryHtml({
    trip: { origin_city: 'Quito', origin_country: 'Ecuador', destination_city: 'Miami', destination_country: 'United States', travel_support: {} },
    checklist: [
      { title: 'Unsafe source', source_url: 'javascript:alert(1)', source_authority: 'Fake authority' },
      { title: 'Safe source', source_url: 'https://example.gov/rules', source_authority: 'Official authority' },
    ],
    shareUrl: 'javascript:alert(2)',
  });
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /https:\/\/example\.gov\/rules/);
  assert.match(html, /Source needed/);
});
