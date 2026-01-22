/**
 * Shared CORS utilities for Supabase Edge Functions
 *
 * Provides standardized CORS headers and preflight handling
 * with dynamic origin validation (fail-closed).
 *
 * Author: OmniLink APEX
 * Date: 2026-01-21
 * Remediation: R2 - Wildcard CORS removed, allowlist-based validation added
 */

/**
 * Check if an origin is allowed based on environment configuration
 * @param origin - The origin to check (from request header)
 * @returns true if allowed, false otherwise (fail-closed)
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Exact match from ALLOWED_ORIGINS
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (allowedOrigins) {
    const origins = allowedOrigins.split(',').map((o: string) => o.trim());
    if (origins.includes(origin)) {
      return true;
    }
  }

  // Regex match from ALLOWED_ORIGIN_REGEXES
  const allowedRegexes = Deno.env.get('ALLOWED_ORIGIN_REGEXES');
  if (allowedRegexes) {
    const regexes = allowedRegexes.split(',').map((r: string) => r.trim());
    for (const pattern of regexes) {
      try {
        const regex = new RegExp(pattern);
        if (regex.test(origin)) {
          return true;
        }
      } catch (e) {
        console.warn(`Invalid regex pattern in ALLOWED_ORIGIN_REGEXES: ${pattern}`, e);
      }
    }
  }

  // Default deny (fail-closed)
  return false;
}

/**
 * Build CORS headers with dynamic origin validation
 * @param origin - The origin from request header
 * @returns CORS headers object
 */
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = isOriginAllowed(origin);

  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

/**
 * Handle CORS preflight requests (OPTIONS)
 * @param req - The incoming request
 * @returns Response for OPTIONS requests
 */
export function handlePreflight(req: Request): Response {
  const origin = req.headers.get('origin');
  const headers = buildCorsHeaders(origin);

  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Create an error response with CORS headers
 * @param errorCode - Error code identifier
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param origin - Origin for CORS headers
 * @returns Response with error and CORS headers
 */
export function corsErrorResponse(
  errorCode: string,
  message: string,
  status: number,
  origin: string | null
): Response {
  const headers = buildCorsHeaders(origin);

  return new Response(
    JSON.stringify({
      error: errorCode,
      message,
    }),
    {
      status,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Legacy CORS handler (backward compatibility)
 * @param req - The incoming request
 * @returns Response for OPTIONS requests, null for other methods
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }
  return null;
}

/**
 * Create a JSON response with CORS headers (backward compatibility)
 * @param data - Data to serialize as JSON
 * @param status - HTTP status code (default: 200)
 * @param origin - Origin for CORS headers (optional)
 * @returns Response with CORS headers
 */
export function corsJsonResponse(
  data: unknown,
  status: number = 200,
  origin: string | null = null
): Response {
  const headers = buildCorsHeaders(origin);

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

// Legacy export for backward compatibility (deprecated - use buildCorsHeaders instead)
// This will return headers with "null" origin for any wildcard usage
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};
