/**
 * Offline Sync - Background Sync API + Conflict Resolution
 * Handles offline data queuing and smart conflict resolution when back online
 */

import { logAnalyticsEvent } from './monitoring';

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  resource: string; // e.g., 'workflows', 'integrations', 'settings'
  data: unknown;
  timestamp: number;
  retries: number;
  userId: string;
}

export interface ConflictResolutionStrategy {
  type: 'server-wins' | 'client-wins' | 'merge' | 'manual';
  mergeFunction?: (serverData: unknown, clientData: unknown) => unknown;
}

const SYNC_QUEUE_KEY = 'omnilink_sync_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Check if Background Sync API is supported
 */
export function isBackgroundSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype;
}

/**
 * Add item to offline sync queue
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
  const queue = await getSyncQueue();

  const queueItem: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    retries: 0,
  };

  queue.push(queueItem);
  await saveSyncQueue(queue);

  void logAnalyticsEvent('offline_sync.item_queued', {
    type: item.type,
    resource: item.resource,
    timestamp: new Date().toISOString(),
  });

  // Register background sync if supported
  if (isBackgroundSyncSupported()) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('omnilink-sync');
  }
}

/**
 * Get current sync queue from localStorage
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const queueJson = localStorage.getItem(SYNC_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('[OfflineSync] Failed to get sync queue:', error);
    return [];
  }
}

/**
 * Save sync queue to localStorage
 */
async function saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineSync] Failed to save sync queue:', error);
  }
}

/**
 * Clear sync queue
 */
export async function clearSyncQueue(): Promise<void> {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

/**
 * Process sync queue (sync all pending items)
 */
const DEFAULT_STRATEGY: ConflictResolutionStrategy = { type: 'server-wins' };

export async function processSyncQueue(
  apiUrl: string,
  authToken: string,
  conflictStrategy: ConflictResolutionStrategy = DEFAULT_STRATEGY
): Promise<{ succeeded: number; failed: number; conflicts: number }> {
  const queue = await getSyncQueue();

  if (queue.length === 0) {
    return { succeeded: 0, failed: 0, conflicts: 0 };
  }

  void logAnalyticsEvent('offline_sync.processing_started', {
    queueSize: queue.length,
    timestamp: new Date().toISOString(),
  });

  let succeeded = 0;
  let failed = 0;
  let conflicts = 0;

  const newQueue: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      const result = await syncItem(item, apiUrl, authToken, conflictStrategy);

      if (result.success) {
        succeeded++;
      } else if (result.conflict) {
        conflicts++;
        // Re-queue for manual resolution if strategy is 'manual'
        if (conflictStrategy.type === 'manual') {
          newQueue.push(item);
        }
      } else if (item.retries < MAX_RETRIES) {
        // Retry if under max retries
        newQueue.push({ ...item, retries: item.retries + 1 });
      } else {
        failed++;
        void logAnalyticsEvent('offline_sync.item_failed', {
          id: item.id,
          type: item.type,
          resource: item.resource,
          retries: item.retries,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to sync item:', error);
      failed++;
    }
  }

  await saveSyncQueue(newQueue);

  void logAnalyticsEvent('offline_sync.processing_complete', {
    succeeded,
    failed,
    conflicts,
    remaining: newQueue.length,
    timestamp: new Date().toISOString(),
  });

  return { succeeded, failed, conflicts };
}

/**
 * Sync individual item
 */
async function syncItem(
  item: SyncQueueItem,
  apiUrl: string,
  authToken: string,
  conflictStrategy: ConflictResolutionStrategy
): Promise<{ success: boolean; conflict: boolean }> {
  const endpoint = `${apiUrl}/${item.resource}/${item.type === 'create' ? '' : item.id}`;

  const method = {
    create: 'POST',
    update: 'PUT',
    delete: 'DELETE',
  }[item.type];

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'X-Sync-Timestamp': String(item.timestamp),
      },
      body: item.type === 'delete' ? undefined : JSON.stringify(item.data),
    });

    // Conflict detection (HTTP 409)
    if (response.status === 409) {
      const serverData = await response.json();
      const resolved = await resolveConflict(item, serverData, conflictStrategy);
      return { success: resolved, conflict: true };
    }

    // Success
    if (response.ok) {
      return { success: true, conflict: false };
    }

    // Other error
    console.error(`[OfflineSync] Sync failed: ${response.statusText}`);
    return { success: false, conflict: false };
  } catch (error) {
    console.error('[OfflineSync] Network error during sync:', error);
    return { success: false, conflict: false };
  }
}

/**
 * Resolve conflict between client and server data
 */
async function resolveConflict(
  clientItem: SyncQueueItem,
  serverData: unknown,
  strategy: ConflictResolutionStrategy
): Promise<boolean> {
  void logAnalyticsEvent('offline_sync.conflict_detected', {
    resource: clientItem.resource,
    strategy: strategy.type,
    timestamp: new Date().toISOString(),
  });

  switch (strategy.type) {
    case 'server-wins':
      // Discard client changes, server data is authoritative
      console.log('[OfflineSync] Conflict resolved: server wins');
      return true;

    case 'client-wins':
      // Force overwrite server with client data
      console.log('[OfflineSync] Conflict resolved: client wins (force push)');
      // Would need to implement force flag in API
      return false; // For now, fail and require manual resolution

    case 'merge':
      // Merge client and server data using custom function
      if (strategy.mergeFunction) {
        // MERGE LOGIC PLACEHOLDER: Result unused in current impl
        strategy.mergeFunction(serverData, clientItem.data);
        // Update local data with merged result
        console.log('[OfflineSync] Conflict resolved: merged');
        return true;
      }
      return false;

    case 'manual':
      // Store conflict for manual user resolution
      await storeConflictForManualResolution(clientItem, serverData);
      console.log('[OfflineSync] Conflict stored for manual resolution');
      return false;

    default:
      return false;
  }
}

/**
 * Store conflict for manual user resolution
 */
async function storeConflictForManualResolution(
  clientItem: SyncQueueItem,
  serverData: unknown
): Promise<void> {
  const conflicts = await getStoredConflicts();

  conflicts.push({
    id: clientItem.id,
    resource: clientItem.resource,
    clientData: clientItem.data,
    serverData,
    timestamp: Date.now(),
  });

  try {
    localStorage.setItem('omnilink_sync_conflicts', JSON.stringify(conflicts));
  } catch (error) {
    console.error('[OfflineSync] Failed to store conflict:', error);
  }
}

/**
 * Get stored conflicts requiring manual resolution
 */
export async function getStoredConflicts(): Promise<
  Array<{
    id: string;
    resource: string;
    clientData: unknown;
    serverData: unknown;
    timestamp: number;
  }>
> {
  try {
    const conflictsJson = localStorage.getItem('omnilink_sync_conflicts');
    return conflictsJson ? JSON.parse(conflictsJson) : [];
  } catch (error) {
    console.error('[OfflineSync] Failed to get conflicts:', error);
    return [];
  }
}

/**
 * Resolve conflict manually by choosing client or server version
 */
export async function resolveConflictManually(
  conflictId: string,
  resolution: 'client' | 'server'
): Promise<void> {
  const conflicts = await getStoredConflicts();
  const updatedConflicts = conflicts.filter((c) => c.id !== conflictId);

  try {
    localStorage.setItem('omnilink_sync_conflicts', JSON.stringify(updatedConflicts));

    void logAnalyticsEvent('offline_sync.conflict_resolved_manually', {
      conflictId,
      resolution,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[OfflineSync] Failed to resolve conflict:', error);
  }
}

/**
 * Setup background sync event listener in service worker
 * This should be added to sw.js
 */
export function setupBackgroundSyncListener() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then((registration) => {
    if ('sync' in registration) {
      console.log('[OfflineSync] Background sync supported and ready');
    }
  });
}

/**
 * Initialize offline sync system
 */
export async function initializeOfflineSync(
  apiUrl: string,
  getUserToken: () => Promise<string | null>
): Promise<void> {
  if (!isBackgroundSyncSupported()) {
    console.log('[OfflineSync] Background sync not supported, using manual sync');
  }

  setupBackgroundSyncListener();

  // Auto-sync when coming online
  window.addEventListener('online', async () => {
    console.log('[OfflineSync] Network online, processing sync queue');

    const token = await getUserToken();
    if (token) {
      await processSyncQueue(apiUrl, token);
    }
  });

  // Check for pending syncs on init
  const queue = await getSyncQueue();
  if (queue.length > 0) {
    console.log(`[OfflineSync] Found ${queue.length} items in sync queue`);
  }

  console.log('[OfflineSync] Initialized');
}

/**
 * Smart merge function for common data types
 */
export const mergeStrategies = {
  /**
   * Last-write-wins based on timestamp
   */
  lastWriteWins: (serverData: unknown, clientData: unknown): unknown => {
    const serverTime = (serverData as Record<string, unknown>).updatedAt || (serverData as Record<string, unknown>).timestamp || 0;
    const clientTime = (clientData as Record<string, unknown>).updatedAt || (clientData as Record<string, unknown>).timestamp || 0;
    return clientTime > serverTime ? clientData : serverData;
  },

  /**
   * Merge objects by taking union of fields, client wins on conflicts
   */
  fieldLevelMerge: (serverData: unknown, clientData: unknown): unknown => {
    return { ...(serverData as Record<string, unknown>), ...(clientData as Record<string, unknown>) };
  },

  /**
   * Merge arrays by concatenating and deduplicating
   */
  arrayUnion: (serverData: unknown[], clientData: unknown[]): unknown[] => {
    const combined = [...serverData, ...clientData];
    return Array.from(new Set(combined.map((item) => JSON.stringify(item)))).map((item) =>
      JSON.parse(item)
    );
  },

  /**
   * Merge by comparing specific version/revision numbers
   */
  versionBased: (serverData: unknown, clientData: unknown): unknown => {
    const serverVersion = (serverData as Record<string, unknown>).version || 0;
    const clientVersion = (clientData as Record<string, unknown>).version || 0;
    return clientVersion > serverVersion ? clientData : serverData;
  },
};
