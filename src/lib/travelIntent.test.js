import test from 'node:test';
import assert from 'node:assert/strict';
import { tripIntentFromSearch } from './travelIntent.js';

test('preserves a destination-finder route through signup into trip planning', () => {
  assert.deepEqual(tripIntentFromSearch('?from=pet-travel&originCountry=United+States&destinationCountry=France&transportationType=air&departureDate=2026-12-04'), {
    originCountry: 'United States',
    destinationCountry: 'France',
    transportationType: 'air',
    departureDate: '2026-12-04',
  });
});

test('rejects invalid mode and date values', () => {
  const intent = tripIntentFromSearch('?transportationType=spaceship&departureDate=tomorrow');
  assert.equal(intent.transportationType, 'air');
  assert.equal(intent.departureDate, '');
});
