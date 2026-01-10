/**
 * Shared CORS Configuration
 *
 * Centralized origin validation for all Edge Functions.
 * Prevents wildcard CORS exposure (CVE remediation).
 *
 * Usage:
 *   import { buildCorsHeaders, isOriginAllowed, validateOrigin } from '../_shared/cors.ts';
 */

// Environment-based configuration
const DEMO_MODE = Deno.env.get('DEMO_MODE')?.toLowerCase() === 'true';

// Parse allowed origins from environment variable
const ALLOWED_ORIGINS: string[] = (() => {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('SIWE_ALLOWED_ORIGINS') ?? '';
  return envOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ''));
})();

// Default allowed origins (production domains)
const DEFAULT_ORIGINS = [
  'https://omnihub.dev',
  'https://www.omnihub.dev',
  'https://staging.omnihub.dev',
  'https://app.omnihub.dev',
];

/**
 * Get all allowed origins (environment + defaults)
 */
export function getAllowedOrigins(): string[] {
  if (DEMO_MODE) return ['*'];
  return [...new Set([...ALLOWED_ORIGINS, ...DEFAULT_ORIGINS])];
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (DEMO_MODE) return true;
  if (!origin) return false;

  const normalized = origin.replace(/\/$/, '');
  const allowedList = getAllowedOrigins();

  return allowedList.includes(normalized);
}

/**
 * Build CORS headers for a given request origin
 */
export function buildCorsHeaders(origin: string | null): HeadersInit {
  // If origin is not provided or not allowed, return minimal headers
  if (!origin) {
    return {
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };
  }

  const allowedOrigins = getAllowedOrigins();

  // In demo mode, allow any origin
  if (DEMO_MODE) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Vary': 'Origin',
    };
  }

  // Check if origin is in allowed list
  const normalizedOrigin = origin.replace(/\/$/, '');
  if (allowedOrigins.includes(normalizedOrigin)) {
    return {
      'Access-Control-Allow-Origin': normalizedOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Vary': 'Origin',
    };
  }

  // Origin not allowed - return headers without Access-Control-Allow-Origin
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

/**
 * Validate origin and return appropriate response for preflight
 * Returns null if origin is valid, or an error Response if invalid
 */
export function validateOrigin(req: Request): Response | null {
  const origin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;

  if (!isOriginAllowed(origin)) {
    return new Response(
      JSON.stringify({ error: 'origin_not_allowed', message: 'CORS policy: Origin not allowed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return null;
}

/**
 * Handle CORS preflight request
 */
export function handlePreflight(req: Request): Response {
  const origin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;

  if (!isOriginAllowed(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin)
  });
}

/**
 * Create a standardized error response with CORS headers
 */
export function corsErrorResponse(
  error: string,
  message: string,
  status: number,
  origin: string | null
): Response {
  return new Response(
    JSON.stringify({ error, message }),
    {
      status,
      headers: {
        ...buildCorsHeaders(origin),
        'Content-Type': 'application/json',
      },
    }
  );
}
