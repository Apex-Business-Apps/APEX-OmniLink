import { encodeBase64Url } from 'https://deno.land/std@0.177.0/encoding/base64url.ts';
import { buildCorsHeaders, corsErrorResponse, handlePreflight, isOriginAllowed } from '../_shared/cors.ts';
import { allowAdapter, allowWorkflow, enforceEnvAllowlist, enforcePermission, type OmniLinkScopes } from '../_shared/omnilinkScopes.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabaseClient.ts';
import { normalizeOmniPortIntent, type OmniPortInput } from '../../src/integrations/omniport/normalize.ts';

const OMNILINK_ENABLED = (Deno.env.get('OMNILINK_ENABLED') ?? '').toLowerCase() === 'true';
const MAX_SINGLE_PAYLOAD_BYTES = 256 * 1024;
const MAX_BATCH_PAYLOAD_BYTES = 1024 * 1024;
const MAX_BATCH_ITEMS = 50;
const DEFAULT_MAX_CONCURRENCY = 5;

const inflight = new Map<string, number>();

const textEncoder = new TextEncoder();

interface ApiKeyRecord {
  id: string;
  tenant_id: string;
  integration_id: string;
  key_hash: string;
  key_prefix: string;
  scopes: OmniLinkScopes;
}

function parseBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  return authHeader.replace('Bearer ', '').trim();
}

function parseRoute(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const portIndex = segments.indexOf('omnilink-port');
  if (portIndex === -1) return '';
  return segments.slice(portIndex + 1).join('/');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

async function hashKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function generateKey(): { secret: string; key: string; prefix: string } {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const secret = encodeBase64Url(raw);
  const prefix = secret.slice(0, 8);
  return { secret, prefix, key: `omni.${prefix}.${secret}` };
}

function getConstraints(scopes: OmniLinkScopes): Required<NonNullable<OmniLinkScopes['constraints']>> {
  return {
    env_allowlist: scopes.constraints?.env_allowlist ?? [],
    max_rpm: scopes.constraints?.max_rpm ?? 60,
    max_concurrency: scopes.constraints?.max_concurrency ?? DEFAULT_MAX_CONCURRENCY,
    max_payload_kb: scopes.constraints?.max_payload_kb ?? 256,
    allowed_adapters: scopes.constraints?.allowed_adapters ?? [],
    allowed_workflows: scopes.constraints?.allowed_workflows ?? [],
    approvals_required_for: scopes.constraints?.approvals_required_for ?? [],
  };
}


async function enforceConcurrency(keyId: string, limit: number): Promise<boolean> {
  const current = inflight.get(keyId) ?? 0;
  if (current >= limit) return false;
  inflight.set(keyId, current + 1);
  return true;
}

function releaseConcurrency(keyId: string): void {
  const current = inflight.get(keyId) ?? 0;
  if (current <= 1) {
    inflight.delete(keyId);
  } else {
    inflight.set(keyId, current - 1);
  }
}

async function loadApiKey(token: string, supabase = createServiceClient()): Promise<ApiKeyRecord | null> {
  const parts = token.split('.');
  if (parts.length < 3 || parts[0] !== 'omni') return null;
  const prefix = parts[1];
  const { data, error } = await supabase
    .from('omnilink_api_keys')
    .select('id, tenant_id, integration_id, key_hash, key_prefix, scopes')
    .eq('key_prefix', prefix)
    .is('revoked_at', null);

  if (error || !data?.length) return null;
  const hashed = await hashKey(token);
  const hashedBytes = hexToBytes(hashed);

  for (const record of data as ApiKeyRecord[]) {
    const recordBytes = hexToBytes(record.key_hash);
    if (timingSafeEqual(recordBytes, hashedBytes)) {
      const { data: integration } = await supabase
        .from('integrations')
        .select('status')
        .eq('id', record.integration_id)
        .maybeSingle();

      if (integration?.status && integration.status !== 'active') {
        return null;
      }

      await supabase
        .from('omnilink_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', record.id);
      return record;
    }
  }
  return null;
}

function validateEnvelope(payload: Record<string, unknown>, requiredFields: string[]): string | null {
  for (const field of requiredFields) {
    if (!payload[field]) return field;
  }
  return null;
}

async function parseJsonBody(req: Request): Promise<{ raw: string; body: unknown }> {
  const buffer = await req.arrayBuffer();
  const raw = new TextDecoder().decode(buffer);
  return { raw, body: raw ? JSON.parse(raw) : null };
}

function getRequestSize(raw: string): number {
  return textEncoder.encode(raw).length;
}

function jsonResponse(data: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function handleKeyCreation(req: Request, corsHeaders: HeadersInit): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, 401, corsHeaders);
  }

  const serviceClient = createServiceClient();
  const userClient = createAnonClient(authHeader);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return jsonResponse({ error: 'unauthorized' }, 401, corsHeaders);
  }

  const { data: roles } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1);

  if (!roles?.length) {
    return jsonResponse({ error: 'forbidden' }, 403, corsHeaders);
  }

  const { body } = await parseJsonBody(req);
  const payload = body as Record<string, unknown>;
  const integrationId = payload?.integration_id as string | undefined;
  if (!integrationId) {
    return jsonResponse({ error: 'invalid_request', message: 'integration_id is required' }, 400, corsHeaders);
  }

  const { key, prefix } = generateKey();
  const keyHash = await hashKey(key);
  const scopes = payload?.scopes ?? {};

  const { error } = await serviceClient
    .from('omnilink_api_keys')
    .insert({
      tenant_id: user.id,
      integration_id: integrationId,
      name: payload?.name ?? null,
      key_prefix: prefix,
      key_hash: keyHash,
      scopes,
    });

  if (error) {
    return jsonResponse({ error: 'server_error', message: error.message }, 500, corsHeaders);
  }

  return jsonResponse(
    {
      status: 'created',
      key,
      key_prefix: prefix,
      warning: 'This key is shown once. Store it securely.',
    },
    201,
    corsHeaders
  );
}

interface ProcessItemContext {
  route: string;
  apiKey: ApiKeyRecord;
  constraints: Required<NonNullable<OmniLinkScopes['constraints']>>;
  idempotencyHeader: string;
  serviceClient: ReturnType<typeof createServiceClient>;
}

async function processRequestItem(
  item: unknown,
  index: number,
  context: ProcessItemContext
): Promise<Record<string, unknown>> {
  const { route, apiKey, constraints, idempotencyHeader, serviceClient } = context;

  const payload = item as Record<string, unknown>;
  if (!payload || typeof payload !== 'object') {
    return { status: 'invalid', index, error: 'invalid_payload' };
  }

  let requiredFields: string[];
  if (route === 'events') {
    requiredFields = ['specversion', 'id', 'source', 'type', 'time', 'data'];
  } else if (route === 'commands') {
    requiredFields = ['specversion', 'id', 'source', 'type', 'time', 'params'];
  } else {
    requiredFields = ['specversion', 'id', 'source', 'type', 'time', 'workflow', 'input'];
  }

  const missingField = validateEnvelope(payload, requiredFields);
  if (missingField) {
    return { status: 'invalid', index, error: `missing_${missingField}` };
  }

  if (!enforceEnvAllowlist(payload.source as string, constraints.env_allowlist)) {
    return { status: 'denied', index, error: 'env_not_allowed' };
  }

  let permissionRequired = 'events:write';
  let requestType = 'event';

  if (route === 'commands') {
    requestType = 'command';
    permissionRequired = `commands:${payload.type}`;
    if (!allowAdapter(payload.target as { system?: string }, constraints.allowed_adapters)) {
      return { status: 'denied', index, error: 'adapter_not_allowed' };
    }
    if (!enforcePermission(apiKey.scopes ?? {}, 'orchestrations:request')) {
      return { status: 'denied', index, error: 'permission_denied' };
    }
  }

  if (route === 'workflows') {
    requestType = 'workflow';
    permissionRequired = 'orchestrations:request';
    const workflow = payload.workflow as { name?: string; version?: string };
    if (!allowWorkflow(workflow, constraints.allowed_workflows)) {
      return { status: 'denied', index, error: 'workflow_not_allowed' };
    }
    if (payload.input && !payload.params) {
      payload.params = payload.input;
    }
  }

  if (!enforcePermission(apiKey.scopes ?? {}, permissionRequired)) {
    return { status: 'denied', index, error: 'permission_denied' };
  }

  if (constraints.approvals_required_for.includes(payload.type as string)) {
    payload.policy = { ...(payload.policy as Record<string, unknown>), require_approval: true };
  }

  const idempotencyKey = `${idempotencyHeader}:${payload.id ?? index}`;

  const { data, error } = await serviceClient.rpc('omnilink_ingest', {
    p_api_key_id: apiKey.id,
    p_integration_id: apiKey.integration_id,
    p_tenant_id: apiKey.tenant_id,
    p_request_type: requestType,
    p_envelope: payload,
    p_idempotency_key: idempotencyKey,
    p_max_rpm: constraints.max_rpm,
    p_entity: payload.entity ?? null,
  });

  if (error) {
    return { status: 'error', index, error: error.message };
  }

  return { status: data.status, record_id: data.record_id, index, retry_after_seconds: data.retry_after_seconds };
}

function omniPortEnvelope(input: OmniPortInput): Record<string, unknown> {
  const canonical = normalizeOmniPortIntent(input);
  const source = `omniport/${canonical.channel}`;
  const base = {
    specversion: '1.0',
    id: canonical.traceId,
    source,
    type: canonical.type,
    time: canonical.createdAt,
    data: {
      payload: canonical.payload,
      channel: canonical.channel,
      requires_approval: canonical.requiresApproval,
      notify: canonical.notify,
      user_id: canonical.userId ?? null,
      raw: canonical.raw,
    },
  } as Record<string, unknown>;

  if (canonical.requiresApproval) {
    base.policy = { ...(base.policy as Record<string, unknown>), require_approval: true };
  }

  return base;
}

function determineStatusCode(results: Record<string, unknown>[]): number {
  const hasQueued = results.some((result) => result.status === 'queued');
  const hasRateLimited = results.some((result) => result.status === 'rate_limited');
  const singleResult = results.length === 1 ? results[0] : null;

  let statusCode = hasQueued ? 202 : 200;
  if (singleResult?.status === 'denied') statusCode = 403;
  if (singleResult?.status === 'invalid') statusCode = 400;
  if (singleResult?.status === 'error') statusCode = 500;
  if (singleResult?.status === 'rate_limited') statusCode = 429;
  if (!singleResult && hasRateLimited && !hasQueued) statusCode = 429;

  return statusCode;
}

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;
  const corsHeaders = buildCorsHeaders(requestOrigin);

  if (!OMNILINK_ENABLED) {
    return corsErrorResponse('omnilink_disabled', 'OmniLink port is disabled', 503, requestOrigin);
  }

  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  if (!isOriginAllowed(requestOrigin)) {
    return corsErrorResponse('origin_not_allowed', 'CORS policy: Origin not allowed', 403, requestOrigin);
  }

  const route = parseRoute(new URL(req.url).pathname);
  const isOmniPort = route === 'omniport';
  const targetRoute = isOmniPort ? 'events' : route;

  if (req.method === 'GET' && route === 'health') {
    return jsonResponse({ status: 'ok', checked_at: new Date().toISOString() }, 200, corsHeaders);
  }

  if (route === 'keys' && req.method === 'POST') {
    return handleKeyCreation(req, corsHeaders);
  }

  if (!['events', 'commands', 'workflows', 'omniport'].includes(route)) {
    return jsonResponse({ error: 'not_found' }, 404, corsHeaders);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, corsHeaders);
  }

  const token = parseBearerToken(req);
  if (!token) {
    return jsonResponse({ error: 'unauthorized' }, 401, corsHeaders);
  }

  const apiKey = await loadApiKey(token);
  if (!apiKey) {
    return jsonResponse({ error: 'invalid_key' }, 401, corsHeaders);
  }

  const idempotencyHeader = req.headers.get('X-Idempotency-Key');
  if (!idempotencyHeader) {
    return jsonResponse({ error: 'missing_idempotency_key' }, 400, corsHeaders);
  }

  let raw = '';
  let body: unknown = null;
  try {
    const parsed = await parseJsonBody(req);
    raw = parsed.raw;
    body = parsed.body;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, corsHeaders);
  }
  const payloadSize = getRequestSize(raw);
  const constraints = getConstraints(apiKey.scopes ?? {});

  if (payloadSize > constraints.max_payload_kb * 1024) {
    return jsonResponse({ error: 'payload_too_large' }, 413, corsHeaders);
  }

  if (!Array.isArray(body) && payloadSize > MAX_SINGLE_PAYLOAD_BYTES) {
    return jsonResponse({ error: 'payload_too_large', max_bytes: MAX_SINGLE_PAYLOAD_BYTES }, 413, corsHeaders);
  }

  if (payloadSize > MAX_BATCH_PAYLOAD_BYTES) {
    return jsonResponse({ error: 'batch_too_large' }, 413, corsHeaders);
  }

  const requestId = crypto.randomUUID();
  const serviceClient = createServiceClient();

  const items = Array.isArray(body) ? body : [body];
  if (items.length > MAX_BATCH_ITEMS) {
    return jsonResponse({ error: 'batch_too_large', max_items: MAX_BATCH_ITEMS }, 413, corsHeaders);
  }

  const concurrencyOk = await enforceConcurrency(apiKey.id, constraints.max_concurrency);
  if (!concurrencyOk) {
    return jsonResponse({ error: 'concurrency_limit_exceeded' }, 429, corsHeaders);
  }

  try {
    const results = [];

    const normalizedItems = isOmniPort
      ? items.map((item) => omniPortEnvelope(item as OmniPortInput))
      : items;

    for (const [index, item] of normalizedItems.entries()) {
      const result = await processRequestItem(item, index, {
        route: targetRoute,
        apiKey,
        constraints,
        idempotencyHeader,
        serviceClient,
      });
      results.push(result);
    }

    const statusCode = determineStatusCode(results);

    return jsonResponse(
      {
        request_id: requestId,
        results,
      },
      statusCode,
      corsHeaders
    );
  } finally {
    releaseConcurrency(apiKey.id);
  }
});
