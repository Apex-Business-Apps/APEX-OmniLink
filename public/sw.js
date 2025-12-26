// @omnilink/sw:v3-recovery - TEMPORARY Self-Destroying Service Worker
// This version clears all caches and unregisters itself to recover from stale cache issues
// TODO: Revert to normal PWA mode after one successful deployment

console.log('[SW Recovery] Self-destroying service worker loaded');

// Install event - skip waiting and activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW Recovery] Installing - will self-destruct on activate');
  self.skipWaiting(); // Activate immediately
});

// Activate event - delete ALL caches and unregister this service worker
self.addEventListener('activate', (event) => {
  console.log('[SW Recovery] Activating - clearing all caches and unregistering...');
  event.waitUntil(
    Promise.all([
      // Delete ALL caches
      caches.keys().then((cacheNames) => {
        console.log('[SW Recovery] Deleting all caches:', cacheNames);
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }),
      // Unregister this service worker
      self.registration.unregister().then(() => {
        console.log('[SW Recovery] Service worker unregistered successfully');
        // Reload all clients to get fresh content
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_UNREGISTERED', action: 'reload' });
          });
        });
      })
    ]).then(() => {
      console.log('[SW Recovery] Cache recovery complete. Page will reload with fresh content.');
    })
  );
  self.clients.claim(); // Take control immediately before unregistering
});

// Fetch event - pass through all requests (no caching during recovery)
self.addEventListener('fetch', (event) => {
  // Just pass through to network, no caching
  event.respondWith(fetch(event.request));
});
