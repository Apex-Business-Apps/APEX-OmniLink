import { calculateBackoffDelay } from '@/lib/backoff';
import { logAnalyticsEvent, logError } from '@/lib/monitoring';
import { persistentGet, persistentSet } from '@/libs/persistence';
import type { AuditEventPayload } from '@/integrations/lovable/types';

type QueuedAuditEvent = AuditEventPayload & {
  attempts: number;
  nextAttemptAt: number;
  status: 'pending' | 'failed';
};

const RECENT_LIMIT = 200;
const QUEUE_KEY = 'lovable_audit_queue_v1';

// Use Supabase Edge Function if available, otherwise fall back to local proxy
function getAuditProxyUrl(): string {
  // Check if we should use Supabase function
  const useSupabaseFunction = import.meta.env.VITE_USE_SUPABASE_LOVABLE !== 'false';
  if (useSupabaseFunction && typeof window !== 'undefined') {
    // Get Supabase URL from env
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      // Extract project ref from Supabase URL
      const url = new URL(supabaseUrl);
      return `${url.origin}/functions/v1/lovable-audit`;
    }
  }
  // Fallback to local proxy or custom URL
  return import.meta.env.VITE_LOVABLE_AUDIT_PROXY ?? '/api/lovable/audit';
}

const PROXY_URL = getAuditProxyUrl();
const MAX_ATTEMPTS = Number(import.meta.env.VITE_AUDIT_MAX_ATTEMPTS ?? 5);
const BASE_DELAY_MS = Number(import.meta.env.VITE_AUDIT_RETRY_BASE_MS ?? 500);
const MAX_DELAY_MS = Number(import.meta.env.VITE_AUDIT_RETRY_MAX_MS ?? 10_000);
const JITTER_MS = Number(import.meta.env.VITE_AUDIT_RETRY_JITTER_MS ?? 250);
const DEGRADE_THRESHOLD = Number(import.meta.env.VITE_AUDIT_DEGRADE_THRESHOLD ?? 3);

let recentEvents: AuditEventPayload[] = [];
let queue: QueuedAuditEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight = false;
let consecutiveFlushFailures = 0;

function generateId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

async function loadQueue(): Promise<QueuedAuditEvent[]> {
  if (queue.length) return queue;
  const stored = await persistentGet<QueuedAuditEvent[]>(QUEUE_KEY);
  queue = stored ?? [];
  return queue;
}

async function saveQueue(updated: QueuedAuditEvent[]): Promise<void> {
  queue = updated;
  await persistentSet(QUEUE_KEY, updated);
}

function scheduleFlush(delay = 0) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, delay);
}

async function sendToProxy(entry: AuditEventPayload): Promise<void> {
  // Graceful degradation: if proxy URL is not configured, skip server sync (enterprise resilience)
  if (!PROXY_URL || PROXY_URL === '/api/lovable/audit') {
    // Check if we're in a browser environment without server proxy
    if (typeof window !== 'undefined') {
      // In browser, server proxy may not be available - this is OK, events stay in queue
      throw new Error('Audit proxy not available - events will be queued locally');
    }
  }

  const controller = new AbortController();
  const timeoutMs = Number(import.meta.env.VITE_AUDIT_TIMEOUT_MS ?? 10_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    // Check if using Supabase function (needs auth header)
    const isSupabaseFunction = PROXY_URL.includes('/functions/v1/');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-User-Id': entry.actorId ?? 'anonymous',
    };
    
    if (isSupabaseFunction && typeof window !== 'undefined') {
      // Get auth token from Supabase client if available
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event: entry }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Audit proxy failed: ${response.status} ${text}`);
    }
  } catch (error) {
    // Network errors are expected when backend is unavailable - events stay queued (idempotent)
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
      throw new Error('Network unavailable - events queued locally');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function flushQueue(force = false): Promise<void> {
  if (flushInFlight) return;
  flushInFlight = true;
  const now = Date.now();
  const pendingQueue = await loadQueue();

  let updated = [...pendingQueue];
  for (const item of pendingQueue) {
    if (item.status === 'failed') continue;
    if (!force && item.nextAttemptAt > now) continue;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      scheduleFlush(2_000);
      break;
    }

    try {
      await sendToProxy(item);
      updated = updated.filter((e) => e.id !== item.id);
      consecutiveFlushFailures = 0;
      await logAnalyticsEvent('audit.flush.success', { id: item.id });
    } catch (error) {
      const attempts = item.attempts + 1;
      const isTerminal = attempts >= MAX_ATTEMPTS;
      const backoffMs = calculateBackoffDelay(attempts, {
        baseMs: BASE_DELAY_MS,
        maxMs: MAX_DELAY_MS,
        jitterMs: JITTER_MS,
      });

      const mutated = updated.find((e) => e.id === item.id);
      if (mutated) {
        mutated.attempts = attempts;
        mutated.nextAttemptAt = Date.now() + backoffMs;
        mutated.status = isTerminal ? 'failed' : 'pending';
      }

      consecutiveFlushFailures += 1;

      if (isTerminal) {
        await logError(error as Error, {
          action: 'audit_flush_failed_terminal',
          metadata: { id: item.id, attempts },
        });
      } else {
        await logAnalyticsEvent('audit.flush.retry', {
          id: item.id,
          attempts,
          backoffMs,
        });
      }
    }
  }

  await saveQueue(updated);
  flushInFlight = false;

  if (consecutiveFlushFailures >= DEGRADE_THRESHOLD) {
    void logAnalyticsEvent('audit.flush.degraded', {
      failures: consecutiveFlushFailures,
      queueSize: updated.filter((q) => q.status === 'pending').length,
    });
  }

  if (updated.some((q) => q.status === 'pending')) {
    const backoff = calculateBackoffDelay(1, {
      baseMs: BASE_DELAY_MS,
      maxMs: MAX_DELAY_MS,
      jitterMs: JITTER_MS,
    });
    scheduleFlush(backoff);
  }
}

export function recordAuditEvent(event: Omit<AuditEventPayload, 'id' | 'timestamp'>): AuditEventPayload {
  const entry: AuditEventPayload = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...event,
  };
  recentEvents.push(entry);
  if (recentEvents.length > RECENT_LIMIT) {
    recentEvents.shift();
  }

  void (async () => {
    const existing = await loadQueue();
    existing.push({
      ...entry,
      attempts: 0,
      nextAttemptAt: Date.now(),
      status: 'pending',
    });
    await saveQueue(existing);
    scheduleFlush(0);
  })();

  return entry;
}

export function getAuditEvents(limit = 50): AuditEventPayload[] {
  return recentEvents.slice(-limit).reverse();
}

export function getAuditQueueSnapshot(): Promise<QueuedAuditEvent[]> {
  return loadQueue().then((items) => [...items]);
}

