import test from 'node:test';
import assert from 'node:assert/strict';
import {
  destinationSlug,
  safeUuidList,
  publicGuide,
  publishedKnowledge,
  normalizedDemandSpecies,
} from './_travelKnowledge.js';

test('normalizes destination lookup without allowing query syntax', () => {
  assert.equal(destinationSlug('  Côte d’Ivoire  '), 'cote-d-ivoire');
  assert.equal(destinationSlug('canada&id=neq.null'), 'canada-id-neq-null');
  assert.equal(destinationSlug(''), '');
});

test('accepts only real UUIDs before building a PostgREST filter', () => {
  assert.deepEqual(safeUuidList([
    '123e4567-e89b-42d3-a456-426614174000',
    'not-a-uuid',
    '123e4567-e89b-42d3-a456-426614174000',
  ]), ['123e4567-e89b-42d3-a456-426614174000']);
});

test('only returns a published, indexable guide with a controlled path', () => {
  const candidate = {
    status: 'published', noindex: false,
    public_path: '/pet-travel-requirements/france/',
    proposed_title: 'France', scope_label: 'United States → France',
    guide_summary: 'Reviewed guide', editorial_reviewed_at: '2026-10-18T12:00:00Z',
  };
  const jurisdiction = { display_name: 'France', slug: 'france', iso2: 'FR' };
  assert.equal(publicGuide(candidate, jurisdiction)?.path, candidate.public_path);
  assert.equal(publicGuide({ ...candidate, noindex: true }, jurisdiction), null);
  assert.equal(publicGuide({ ...candidate, public_path: 'https://example.com' }, jurisdiction), null);
});

test('never exposes a requirement without a verified source', () => {
  const requirements = [
    { id: 'published', review_state: 'published', source_id: 'verified' },
    { id: 'draft', review_state: 'draft', source_id: 'verified' },
    { id: 'bad-source', review_state: 'published', source_id: 'draft-source' },
  ];
  const sources = [
    { id: 'verified', review_state: 'source_verified' },
    { id: 'draft-source', review_state: 'draft' },
  ];
  assert.deepEqual(publishedKnowledge(requirements, sources).map(item => item.id), ['published']);
});

test('coarsens unexpected species instead of storing free text', () => {
  assert.equal(normalizedDemandSpecies('dog'), 'dog');
  assert.equal(normalizedDemandSpecies('dog named Sadie'), 'unknown');
});

