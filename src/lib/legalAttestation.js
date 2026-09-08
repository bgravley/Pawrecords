export const LEGAL_ATTESTATION_VERSION = '2026-09-07';
export const LEGAL_ATTESTATION_PENDING_KEY = 'ypp_pending_legal_attestation_v1';
export const LEGAL_ATTESTATION_METHODS = Object.freeze(['email_signup', 'google_signup', 'post_auth_gate']);
const PENDING_MAX_AGE_MS = 30 * 60 * 1000;

export function buildPendingLegalAttestation(method, attestedAt = new Date().toISOString()) {
  if (!LEGAL_ATTESTATION_METHODS.includes(method)) throw new Error('Invalid legal attestation method');
  return {
    version: LEGAL_ATTESTATION_VERSION,
    attestedAt,
    method,
  };
}

export function hasCurrentLegalAttestation(user) {
  const metadata = user?.app_metadata || {};
  return metadata.ypp_legal_attestation_version === LEGAL_ATTESTATION_VERSION &&
    typeof metadata.ypp_adult_attested_at === 'string' &&
    metadata.ypp_adult_attested_at.length >= 20;
}

export function markPendingLegalAttestation(method) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const pending = buildPendingLegalAttestation(method);
  window.sessionStorage.setItem(LEGAL_ATTESTATION_PENDING_KEY, JSON.stringify(pending));
}

export function readPendingLegalAttestation(now = Date.now()) {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(LEGAL_ATTESTATION_PENDING_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw);
    const attestedAtMs = Date.parse(pending?.attestedAt || '');
    if (pending?.version !== LEGAL_ATTESTATION_VERSION ||
        !LEGAL_ATTESTATION_METHODS.includes(pending?.method) ||
        !Number.isFinite(attestedAtMs) ||
        now - attestedAtMs < 0 ||
        now - attestedAtMs > PENDING_MAX_AGE_MS) {
      window.sessionStorage.removeItem(LEGAL_ATTESTATION_PENDING_KEY);
      return null;
    }
    return pending;
  } catch {
    window.sessionStorage.removeItem(LEGAL_ATTESTATION_PENDING_KEY);
    return null;
  }
}

export function clearPendingLegalAttestation() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  window.sessionStorage.removeItem(LEGAL_ATTESTATION_PENDING_KEY);
}
