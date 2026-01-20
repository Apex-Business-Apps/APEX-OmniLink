/**
 * MAESTRO Service Worker
 *
 * Caches allowlisted model assets for offline operation.
 * Phase 1: Scaffold only (full implementation in Phase 2)
 */

const CACHE_NAME = 'maestro-models-v1';
const MODELS_PATH = '/models';

/**
 * Allowlisted model assets
 * Models are cached from CDN (transformers.js default)
 */
const ALLOWLISTED_MODELS = [
  {
    name: 'all-MiniLM-L6-v2',
    description: 'Sentence embeddings (384-dim)',
    provider: 'Xenova',
    // Note: transformers.js handles CDN caching internally
    cached: true,
  },
  {
    name: 'nllb-200-distilled-600M',
    description: 'Multilingual translation (200 languages)',
    provider: 'Xenova',
    cached: true,
  },
  {
    name: 'distilbart-cnn-6-6',
    description: 'Text summarization',
    provider: 'Xenova',
    cached: true,
  },
];

/**
 * Install event - pre-cache model assets
 */
globalThis.addEventListener('install', (event) => {
  console.log('[MAESTRO SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[MAESTRO SW] Opened cache');
      // Phase 2: Pre-cache allowlisted models
      // When implemented: return cache.addAll(ALLOWLISTED_MODELS.map(m => m.url));
      // For now, cache is opened but no models pre-cached
      return undefined;
    })
  );

  // Activate immediately
  globalThis.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
globalThis.addEventListener('activate', (event) => {
  console.log('[MAESTRO SW] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('maestro-models-')) {
            console.log('[MAESTRO SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return undefined;
        })
      );
    })
  );

  // Take control immediately
  return globalThis.clients.claim();
});

/**
 * Fetch event - serve models from cache
 */
globalThis.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle requests to MODELS_PATH
  if (!url.pathname.startsWith(MODELS_PATH)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log('[MAESTRO SW] Serving from cache:', url.pathname);
        return cachedResponse;
      }

      // Phase 2: Verify integrity hash before caching
      // For now, just fetch and cache
      console.log('[MAESTRO SW] Fetching:', url.pathname);
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    })
  );
});

/**
 * Message event - commands from main thread
 */
globalThis.addEventListener('message', (event) => {
  const { type } = event.data;

  switch (type) {
    case 'MAESTRO_HEALTH_CHECK':
      // Return health status
      caches.open(CACHE_NAME).then((cache) => {
        cache.keys().then((keys) => {
          event.ports[0].postMessage({
            status: 'ok',
            cached_models: keys.length,
          });
        });
      });
      break;

    case 'MAESTRO_CLEAR_CACHE':
      // Clear model cache
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ status: 'ok' });
      });
      break;

    default:
      console.warn('[MAESTRO SW] Unknown message type:', type);
  }
});

console.log('[MAESTRO SW] Service Worker loaded');
