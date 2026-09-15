import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPackingItems, missedConnectionGuidance, packingProgress } from './packingChecklist.js';

const pet = { id: 'p1', pet_type: 'pet' };
const trip = arrangement => ({ transportation_type: 'air', air_travel_arrangements: { version: 1, by_pet: { p1: { arrangement } } } });

test('manifest cargo gets cargo-only packing items', () => {
  const ids = buildPackingItems(trip('manifest_cargo'), [pet]).map(entry => entry.id);
  assert.ok(ids.includes('cargo-awb'));
  assert.ok(ids.includes('kennel-hardware'));
  assert.ok(!ids.includes('cabin-carrier'));
});

test('cabin travel gets a cabin carrier without cargo paperwork', () => {
  const ids = buildPackingItems(trip('in_cabin_pet'), [pet]).map(entry => entry.id);
  assert.ok(ids.includes('cabin-carrier'));
  assert.ok(!ids.includes('cargo-awb'));
});

test('service classification adds service items without changing travel mode', () => {
  const ids = buildPackingItems(trip('checked_pet'), [{ ...pet, pet_type: 'service_animal' }]).map(entry => entry.id);
  assert.ok(ids.includes('service-animal-kit'));
  assert.ok(ids.includes('checked-confirmation'));
});

test('progress ignores stale item ids', () => {
  assert.deepEqual(packingProgress([{ id: 'one' }, { id: 'two' }], { completed: { one: true, removed: true } }), { done: 1, total: 2, percent: 50 });
});

test('cargo missed-connection guidance identifies the air waybill', () => {
  assert.match(missedConnectionGuidance(trip('manifest_cargo'), [pet]), /air waybill/i);
});

