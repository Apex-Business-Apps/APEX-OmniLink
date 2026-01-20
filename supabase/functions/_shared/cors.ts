/**
 * Shared CORS utilities for Supabase Edge Functions
 *
 * Provides standardized CORS headers and preflight handling
 * to eliminate duplication across functions.
 *
 * Author: OmniLink APEX
 * Date: 2026-01-19
 */

// Standard CORS headers for OmniLink functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Handle CORS preflight requests
 * @param req - The incoming request
 * @returns Response for OPTIONS requests, null for other methods
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204
    });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers
 * @param data - Data to serialize as JSON
 * @param status - HTTP status code (default: 200)
 * @returns Response with CORS headers
 */
export function corsJsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Build CORS headers based on origin
 * @param origin - Request origin header value
 * @returns CORS headers object
 */
export function buildCorsHeaders(origin: string | null): HeadersInit {
  return corsHeaders;
}

/**
 * Handle CORS preflight request
 * @param req - The incoming request
 * @returns Response for OPTIONS preflight
 */
export function handlePreflight(req: Request): Response {
  return new Response(null, {
    headers: corsHeaders,
    status: 204,
  });
}

/**
 * Check if origin is allowed
 * @param origin - Request origin
 * @returns True if allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  // Allow all origins for now (can be refined with allowlist)
  return true;
}

/**
 * Create a CORS error response
 * @param message - Error message
 * @param status - HTTP status code
 * @returns Error response with CORS headers
 */
export function corsErrorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}
