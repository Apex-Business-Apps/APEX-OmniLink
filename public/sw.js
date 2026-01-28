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
// Install event - cache static assets
globalThis.addEventListener('install', (event) => {
  console.log('[SW] Installing OmniLink PWA service worker v4');
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
        // Don't fail install if some assets fail
      });
    }).then(() => {
      console.log('[SW] Install complete, skipping waiting');
      return globalThis.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
globalThis.addEventListener('activate', (event) => {
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
      return globalThis.clients.claim();
    })
  );
});

// Fetch event - network-first with cache fallback for resilience
globalThis.addEventListener('fetch', (event) => {
  // ... existing fetch logic ...
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
        // Cache successful responses
        if (response && response.status === 200 && response.type !== 'error') {
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
        }

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
globalThis.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message');
    globalThis.skipWaiting();
  }
});

// Push notification event - show notification when received
globalThis.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  if (!event.data) {
    return;
  }

  let notification;
  try {
    notification = event.data.json();
  } catch (err) {
    console.debug('[SW] Not JSON, falling back to text:', err);
    notification = {
      title: 'OmniLink',
      body: event.data.text(),
    };
  }

  const options = {
    body: notification.body || '',
    icon: notification.icon || '/icons/pwa/icon-192.png',
    badge: notification.badge || '/icons/pwa/icon-96.png',
    image: notification.image,
    data: notification.data || {},
    actions: notification.actions || [],
    tag: notification.tag || 'default',
    requireInteraction: notification.requireInteraction || false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    globalThis.registration.showNotification(notification.title || 'OmniLink', options)
  );
});

// Notification click event - handle user click on notification
globalThis.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  // Handle different actions
  let url = '/';
  if (event.action === 'open-dash') {
    url = '/omnidash';
  } else if (event.action === 'open-trace') {
    url = '/omnitrace';
  } else if (event.action === 'open-integrations') {
    url = '/integrations';
  } else if (event.notification.data && event.notification.data.url) {
    url = event.notification.data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(url.split('?')[0]) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if no existing window found
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );

  // Send message to client
  clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'notification-click',
        action: event.action,
        data: event.notification.data,
      });
    });
  });
});

// Background sync event - sync offline data when connection returns
globalThis.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'omnilink-sync') {
    event.waitUntil(
      fetch('/api/sync/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Sync failed');
          }
          console.log('[SW] Background sync completed successfully');
          return response.json();
        })
        .catch((error) => {
          console.error('[SW] Background sync failed:', error);
          // Retry sync later
          throw error;
        })
    );
  }
});

// Periodic background sync (requires permission)
globalThis.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);

  if (event.tag === 'omnilink-periodic-sync') {
    event.waitUntil(
      fetch('/api/sync/periodic', {
        method: 'POST',
      }).then((response) => {
        console.log('[SW] Periodic sync completed');
        return response.json();
      })
    );
  }
});

console.log('[SW] OmniLink PWA service worker v4 loaded with push & sync support');
