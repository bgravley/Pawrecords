import test from 'node:test';
import assert from 'node:assert/strict';
import { categorizeTravelDocuments, escapeHtml, petTravelDetails } from './travelSummary.js';

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

