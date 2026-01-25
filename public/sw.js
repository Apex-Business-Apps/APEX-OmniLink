// @omnilink/sw:v4-pwa - OmniLink Mobile PWA Service Worker
// Provides offline support, caching, and native app-like experience for iOS/Android

const CACHE_VERSION = 'omnilink-v1';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;
const CACHE_API = `${CACHE_VERSION}-api`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/app_icon.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing OmniLink PWA service worker v4');
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
        // Don't fail install if some assets fail
        return Promise.resolve();
      });
    }).then(() => {
      console.log('[SW] Install complete, skipping waiting');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating OmniLink PWA service worker v4');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('omnilink-') && !name.startsWith(CACHE_VERSION))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - network-first with cache fallback for resilience
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Supabase auth/realtime requests (must go to network)
  if (url.hostname.includes('supabase.co') &&
      (url.pathname.includes('/auth/') || url.pathname.includes('/realtime/'))) {
    return;
  }

  // Strategy: Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone response before caching
        const responseToCache = response.clone();

        // Determine cache bucket
        let cacheName = CACHE_DYNAMIC;
        if (url.hostname.includes('supabase.co')) {
          cacheName = CACHE_API;
        } else if (STATIC_ASSETS.includes(url.pathname)) {
          cacheName = CACHE_STATIC;
        }

        // Cache in background (don't block response)
        caches.open(cacheName).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache (offline):', url.pathname);
            return cachedResponse;
          }

          // If it's a navigation request and we're offline, serve the cached index
          if (request.mode === 'navigate') {
            return caches.match('/index.html').then((indexResponse) => {
              if (indexResponse) {
                console.log('[SW] Serving cached index.html for offline navigation');
                return indexResponse;
              }
              // No cached index, return generic offline response
              return new Response('Offline - Please check your connection', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' },
              });
            });
          }

          // For other requests, return 503
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});

// Message event - handle client messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

console.log('[SW] OmniLink PWA service worker v4 loaded');
