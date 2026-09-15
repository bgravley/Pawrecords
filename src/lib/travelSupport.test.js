import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTravelSupport, feeLabel, normalizeTravelSupport, serviceAnimalWorkflows, travelSupportReferenceRows } from './travelSupport.js';

test('normalizes legacy trips without travel support', () => {
  const value = normalizeTravelSupport(null);
  assert.equal(value.version, 1);
  assert.deepEqual(value.destination_vet, { name: '', clinic: '', phone: '', email: '' });
  assert.deepEqual(value.airline_contact, { department: '', phone: '', email: '', website: '' });
});

test('cleans empty nested destination-vet values', () => {
  assert.deepEqual(cleanTravelSupport({ destination_vet: { name: '  Dr. Lee ', phone: '' } }).destination_vet, { name: 'Dr. Lee' });
});

test('formats only exact non-negative fees', () => {
  assert.equal(feeLabel({ fee_amount: '25', fee_currency: 'USD' }), 'USD 25');
  assert.equal(feeLabel({ fee_amount: -1, fee_currency: 'USD' }), '');
});

test('finds service animals without changing their travel arrangement', () => {
  const trip = { origin_country: 'United States', destination_country: 'Ecuador', air_travel_arrangements: { by_pet: { p1: { arrangement: 'checked_pet' }, p2: { arrangement: 'in_cabin_service_animal' } } } };
  const result = serviceAnimalWorkflows(trip, [{ id: 'p1', is_service_animal: true }, { id: 'p2' }, { id: 'p3' }]);
  assert.deepEqual(result.map(entry => entry.pet.id), ['p1', 'p2']);
  assert.equal(result[0].details.arrangement, 'checked_pet');
});

test('does not impose the U.S. workflow on unrelated international trips', () => {
  assert.deepEqual(serviceAnimalWorkflows({ origin_country: 'Colombia', destination_country: 'Ecuador' }, [{ id: 'p1', is_service_animal: true }]), []);
});

test('builds concise structured contact rows for summaries', () => {
  const rows = travelSupportReferenceRows({ airline_contact: { department: 'Animal desk', phone: '+1 555' }, contacts_checked_at: '2026-09-15' });
  assert.deepEqual(rows, [['Airline animal handling', 'Animal desk · +1 555'], ['Contacts checked', '2026-09-15']]);
});
