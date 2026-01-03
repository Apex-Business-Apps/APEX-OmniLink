export type OmniLinkHealthStatus = 'disabled' | 'ok' | 'error';

export interface OmniLinkHealth {
  status: OmniLinkHealthStatus;
  checkedAt: string;
  lastError?: string;
}

export interface OmniLinkRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  idempotencyKey?: string;
  dedupeTtlMs?: number;
}

export interface OmniLinkAdapter {
  request<T = unknown>(options: OmniLinkRequestOptions): Promise<T>;
  health(): Promise<OmniLinkHealth>;
}
