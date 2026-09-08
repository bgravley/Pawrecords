export const LEGAL_ATTESTATION_VERSION = '2026-09-07';
export const LEGAL_ATTESTATION_PENDING_KEY = 'ypp_pending_legal_attestation_v1';
const PENDING_MAX_AGE_MS = 30 * 60 * 1000;

export function buildLegalAttestationMetadata(method, attestedAt = new Date().toISOString()) {
  return {
    ypp_legal_attestation_version: LEGAL_ATTESTATION_VERSION,
    ypp_adult_attested_at: attestedAt,
    ypp_legal_attestation_method: method,
  };
}

export function hasCurrentLegalAttestation(user) {
  const metadata = user?.user_metadata || {};
  return metadata.ypp_legal_attestation_version === LEGAL_ATTESTATION_VERSION &&
    typeof metadata.ypp_adult_attested_at === 'string' &&
    metadata.ypp_adult_attested_at.length >= 20;
}

export function markPendingLegalAttestation() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const pending = buildLegalAttestationMetadata('google_signup');
  window.sessionStorage.setItem(LEGAL_ATTESTATION_PENDING_KEY, JSON.stringify(pending));
}

export function readPendingLegalAttestation(now = Date.now()) {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(LEGAL_ATTESTATION_PENDING_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw);
    const attestedAtMs = Date.parse(pending?.ypp_adult_attested_at || '');
    if (pending?.ypp_legal_attestation_version !== LEGAL_ATTESTATION_VERSION ||
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
