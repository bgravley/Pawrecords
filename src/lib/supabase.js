import { createClient } from '@supabase/supabase-js'
import { PRODUCT_EVENTS, trackProductEvent } from './analytics'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const nativeFetch = globalThis.fetch.bind(globalThis)
const INSERT_EVENT_BY_TABLE = Object.freeze({
  dogs: PRODUCT_EVENTS.PET_CREATED,
  vaccinations: PRODUCT_EVENTS.VACCINATION_RECORDED,
  medications: PRODUCT_EVENTS.MEDICATION_RECORDED,
  allergies: PRODUCT_EVENTS.ALLERGY_RECORDED,
  vet_visits: PRODUCT_EVENTS.VET_VISIT_RECORDED,
  documents: PRODUCT_EVENTS.DOCUMENT_ADDED,
  trips: PRODUCT_EVENTS.TRIP_CREATED,
})

// Observe only successful Supabase INSERT/signup requests. No request body,
// customer ID, pet data, document path, email, route, or medical value is read
// or forwarded to analytics. This keeps funnel measurement useful without
// turning health-record data into analytics data.
const analyticsFetch = async (input, init) => {
  const response = await nativeFetch(input, init)

  try {
    if (!response.ok || typeof window === 'undefined') return response

    const method = String(init?.method || input?.method || 'GET').toUpperCase()
    if (method !== 'POST') return response

    const rawUrl = typeof input === 'string' ? input : input?.url
    if (!rawUrl || !SUPABASE_URL) return response

    const url = new URL(rawUrl, SUPABASE_URL)
    const supabaseOrigin = new URL(SUPABASE_URL).origin
    if (url.origin !== supabaseOrigin) return response

    if (url.pathname.endsWith('/auth/v1/signup')) {
      trackProductEvent(PRODUCT_EVENTS.SIGNUP_COMPLETED)
      return response
    }

    const match = url.pathname.match(/\/rest\/v1\/([^/]+)/)
    if (!match) return response

    const table = decodeURIComponent(match[1])
    const eventName = INSERT_EVENT_BY_TABLE[table]
    if (eventName) trackProductEvent(eventName)
  } catch {
    // Analytics must never alter or fail the underlying Supabase request.
  }

  return response
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'implicit',
  },
  global: {
    fetch: analyticsFetch,
  },
})

// The documents bucket is private in production. A large amount of legacy
// UI code still calls getPublicUrl() synchronously, so centralize that call
// here and route it through our authenticated same-origin file gateway.
// Upload/download/remove/createSignedUrl continue using Supabase normally.
const originalStorageFrom = client.storage.from.bind(client.storage)
const pathAliases = new Map()

client.storage.from = (bucketId) => {
  const bucket = originalStorageFrom(bucketId)
  if (bucketId !== 'documents') return bucket

  const originalUpload = bucket.upload.bind(bucket)
  bucket.upload = async (path, file, options) => {
    let effectivePath = path

    // Legacy shared-record and bug-report uploads used top-level folders,
    // which required an overly broad Storage INSERT policy. Rewrite those
    // transparently beneath the current user's UUID so the bucket can use a
    // single owner-folder policy for all authenticated uploads.
    if (typeof path === 'string' && (path.startsWith('shared-records/') || path.startsWith('bug-reports/'))) {
      const { data: { session } } = await client.auth.getSession()
      const userId = session?.user?.id
      if (userId) effectivePath = `${userId}/${path}`
    }

    const result = await originalUpload(effectivePath, file, options)
    if (!result?.error && effectivePath !== path) pathAliases.set(path, effectivePath)
    return result
  }

  bucket.getPublicUrl = (path) => {
    const effectivePath = pathAliases.get(path) || path
    const relativeUrl = `/api/storage-file?path=${encodeURIComponent(effectivePath || '')}`
    const isSharedRecord = typeof effectivePath === 'string' && effectivePath.includes('/shared-records/')
    const publicUrl = isSharedRecord && typeof window !== 'undefined'
      ? `${window.location.origin}${relativeUrl}`
      : relativeUrl

    return { data: { publicUrl } }
  }

  return bucket
}

// The file gateway authenticates with a short-lived HttpOnly same-origin
// cookie. Keep it synchronized with the current Supabase access token so
// normal <img> and <a> requests can access private files without putting JWTs
// into URLs or exposing service credentials to the browser.
if (typeof window !== 'undefined') {
  let lastToken = null

  const setGatewaySession = async (session) => {
    const token = session?.access_token || null
    if (!token || token === lastToken) return
    lastToken = token

    try {
      await fetch('/api/session-cookie', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'same-origin',
      })
    } catch (error) {
      // Allow a later auth event/refresh to retry if this request failed.
      lastToken = null
      console.error('Failed to synchronize private-file session:', error)
    }
  }

  const clearGatewaySession = async () => {
    lastToken = null
    try {
      await fetch('/api/session-cookie', {
        method: 'DELETE',
        credentials: 'same-origin',
      })
    } catch (error) {
      console.error('Failed to clear private-file session:', error)
    }
  }

  // Startup can race with Supabase's INITIAL_SESSION/auth callback handling.
  // Never interpret an initial null getSession() result as a sign-out: a
  // newer auth-state event may already have established the session cookie.
  // Only an explicit SIGNED_OUT event is allowed to clear it.
  client.auth.getSession().then(({ data }) => {
    if (data?.session?.access_token) setGatewaySession(data.session)
  })
  client.auth.onAuthStateChange((event, session) => {
    queueMicrotask(() => {
      if (session?.access_token) setGatewaySession(session)
      else if (event === 'SIGNED_OUT') clearGatewaySession()
    })
  })
}

export const supabase = client
