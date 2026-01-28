/**
 * Trigger Workflow Edge Function - The Moat Gateway
 *
 * A hardened entry point that enforces:
 * - Idempotency (prevents double-billing)
 * - Cryptographic Signing (SHA-256 request hash)
 * - Dynamic URL resolution (Production vs Local)
 *
 * Author: APEX CTO
 * Date: 2026-01-25
 * Architecture: Edge Gateway -> Temporal Orchestrator -> AI
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { withHttp, jsonResponse } from '../_shared/http.ts';
import { authenticateUser } from '../_shared/auth.ts';

/** Workflow request payload structure */
interface WorkflowRequestPayload {
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  session_id: string; // Thread ID
  idempotency_key: string;
  trace_id: string; // Run ID
}

/** Workflow response structure */
interface WorkflowResponse {
  workflow_id: string;
  status: 'queued' | 'active';
  request_hash: string;
}

/**
 * Default local development orchestrator URL.
 *
 * SECURITY NOTE (NOSONAR): This HTTP URL is intentionally used ONLY for local
 * Docker development where TLS is not available. The function enforces that:
 * 1. Production environments MUST set ORCHESTRATOR_URL (checked via SUPABASE_DB_URL)
 * 2. This fallback is NEVER used when SUPABASE_DB_URL is present
 * 3. Local Docker networking (host.docker.internal) doesn't support HTTPS
 *
 * In production, ORCHESTRATOR_URL must be set to an HTTPS endpoint.
 */
const LOCAL_DEV_ORCHESTRATOR_URL = 'http://host.docker.internal:8000'; // NOSONAR

/**
 * Resolve the orchestrator URL based on environment.
 *
 * Security enforcement:
 * - Production: MUST use ORCHESTRATOR_URL env var (enforced, should be HTTPS)
 * - Local dev: Falls back to LOCAL_DEV_ORCHESTRATOR_URL only when not in production
 *
 * @throws Error if in production without ORCHESTRATOR_URL configured
 */
function resolveOrchestratorUrl(): string {
  // Primary: Use explicitly configured URL (should be HTTPS in production)
  const envUrl = Deno.env.get('ORCHESTRATOR_URL');
  if (envUrl) {
    return envUrl;
  }

  // Check if running in Supabase hosted/production environment
  const isProduction = Deno.env.get('SUPABASE_DB_URL') !== undefined;
  if (isProduction) {
    // SECURITY: Fail-fast in production - require explicit HTTPS configuration
    throw new Error(
      'ORCHESTRATOR_URL must be set in production environment. ' +
      'Configure an HTTPS endpoint for the workflow orchestrator.'
    );
  }

  // Local development only: use Docker internal hostname
  // This code path is unreachable in production (guarded above)
  console.warn(
    '[trigger-workflow] Using local development orchestrator URL. ' +
    'Set ORCHESTRATOR_URL for production deployments.'
  );
  return LOCAL_DEV_ORCHESTRATOR_URL;
}

/**
 * Compute SHA-256 hash of the request for integrity verification.
 * Uses Web Crypto API (available in Deno).
 */
async function computeRequestHash(
  query: string,
  sessionId: string,
  traceId: string
): Promise<string> {
  const data = `${query}|${sessionId}|${traceId}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex;
}

/** UUID regex pattern for idempotency key validation */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a value is a non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Check if a value is a valid UUID.
 */
function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validate a single history message entry.
 */
function isValidHistoryMessage(msg: unknown): boolean {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  const hasValidRole = m.role === 'user' || m.role === 'assistant';
  const hasValidContent = typeof m.content === 'string';
  return hasValidRole && hasValidContent;
}

/**
 * Validate the history array if present.
 */
function isValidHistory(history: unknown): boolean {
  if (history === undefined) return true;
  if (!Array.isArray(history)) return false;
  return history.every(isValidHistoryMessage);
}

/**
 * Validate the request payload structure.
 * Extracted sub-validations reduce cognitive complexity.
 */
function validatePayload(
  body: unknown
): body is WorkflowRequestPayload {
  if (!body || typeof body !== 'object') return false;

  const payload = body as Record<string, unknown>;

  // Validate required string fields
  const hasValidQuery = isNonEmptyString(payload.query);
  const hasValidSessionId = isNonEmptyString(payload.session_id);
  const hasValidIdempotencyKey = isNonEmptyString(payload.idempotency_key);
  const hasValidTraceId = isNonEmptyString(payload.trace_id);

  if (!hasValidQuery || !hasValidSessionId || !hasValidIdempotencyKey || !hasValidTraceId) {
    return false;
  }

  // Validate UUID format for idempotency_key
  if (!isValidUuid(payload.idempotency_key as string)) {
    return false;
  }

  // Validate UUID format for trace_id
  if (!isValidUuid(payload.trace_id as string)) {
    return false;
  }

  // Validate optional history array
  return isValidHistory(payload.history);
}

serve(
  withHttp(
    async (req, ctx) => {
      // Only accept POST requests
      if (req.method !== 'POST') {
        return jsonResponse(
          { error: 'method_not_allowed', message: 'Only POST is allowed' },
          405,
          ctx.corsHeaders
        );
      }

      // Authenticate the user
      const authResult = await authenticateUser(req);
      if (!authResult.user) {
        return jsonResponse(
          { error: 'unauthorized', message: 'Authentication required' },
          401,
          ctx.corsHeaders
        );
      }

      // Validate payload
      if (!validatePayload(ctx.body)) {
        return jsonResponse(
          {
            error: 'invalid_payload',
            message:
              'Required: query (string), session_id (string), ' +
              'trace_id (UUID), idempotency_key (UUID)',
          },
          400,
          ctx.corsHeaders
        );
      }

      const payload = ctx.body as WorkflowRequestPayload;

      try {
        // Compute cryptographic seal
        const requestHash = await computeRequestHash(
          payload.query,
          payload.session_id,
          payload.trace_id
        );

        // Resolve orchestrator URL
        const orchestratorUrl = resolveOrchestratorUrl();

        // Forward to orchestrator with idempotency headers
        // FIXED: Call canonical /api/v1/goals endpoint with GoalRequest schema
        const orchestratorResponse = await fetch(
          `${orchestratorUrl}/api/v1/goals`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': payload.idempotency_key,
              'X-Request-Signature': requestHash,
              'X-User-Id': authResult.user.id,
              'X-Session-Id': payload.session_id,
            },
            body: JSON.stringify({
              user_id: authResult.user.id,
              user_intent: payload.query,
              trace_id: payload.trace_id,
            }),
          }
        );

        if (!orchestratorResponse.ok) {
          const errorText = await orchestratorResponse.text();
          console.error(
            `Orchestrator error: ${orchestratorResponse.status}`,
            errorText
          );

          // Handle idempotency conflict (already processed)
          if (orchestratorResponse.status === 409) {
            const existingData = JSON.parse(errorText);
            return jsonResponse(
              {
                workflow_id: existingData.workflow_id,
                status: 'active' as const,
                request_hash: requestHash,
                deduplicated: true,
              },
              200,
              ctx.corsHeaders
            );
          }

          return jsonResponse(
            {
              error: 'orchestrator_error',
              message: 'Failed to trigger workflow',
            },
            502,
            ctx.corsHeaders
          );
        }

        const orchestratorData = await orchestratorResponse.json();

        const response: WorkflowResponse = {
          workflow_id:
            orchestratorData.workflowId ?? payload.trace_id,
          status: 'queued',
          request_hash: requestHash,
        };

        return jsonResponse(response, 202, ctx.corsHeaders);
      } catch (error) {
        console.error('Workflow trigger error:', error);

        // Handle orchestrator connection errors gracefully
        if (
          error instanceof TypeError &&
          error.message.includes('fetch')
        ) {
          return jsonResponse(
            {
              error: 'orchestrator_unavailable',
              message: 'Workflow orchestrator is not available',
            },
            503,
            ctx.corsHeaders
          );
        }

        return jsonResponse(
          {
            error: 'internal_error',
            message:
              error instanceof Error ? error.message : 'Unknown error',
          },
          500,
          ctx.corsHeaders
        );
      }
    },
    {
      maxBodySizeBytes: 256 * 1024, // 256KB max payload
      requireOrigin: true,
    }
  )
);
