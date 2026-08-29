import { track as vercelTrack } from '@vercel/analytics'

// Product funnel analytics must never contain customer identifiers, pet names,
// medical values, document names/paths, route details, or other record content.
// Keep events as coarse action names only. GA4 and Clarity are already loaded
// in index.html; Vercel page analytics is mounted in src/main.jsx.
const SAFE_EVENT_NAME = /^[a-z][a-z0-9_]{1,39}$/

export const PRODUCT_EVENTS = Object.freeze({
  SIGNUP_COMPLETED: 'signup_completed',
  PET_CREATED: 'pet_created',
  VACCINATION_RECORDED: 'vaccination_recorded',
  MEDICATION_RECORDED: 'medication_recorded',
  ALLERGY_RECORDED: 'allergy_recorded',
  VET_VISIT_RECORDED: 'vet_visit_recorded',
  DOCUMENT_ADDED: 'document_added',
  TRIP_CREATED: 'trip_created',
  TRAVEL_CHECKLIST_SAVED: 'travel_checklist_saved',
})

export function trackProductEvent(name) {
  if (typeof window === 'undefined' || !SAFE_EVENT_NAME.test(name || '')) return

  // Synthetic production smoke journeys should validate product behavior
  // without polluting real acquisition/funnel reporting.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  if (ua.includes('YourPetPass-Authenticated-E2E') || ua.includes('YourPetPass-Isolation-E2E')) return
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return

  try { vercelTrack(name) } catch { /* analytics must never affect the product */ }
  try { window.gtag?.('event', name) } catch { /* best effort */ }
  try { window.clarity?.('event', name) } catch { /* best effort */ }
}
