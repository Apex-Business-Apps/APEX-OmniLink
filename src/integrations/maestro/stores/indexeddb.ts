/**
 * MAESTRO IndexedDB Tiered Memory Stores
 *
 * Five-tier memory system with local-first storage:
 * - T1 Core: Stable facts (write only via confirmation)
 * - T2 Working: TTL + bounded
 * - T3 Episodic: Append-only events
 * - T4 Semantic: Embeddings + derived facts
 * - T5 Procedural: Versioned recipes
 */

import {
  MAESTRO_DB_NAME,
  MAESTRO_DB_VERSION,
  MAESTRO_STORES,
  TIER_TTLS,
} from '../config';
import type { MemoryItem, MemoryTier } from '../types';

/**
 * IndexedDB database instance (singleton)
 */
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize MAESTRO IndexedDB database
 */
export async function initMaestroDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  // Check if IndexedDB is available
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB not available');
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(MAESTRO_DB_NAME, MAESTRO_DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`Failed to open MAESTRO DB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores for each memory tier
      Object.values(MAESTRO_STORES).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const objectStore = db.createObjectStore(storeName, { keyPath: 'id' });

          // Indexes for efficient querying
          objectStore.createIndex('locale', 'locale', { unique: false });
          objectStore.createIndex('created_at', 'created_at', { unique: false });
          objectStore.createIndex('content_hash', 'content_hash', { unique: false });

          // Expiry index (for working tier TTL)
          if (storeName === MAESTRO_STORES.WORKING) {
            objectStore.createIndex('expires_at', 'expires_at', { unique: false });
          }

          // Provenance index (for semantic tier)
          if (storeName === MAESTRO_STORES.SEMANTIC) {
            objectStore.createIndex('provenance_refs', 'provenance_refs', {
              unique: false,
              multiEntry: true,
            });
          }
        }
      });
    };
  });

  return dbPromise;
}

/**
 * Get IndexedDB database (initializes if needed)
 */
async function getDb(): Promise<IDBDatabase> {
  return initMaestroDb();
}

/**
 * Store a memory item in a specific tier
 */
export async function storeMemoryItem(
  tier: MemoryTier,
  item: MemoryItem
): Promise<void> {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(tier, 'readwrite');
    const store = tx.objectStore(tier);

    // Add TTL for working tier
    if (tier === MAESTRO_STORES.WORKING && !item.expires_at) {
      const expiresAt = new Date(
        Date.now() + (TIER_TTLS.WORKING || 24 * 60 * 60 * 1000)
      );
      item.expires_at = expiresAt.toISOString();
    }

    const request = store.put(item);

    request.onerror = () =>
      reject(new Error(`Failed to store item in ${tier}: ${request.error?.message}`));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get a memory item by ID from a specific tier
 */
export async function getMemoryItem(
  tier: MemoryTier,
  id: string
): Promise<MemoryItem | null> {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(tier, 'readonly');
    const store = tx.objectStore(tier);
    const request = store.get(id);

    request.onerror = () =>
      reject(new Error(`Failed to get item from ${tier}: ${request.error?.message}`));
    request.onsuccess = () => {
      const item = request.result as MemoryItem | undefined;

      // Check if expired (working tier)
      if (item && item.expires_at) {
        const expiresAt = new Date(item.expires_at);
        if (expiresAt < new Date()) {
          resolve(null); // Expired
          return;
        }
      }

      resolve(item || null);
    };
  });
}

/**
 * Get all memory items from a specific tier
 */
export async function getAllMemoryItems(tier: MemoryTier): Promise<MemoryItem[]> {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(tier, 'readonly');
    const store = tx.objectStore(tier);
    const request = store.getAll();

    request.onerror = () =>
      reject(new Error(`Failed to get items from ${tier}: ${request.error?.message}`));
    request.onsuccess = () => {
      const items = (request.result as MemoryItem[]) || [];

      // Filter out expired items (working tier)
      if (tier === MAESTRO_STORES.WORKING) {
        const now = new Date();
        resolve(
          items.filter((item) => {
            if (!item.expires_at) return true;
            return new Date(item.expires_at) >= now;
          })
        );
      } else {
        resolve(items);
      }
    };
  });
}

/**
 * Query memory items by locale
 */
export async function getMemoryItemsByLocale(
  tier: MemoryTier,
  locale: string
): Promise<MemoryItem[]> {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(tier, 'readonly');
    const store = tx.objectStore(tier);
    const index = store.index('locale');
    const request = index.getAll(locale);

    request.onerror = () =>
      reject(
        new Error(`Failed to query items by locale in ${tier}: ${request.error?.message}`)
      );
    request.onsuccess = () => {
      const items = (request.result as MemoryItem[]) || [];

      // Filter out expired items (working tier)
      if (tier === MAESTRO_STORES.WORKING) {
        const now = new Date();
        resolve(
          items.filter((item) => {
            if (!item.expires_at) return true;
            return new Date(item.expires_at) >= now;
          })
        );
      } else {
        resolve(items);
      }
    };
  });
}

/**
 * Delete a memory item from a specific tier
 */
export async function deleteMemoryItem(tier: MemoryTier, id: string): Promise<void> {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(tier, 'readwrite');
    const store = tx.objectStore(tier);
    const request = store.delete(id);

    request.onerror = () =>
      reject(new Error(`Failed to delete item from ${tier}: ${request.error?.message}`));
    request.onsuccess = () => resolve();
  });
}

/**
 * Clear all items from a specific tier
 */
export async function clearMemoryTier(tier: MemoryTier): Promise<void> {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(tier, 'readwrite');
    const store = tx.objectStore(tier);
    const request = store.clear();

    request.onerror = () =>
      reject(new Error(`Failed to clear ${tier}: ${request.error?.message}`));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get database size (approximate)
 */
export async function getDatabaseSize(): Promise<number> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return 0;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  } catch (error) {
    console.error('Failed to estimate storage:', error);
    return 0;
  }
}

/**
 * Compact a memory tier (remove expired items, consolidate)
 */
export async function compactMemoryTier(tier: MemoryTier): Promise<number> {
  const db = await getDb();
  let deletedCount = 0;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(tier, 'readwrite');
    const store = tx.objectStore(tier);

    // For working tier: remove expired items
    if (tier === MAESTRO_STORES.WORKING) {
      const index = store.index('expires_at');
      const now = new Date().toISOString();
      const range = IDBKeyRange.upperBound(now, false);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };
    }

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () =>
      reject(new Error(`Failed to compact ${tier}: ${tx.error?.message}`));
  });
}

/**
 * Check if IndexedDB is available and healthy
 */
export async function checkIndexedDbHealth(): Promise<{
  status: 'ok' | 'error';
  db_size_mb?: number;
  error?: string;
}> {
  try {
    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined') {
      return { status: 'error', error: 'IndexedDB not available' };
    }

    // Try to open the database
    await getDb();

    // Get database size
    const sizeBytes = await getDatabaseSize();
    const sizeMb = Math.round((sizeBytes / (1024 * 1024)) * 100) / 100;

    return { status: 'ok', db_size_mb: sizeMb };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
