import { supabase } from './supabase';

const recentFingerprints = new Map();
const recentSendTimes = [];
const DEDUPE_MS = 60 * 1000;
const CLIENT_MAX_PER_MINUTE = 5;

function runtimeMessage(error, fallback) {
  if (error instanceof Error) {
    const name = typeof error.name === 'string' && error.name ? error.name : 'Error';
    const message = typeof error.message === 'string' && error.message
      ? error.message
      : fallback;
    return `${name}: ${message}`.slice(0, 1000);
  }
  // Do not stringify arbitrary rejected objects/values: they can contain
  // pet, medical, document, form, or API response data.
  return fallback;
}

function currentRoute() {
  return typeof window !== 'undefined' && typeof window.location?.pathname === 'string'
    ? window.location.pathname
    : '/';
}

function canSend(fingerprint) {
  const now = Date.now();
  const last = recentFingerprints.get(fingerprint) || 0;
  if (now - last < DEDUPE_MS) return false;

  while (recentSendTimes.length && now - recentSendTimes[0] > DEDUPE_MS) {
    recentSendTimes.shift();
  }
  if (recentSendTimes.length >= CLIENT_MAX_PER_MINUTE) return false;

  recentFingerprints.set(fingerprint, now);
  recentSendTimes.push(now);
  return true;
}

export async function reportClientError({ type, error, fallback = 'Client application error' }) {
  try {
    const message = runtimeMessage(error, fallback);
    const route = currentRoute();
    const fingerprint = `${type}|${route}|${message}`.slice(0, 1200);
    if (!canSend(fingerprint)) return;

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) return;

    await fetch('/api/client-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true,
      body: JSON.stringify({ type, message, route }),
    }).catch(() => {});
  } catch {
    // Crash reporting must never create a second application failure.
  }
}

export function installGlobalErrorReporting() {
  if (typeof window === 'undefined' || window.__yppCrashReportingInstalled) return;
  window.__yppCrashReportingInstalled = true;

  window.addEventListener('error', (event) => {
    void reportClientError({
      type: 'window_error',
      error: event.error instanceof Error ? event.error : null,
      fallback: 'Uncaught browser error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    void reportClientError({
      type: 'unhandled_rejection',
      error: event.reason instanceof Error ? event.reason : null,
      fallback: 'Unhandled promise rejection',
    });
  });
}
