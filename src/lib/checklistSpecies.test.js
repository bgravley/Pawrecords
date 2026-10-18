import test from 'node:test';
import assert from 'node:assert/strict';
import { checklistAppliesToSpecies } from './checklistSpecies.js';
import { canadaUsResearchFallback } from '../../api/_canadaUsTravel.js';

test('shared research notice survives dog-only, cat-only and mixed trip filtering', () => {
  for (const species of [['dog'], ['cat'], ['dog', 'cat']]) {
    const items = canadaUsResearchFallback().filter(item => species.some(pet => checklistAppliesToSpecies(item.applies_to, pet)));
    assert.ok(items.some(item => item.rule_id === 'supplemental-unavailable'));
    assert.equal(items.length, species.length === 2 ? 8 : species[0] === 'dog' ? 5 : 4);
    for (const pet of species) assert.ok(checklistAppliesToSpecies(items.at(-1).applies_to, pet));
  }
});
test('species-specific rules remain isolated and legacy unspecified rules default to dogs', () => {
  assert.equal(checklistAppliesToSpecies('cat', 'dog'), false);
  assert.equal(checklistAppliesToSpecies('dog', 'cat'), false);
  assert.equal(checklistAppliesToSpecies(undefined, 'dog'), true);
  assert.equal(checklistAppliesToSpecies(undefined, 'cat'), false);
});
