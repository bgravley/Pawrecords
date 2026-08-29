import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'implicit',
  }
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
