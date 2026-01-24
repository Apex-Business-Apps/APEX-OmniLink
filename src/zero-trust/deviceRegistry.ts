import { calculateBackoffDelay } from '@/lib/backoff';
import { logAnalyticsEvent, logError } from '@/lib/monitoring';
import { persistentGet, persistentSet } from '@/libs/persistence';
import { supabase } from '@/integrations/supabase/client';

// Device info interface (migrated from Lovable types)
interface DeviceInfo {
  device_info: Record<string, unknown>;
  last_seen: string;
  device_id: string;
  user_id: string;
}

export type DeviceStatus = 'trusted' | 'suspect' | 'blocked';

export interface DeviceRecord {
  deviceId: string;
  userId: string;
  lastSeen: string;
  deviceInfo: Record<string, unknown>;
  status?: DeviceStatus;
}

type QueuedUpsert = {
  record: DeviceRecord;
  attempts: number;
  nextAttemptAt: number;
  status: 'pending' | 'failed';
};

const REGISTRY_KEY = 'device_registry_v1'; // Updated key name (no longer Lovable-specific)
const UPSERT_QUEUE_KEY = 'device_upserts_v1'; // Updated key name
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

function _toDeviceInfo(record: DeviceRecord): DeviceInfo {
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

/**
 * Fetch device registry directly from Supabase device_registry table
 * Replaces Lovable API dependency
 */
async function fetchRemoteRegistry(userId: string): Promise<DeviceRecord[]> {
  try {
    const { data, error } = await supabase
      .from('device_registry')
      .select('*')
      .eq('user_id', userId)
      .order('last_seen', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch device registry: ${error.message}`);
    }

    return (data || []).map((d) => ({
      deviceId: d.device_id,
      userId: d.user_id,
      lastSeen: d.last_seen,
      deviceInfo: d.device_info as Record<string, unknown>,
      status: d.status as DeviceStatus,
    }));
  } catch (error) {
    // Network errors are expected when backend is unavailable - use local cache (idempotent)
    if (error instanceof Error && error.message.includes('fetch')) {
      return []; // Return empty, will use local cache
    }
    throw error;
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
      // Write directly to Supabase device_registry table
      const { error } = await supabase
        .from('device_registry')
        .upsert({
          user_id: item.record.userId,
          device_id: item.record.deviceId,
          device_info: item.record.deviceInfo,
          status: item.record.status || 'suspect',
          last_seen: item.record.lastSeen,
        }, {
          onConflict: 'user_id,device_id',
        });

      if (error) {
        throw new Error(`Device upsert failed: ${error.message}`);
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
  deviceInfo: Record<string, unknown>,
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

