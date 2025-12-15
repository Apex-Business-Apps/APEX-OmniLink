/**
 * Thin server-side Lovable client. Do NOT import this in browser code.
 */

import { calculateBackoffDelay } from '@/lib/backoff';
import type {
  AuditEventPayload,
  DeviceInfo,
  DeviceRegistryResponse,
  LovableClientConfig,
  LovableRequestOptions,
} from './types';

function getEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  // For environments where process.env is shimmed (e.g., serverless bundlers)
  return (import.meta as any)?.env?.[name];
}

function getConfig(): LovableClientConfig | null {
  const baseUrl = getEnv('LOVABLE_API_BASE') ?? '';
  const apiKey = getEnv('LOVABLE_API_KEY') ?? '';
  const serviceRoleKey = getEnv('LOVABLE_SERVICE_ROLE_KEY');

  if (!baseUrl || !apiKey) {
    // Graceful degradation: return null if not configured (enterprise-ready resilience)
    return null;
  }

  return { baseUrl, apiKey, serviceRoleKey };
}

async function requestLovable<T>(options: LovableRequestOptions): Promise<T | undefined> {
  const config = getConfig();
  if (!config) {
    // Graceful degradation: return undefined if not configured (idempotent, non-blocking)
    return undefined;
  }
  const { baseUrl, apiKey, serviceRoleKey } = config;
  const {
    path,
    body,
    method = 'POST',
    signal,
    maxAttempts = 5,
    baseDelayMs = 500,
    maxDelayMs = 10_000,
  } = options;

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(serviceRoleKey ? { 'X-Service-Role': serviceRoleKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        lastError = new Error(`Lovable request failed (${response.status}): ${text}`);
        if (response.status >= 500 && attempt < maxAttempts) {
          const delay = calculateBackoffDelay(attempt, {
            baseMs: baseDelayMs,
            maxMs: maxDelayMs,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }
      return undefined as T;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      const delay = calculateBackoffDelay(attempt, {
        baseMs: baseDelayMs,
        maxMs: maxDelayMs,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown Lovable client error');
}

export async function postAuditEvent(payload: AuditEventPayload, signal?: AbortSignal): Promise<void> {
  await requestLovable<void>({
    path: '/audit-events',
    method: 'POST',
    body: payload,
    signal,
  });
}

export async function upsertDevice(userId: string, device: DeviceInfo, signal?: AbortSignal): Promise<void> {
  await requestLovable<void>({
    path: '/device-registry',
    method: 'POST',
    body: { ...device, user_id: userId },
    signal,
  });
}

export async function getDeviceRegistry(userId: string, signal?: AbortSignal): Promise<DeviceRegistryResponse> {
  return requestLovable<DeviceRegistryResponse>({
    path: `/device-registry?user_id=${encodeURIComponent(userId)}`,
    method: 'GET',
    signal,
  });
}

