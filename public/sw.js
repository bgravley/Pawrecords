// YourPetPass Service Worker
// Handles caching for PWA install and basic offline support

const CACHE = 'yourpetpass-v1';

// On install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(['/', '/index.html'])
    )
  );
  self.skipWaiting();
});

// On activate: clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// On fetch: network-first for API calls, cache-first for everything else
self.addEventListener('fetch', event => {
  const { request } = event;

  // Always go to network for API calls and Supabase — never cache these
  if (
    request.method !== 'GET' ||
    request.url.includes('/api/') ||
    request.url.includes('supabase.co') ||
    request.url.includes('openai.com') ||
    request.url.includes('stripe.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache fresh successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        // Network failed — try the cache
        caches.match(request).then(cached =>
          cached || caches.match('/')
        )
      )
  );
});
