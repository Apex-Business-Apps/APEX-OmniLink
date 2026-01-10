/**
 * Offline support and data persistence utilities
 */

export function isOnline(): boolean {
  return navigator.onLine;
}

export function setupOfflineListeners(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  const handleOnline = () => {
    console.log('🟢 Connection restored');
    onOnline?.();
  };

  const handleOffline = () => {
    console.log('🔴 Connection lost');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Queue failed requests for retry when online
 */
interface QueuedRequest {
  id: string;
  timestamp: number;
  request: () => Promise<unknown>;
  retries: number;
}

const STORAGE_KEY = 'offline_request_queue';
const requestQueue: QueuedRequest[] = [];
const MAX_RETRIES = 3;
const MAX_QUEUE_SIZE = 50;

function persistQueue() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requestQueue));
  } catch {
    // Non-fatal: continue in-memory
  }
}

function loadQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as QueuedRequest[];
    requestQueue.push(...parsed);
  } catch {
    // ignore parse errors
  }
}

loadQueue();

export function queueOfflineRequest(request: () => Promise<unknown>): string {
  if (requestQueue.length >= MAX_QUEUE_SIZE) {
    console.warn('Request queue is full, removing oldest request');
    requestQueue.shift();
  }

  const id = crypto.randomUUID();
  requestQueue.push({
    id,
    timestamp: Date.now(),
    request,
    retries: 0,
  });

  persistQueue();
  return id;
}

export async function processQueuedRequests(): Promise<void> {
  if (!isOnline() || requestQueue.length === 0) return;

  console.log(`Processing ${requestQueue.length} queued requests...`);

  const requests = [...requestQueue];
  requestQueue.length = 0;
  persistQueue();

  // Process requests with concurrency limit for better performance
  const CONCURRENCY_LIMIT = 3;
  
  for (let i = 0; i < requests.length; i += CONCURRENCY_LIMIT) {
    const batch = requests.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(
      batch.map(item => item.request())
    );

    results.forEach((result, index) => {
      const item = batch[index];
      if (result.status === 'fulfilled') {
        console.log(`✅ Successfully processed queued request ${item.id}`);
      } else {
        console.error(`❌ Failed to process request ${item.id}:`, result.reason);
        
        if (item.retries < MAX_RETRIES) {
          item.retries++;
          requestQueue.push(item);
        }
      }
    });
  }
  persistQueue();
}

/**
 * Local storage with quota management
 */
export function saveToLocalStorage<T>(key: string, data: T): boolean {
  try {
    const serialized = JSON.stringify({
      data,
      timestamp: Date.now(),
    });
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('LocalStorage quota exceeded');
      // Clear old data
      clearOldLocalStorageData();
      // Try again
      try {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export function loadFromLocalStorage<T>(key: string, maxAge?: number): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const { data, timestamp } = JSON.parse(item);
    
    if (maxAge && Date.now() - timestamp > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return data as T;
  } catch {
    return null;
  }
}

function clearOldLocalStorageData(): void {
  try {
    const keys = Object.keys(localStorage);
    const items = keys.map(key => {
      try {
        return {
          key,
          data: localStorage.getItem(key),
        };
      } catch {
        return { key, data: null };
      }
    }).filter(item => item.data !== null);

    // Sort by timestamp and remove oldest 25%
    const itemsWithTimestamp = items
      .map(item => {
        try {
          const { timestamp } = JSON.parse(item.data!);
          return { key: item.key, timestamp };
        } catch {
          return { key: item.key, timestamp: 0 };
        }
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    const removeCount = Math.ceil(itemsWithTimestamp.length * 0.25);
    itemsWithTimestamp.slice(0, removeCount).forEach(item => {
      try {
        localStorage.removeItem(item.key);
      } catch {
        // Ignore errors when removing items
      }
    });
  } catch (error) {
    console.error('Error clearing old localStorage data:', error);
  }
}
