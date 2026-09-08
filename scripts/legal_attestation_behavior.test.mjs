import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGAL_ATTESTATION_PENDING_KEY,
  LEGAL_ATTESTATION_VERSION,
  buildPendingLegalAttestation,
  clearPendingLegalAttestation,
  hasCurrentLegalAttestation,
  markPendingLegalAttestation,
  readPendingLegalAttestation,
} from '../src/lib/legalAttestation.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

function installWindow() {
  globalThis.window = { sessionStorage: new MemoryStorage() };
  return globalThis.window.sessionStorage;
}

test('current protected app metadata satisfies the attestation gate', () => {
  const attestedAt = '2026-09-08T04:00:00.000Z';
  assert.equal(hasCurrentLegalAttestation({
    app_metadata: {
      ypp_legal_attestation_version: LEGAL_ATTESTATION_VERSION,
      ypp_adult_attested_at: attestedAt,
    },
  }), true);
});

test('browser-editable user metadata cannot satisfy the durable gate', () => {
  assert.equal(hasCurrentLegalAttestation({
    user_metadata: {
      ypp_legal_attestation_version: LEGAL_ATTESTATION_VERSION,
      ypp_adult_attested_at: '2026-09-08T04:00:00.000Z',
    },
  }), false);
});

test('missing or old attestation version fails closed', () => {
  assert.equal(hasCurrentLegalAttestation({ app_metadata: {} }), false);
  assert.equal(hasCurrentLegalAttestation({
    app_metadata: {
      ypp_legal_attestation_version: '2026-01-01',
      ypp_adult_attested_at: '2026-09-08T04:00:00.000Z',
    },
  }), false);
});

test('pending OAuth/email confirmation round-trips only in sessionStorage', () => {
  const storage = installWindow();
  markPendingLegalAttestation('google_signup');
  const pending = readPendingLegalAttestation();
  assert.equal(pending.version, LEGAL_ATTESTATION_VERSION);
  assert.equal(pending.method, 'google_signup');
  assert.ok(Date.parse(pending.attestedAt));
  assert.ok(storage.getItem(LEGAL_ATTESTATION_PENDING_KEY));
  clearPendingLegalAttestation();
  assert.equal(storage.getItem(LEGAL_ATTESTATION_PENDING_KEY), null);
});

test('email signup is an allowed pending attestation method', () => {
  installWindow();
  markPendingLegalAttestation('email_signup');
  assert.equal(readPendingLegalAttestation().method, 'email_signup');
});

test('invalid pending methods are rejected', () => {
  assert.throws(() => buildPendingLegalAttestation('arbitrary_method'), /Invalid legal attestation method/);
});

test('pending confirmation expires after 30 minutes and is removed', () => {
  const storage = installWindow();
  const attestedAt = '2026-09-08T04:00:00.000Z';
  storage.setItem(LEGAL_ATTESTATION_PENDING_KEY, JSON.stringify(buildPendingLegalAttestation('google_signup', attestedAt)));
  const thirtyMinutesAndOneMs = Date.parse(attestedAt) + (30 * 60 * 1000) + 1;
  assert.equal(readPendingLegalAttestation(thirtyMinutesAndOneMs), null);
  assert.equal(storage.getItem(LEGAL_ATTESTATION_PENDING_KEY), null);
});

test('malformed pending state is removed instead of accepted', () => {
  const storage = installWindow();
  storage.setItem(LEGAL_ATTESTATION_PENDING_KEY, '{not-json');
  assert.equal(readPendingLegalAttestation(), null);
  assert.equal(storage.getItem(LEGAL_ATTESTATION_PENDING_KEY), null);
});
