import test from 'node:test';
import assert from 'node:assert/strict';
import { safeExternalUrl } from './safeExternalUrl.js';

test('allows canonical https URLs', () => {
  assert.equal(safeExternalUrl('https://example.gov/path'), 'https://example.gov/path');
});

test('rejects dangerous and non-https schemes', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'http://example.com',
    '//example.com/path',
    'not a url',
    '',
    null,
  ]) assert.equal(safeExternalUrl(value), null);
});
