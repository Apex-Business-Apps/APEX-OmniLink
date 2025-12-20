import { calculateBackoffDelay } from '@/lib/backoff';
import { logAnalyticsEvent, logError } from '@/lib/monitoring';
import { persistentGet, persistentSet } from '@/libs/persistence';
import type { DeviceInfo } from '@/integrations/lovable/types';

export type DeviceStatus = 'trusted' | 'suspect' | 'blocked';

export interface DeviceRecord {
  deviceId: string;
  userId: string;
  lastSeen: string;
  deviceInfo: Record<string, any>;
  status?: DeviceStatus;
}

type QueuedUpsert = {
  record: DeviceRecord;
  attempts: number;
  nextAttemptAt: number;
  status: 'pending' | 'failed';
};

const REGISTRY_KEY = 'lovable_device_registry_v1';
const UPSERT_QUEUE_KEY = 'lovable_device_upserts_v1';

// Use Supabase Edge Function if available, otherwise fall back to local proxy
function getDeviceProxyUrl(): string {
  // Check if we should use Supabase function
  const useSupabaseFunction = import.meta.env.VITE_USE_SUPABASE_LOVABLE !== 'false';
  if (useSupabaseFunction && typeof window !== 'undefined') {
    // Get Supabase URL from env
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      // Extract project ref from Supabase URL
      const url = new URL(supabaseUrl);
      return `${url.origin}/functions/v1/lovable-device`;
    }
  }
  // Fallback to local proxy or custom URL
  return import.meta.env.VITE_LOVABLE_DEVICE_PROXY ?? '/api/lovable/device';
}

const DEVICE_PROXY_URL = getDeviceProxyUrl();
const MAX_ATTEMPTS = Number(import.meta.env.VITE_DEVICE_MAX_ATTEMPTS ?? 5);
const BASE_DELAY_MS = Number(import.meta.env.VITE_DEVICE_RETRY_BASE_MS ?? 500);
const MAX_DELAY_MS = Number(import.meta.env.VITE_DEVICE_RETRY_MAX_MS ?? 10_000);
const JITTER_MS = Number(import.meta.env.VITE_DEVICE_RETRY_JITTER_MS ?? 250);
const SYNC_INTERVAL_MS = Number(import.meta.env.VITE_DEVICE_SYNC_INTERVAL_MS ?? 5 * 60_000);
const DEGRADE_THRESHOLD = Number(import.meta.env.VITE_DEVICE_DEGRADE_THRESHOLD ?? 3);

const registry = new Map<string, DeviceRecord>();
let upsertQueue: QueuedUpsert[] = [];
let syncInterval: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight = false;
let consecutiveFailures = 0;

// Warm caches opportunistically (non-blocking)
void loadRegistryFromLocal();
void loadUpsertQueue();

async function loadRegistryFromLocal() {
  const stored = await persistentGet<DeviceRecord[]>(REGISTRY_KEY);
  if (!stored) return;
  stored.forEach((item) => registry.set(item.deviceId, item));
}

async function persistRegistry(records: DeviceRecord[]) {
  await persistentSet(REGISTRY_KEY, records);
}

async function loadUpsertQueue() {
  if (upsertQueue.length) return upsertQueue;
  upsertQueue = (await persistentGet<QueuedUpsert[]>(UPSERT_QUEUE_KEY)) ?? [];
  return upsertQueue;
}

async function saveUpsertQueue(updated: QueuedUpsert[]) {
  upsertQueue = updated;
  await persistentSet(UPSERT_QUEUE_KEY, updated);
}

function upsertQueueEntry(record: DeviceRecord, queue: QueuedUpsert[]): QueuedUpsert[] {
  const existingIndex = queue.findIndex((q) => q.record.deviceId === record.deviceId);
  const entry: QueuedUpsert = {
    record,
    attempts: 0,
    nextAttemptAt: Date.now(),
    status: 'pending',
  };
  if (existingIndex >= 0) {
    queue[existingIndex] = entry;
  } else {
    queue.push(entry);
  }
  return queue;
}

function toDeviceInfo(record: DeviceRecord): DeviceInfo {
  return {
    device_id: record.deviceId,
    user_id: record.userId,
    device_info: {
      ...record.deviceInfo,
      status: record.status,
    },
    last_seen: record.lastSeen,
  };
}

function mergeByLastSeen(local: DeviceRecord[], remote: DeviceRecord[]): DeviceRecord[] {
  const merged = new Map<string, DeviceRecord>();
  [...local, ...remote].forEach((rec) => {
    const existing = merged.get(rec.deviceId);
    if (!existing) {
      merged.set(rec.deviceId, rec);
      return;
    }
    const currentTs = Date.parse(existing.lastSeen);
    const candidateTs = Date.parse(rec.lastSeen);
    merged.set(rec.deviceId, candidateTs >= currentTs ? rec : existing);
  });
  return Array.from(merged.values());
}

async function fetchRemoteRegistry(userId: string): Promise<DeviceRecord[]> {
  // Graceful degradation: if proxy URL is not configured, return empty array (enterprise resilience)
  if (!DEVICE_PROXY_URL || DEVICE_PROXY_URL === '/api/lovable/device') {
    if (typeof window !== 'undefined') {
      // In browser, server proxy may not be available - use local cache only (idempotent)
      return [];
    }
  }

  const controller = new AbortController();
  const timeoutMs = Number(import.meta.env.VITE_DEVICE_TIMEOUT_MS ?? 10_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    // Check if using Supabase function (needs auth header)
    const isSupabaseFunction = DEVICE_PROXY_URL.includes('/functions/v1/');
    const headers: HeadersInit = { 'X-User-Id': userId };
    
    if (isSupabaseFunction && typeof window !== 'undefined') {
      // Get auth token from Supabase client if available
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }
    
    const res = await fetch(`${DEVICE_PROXY_URL}?user_id=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Device registry fetch failed: ${res.status}`);
    }
    const json = await res.json();
    const devices = (json.devices as DeviceInfo[]) ?? [];
    return devices.map((d) => ({
      deviceId: d.device_id,
      userId: d.user_id,
      lastSeen: d.last_seen,
      deviceInfo: d.device_info ?? {},
      status: (d.device_info?.status ?? 'suspect') as DeviceStatus,
    }));
  } catch (error) {
    // Network errors are expected when backend is unavailable - use local cache (idempotent)
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
      return []; // Return empty, will use local cache
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function scheduleFlush(delay = 0) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushUpserts();
  }, delay);
}

async function flushUpserts(force = false) {
  if (flushInFlight) return;
  flushInFlight = true;
  const now = Date.now();
  const queue = await loadUpsertQueue();
  let updated = [...queue];

  for (const item of queue) {
    if (item.status === 'failed') continue;
    if (!force && item.nextAttemptAt > now) continue;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      scheduleFlush(2_000);
      break;
    }

    try {
      // Graceful degradation: if proxy URL is not configured, skip server sync (enterprise resilience)
      if (!DEVICE_PROXY_URL || DEVICE_PROXY_URL === '/api/lovable/device') {
        if (typeof window !== 'undefined') {
          // In browser, server proxy may not be available - this is OK, device stays in local cache (idempotent)
          throw new Error('Device proxy not available - device cached locally');
        }
      }

      // Check if using Supabase function (needs auth header)
      const isSupabaseFunction = DEVICE_PROXY_URL.includes('/functions/v1/');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-User-Id': item.record.userId,
      };
      
      if (isSupabaseFunction && typeof window !== 'undefined') {
        // Get auth token from Supabase client if available
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const response = await fetch(DEVICE_PROXY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ device: toDeviceInfo(item.record) }),
      });
      if (!response.ok) {
        throw new Error(`Device upsert failed: ${response.status}`);
      }

      updated = updated.filter((u) => u.record.deviceId !== item.record.deviceId);
      consecutiveFailures = 0;
      await logAnalyticsEvent('device.upsert.success', { deviceId: item.record.deviceId });
    } catch (error) {
      const attempts = item.attempts + 1;
      const isTerminal = attempts >= MAX_ATTEMPTS;
      const delay = calculateBackoffDelay(attempts, {
        baseMs: BASE_DELAY_MS,
        maxMs: MAX_DELAY_MS,
        jitterMs: JITTER_MS,
      });

      const found = updated.find((u) => u.record.deviceId === item.record.deviceId);
      if (found) {
        found.attempts = attempts;
        found.nextAttemptAt = Date.now() + delay;
        found.status = isTerminal ? 'failed' : 'pending';
      }

      consecutiveFailures += 1;

      if (isTerminal) {
        await logError(error as Error, {
          action: 'device_upsert_failed_terminal',
          metadata: { deviceId: item.record.deviceId, attempts },
        });
      } else {
        await logAnalyticsEvent('device.upsert.retry', {
          deviceId: item.record.deviceId,
          attempts,
          delay,
        });
      }
    }
  }

  await saveUpsertQueue(updated);
  flushInFlight = false;

  if (consecutiveFailures >= DEGRADE_THRESHOLD) {
    void logAnalyticsEvent('device.upsert.degraded', {
      failures: consecutiveFailures,
      queueSize: updated.filter((u) => u.status === 'pending').length,
    });
  }

  if (updated.some((u) => u.status === 'pending')) {
    const delay = calculateBackoffDelay(1, {
      baseMs: BASE_DELAY_MS,
      maxMs: MAX_DELAY_MS,
      jitterMs: JITTER_MS,
    });
    scheduleFlush(delay);
  }
}

async function upsertLocal(record: DeviceRecord): Promise<DeviceRecord> {
  registry.set(record.deviceId, record);
  await persistRegistry(Array.from(registry.values()));
  return record;
}

export async function syncOnLogin(userId: string): Promise<DeviceRecord[]> {
  await loadRegistryFromLocal();
  try {
    const remote = await fetchRemoteRegistry(userId);
    const merged = mergeByLastSeen(Array.from(registry.values()), remote);
    registry.clear();
    merged.forEach((rec) => registry.set(rec.deviceId, rec));
    await persistRegistry(merged);
    return merged;
  } catch (error) {
    await logError(error as Error, { action: 'device_registry_sync', metadata: { userId } });
    return Array.from(registry.values());
  }
}

export async function upsertDevice(
  userId: string,
  deviceId: string,
  deviceInfo: Record<string, any>,
  status: DeviceStatus = 'suspect'
): Promise<DeviceRecord> {
  await loadRegistryFromLocal();
  const now = new Date().toISOString();
  const nextRecord: DeviceRecord = {
    deviceId,
    userId,
    deviceInfo,
    status,
    lastSeen: now,
  };

  await upsertLocal(nextRecord);

  const queue = await loadUpsertQueue();
  upsertQueueEntry(nextRecord, queue);
  await saveUpsertQueue(queue);
  scheduleFlush(0);

  return nextRecord;
}

// Exported for tests/diagnostics
export async function flushDeviceUpserts(force = false) {
  await flushUpserts(force);
}

export async function markDeviceTrusted(deviceId: string): Promise<DeviceRecord | undefined> {
  const existing = registry.get(deviceId);
  if (!existing) return undefined;
  existing.status = 'trusted';
  existing.lastSeen = new Date().toISOString();
  await upsertLocal(existing);
  const queue = await loadUpsertQueue();
  upsertQueueEntry(existing, queue);
  await saveUpsertQueue(queue);
  scheduleFlush(0);
  return existing;
}

export async function markDeviceBlocked(deviceId: string): Promise<DeviceRecord | undefined> {
  const existing = registry.get(deviceId);
  if (!existing) return undefined;
  existing.status = 'blocked';
  existing.lastSeen = new Date().toISOString();
  await upsertLocal(existing);
  const queue = await loadUpsertQueue();
  upsertQueueEntry(existing, queue);
  await saveUpsertQueue(queue);
  scheduleFlush(0);
  return existing;
}

export function getDevice(deviceId: string): DeviceRecord | undefined {
  return registry.get(deviceId);
}

export function listDevices(): DeviceRecord[] {
  return Array.from(registry.values());
}

export function startBackgroundDeviceSync(userId: string) {
  stopBackgroundDeviceSync();
  syncInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    void syncOnLogin(userId);
    void flushUpserts();
  }, SYNC_INTERVAL_MS);
}

export function stopBackgroundDeviceSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export async function getUpsertQueueSnapshot(): Promise<QueuedUpsert[]> {
  return loadUpsertQueue().then((items) => [...items]);
}

