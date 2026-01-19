/**
 * HTTP Utilities for Edge Functions
 * 
 * Provides a withHttp wrapper that handles:
 * - CORS preflight
 * - Origin validation
 * - JSON parsing
 * - Error handling with consistent responses
 * - Request size limits
 */

import { buildCorsHeaders, corsErrorResponse, handlePreflight, isOriginAllowed } from './cors.ts';

export interface HttpHandlerContext {
    origin: string | null;
    corsHeaders: HeadersInit;
    body: unknown;
    rawBody: string;
    bodySize: number;
}

export type HttpHandler = (
    req: Request,
    ctx: HttpHandlerContext
) => Promise<Response> | Response;

export interface HttpOptions {
    maxBodySizeBytes?: number;
    requireOrigin?: boolean;
    requireAuth?: boolean;
}

/**
 * Wrap an edge function handler with HTTP boilerplate.
 * 
 * Usage:
 * ```ts
 * Deno.serve(withHttp(async (req, ctx) => {
 *   const { data } = ctx.body;
 *   return jsonResponse({ result: data }, 200, ctx.corsHeaders);
 * }));
 * ```
 */
export function withHttp(
    handler: HttpHandler,
    options: HttpOptions = {}
): (req: Request) => Promise<Response> {
    const {
        maxBodySizeBytes = 1024 * 1024, // 1MB default
        requireOrigin = true,
        requireAuth = false,
    } = options;

    return async (req: Request): Promise<Response> => {
        const requestOrigin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;
        const corsHeaders = buildCorsHeaders(requestOrigin);

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            return handlePreflight(req);
        }

        // Validate origin
        if (requireOrigin && !isOriginAllowed(requestOrigin)) {
            return corsErrorResponse(
                'origin_not_allowed',
                'CORS policy: Origin not allowed',
                403,
                requestOrigin
            );
        }

        try {
            // Parse and validate body
            let body: unknown = null;
            let rawBody = '';
            let bodySize = 0;

            if (req.method !== 'GET' && req.method !== 'HEAD') {
                const contentLength = parseInt(req.headers.get('content-length') || '0', 10);

                if (contentLength > maxBodySizeBytes) {
                    return jsonResponse(
                        { error: 'payload_too_large', max_size: maxBodySizeBytes },
                        413,
                        corsHeaders
                    );
                }

                try {
                    const buffer = await req.arrayBuffer();
                    rawBody = new TextDecoder().decode(buffer);
                    bodySize = new TextEncoder().encode(rawBody).length;

                    if (bodySize > maxBodySizeBytes) {
                        return jsonResponse(
                            { error: 'payload_too_large', max_size: maxBodySizeBytes },
                            413,
                            corsHeaders
                        );
                    }

                    if (rawBody) {
                        body = JSON.parse(rawBody);
                    }
                } catch (parseError) {
                    return jsonResponse(
                        { error: 'invalid_json', message: 'Request body must be valid JSON' },
                        400,
                        corsHeaders
                    );
                }
            }

            // Check auth if required
            if (requireAuth) {
                const authHeader = req.headers.get('Authorization');
                if (!authHeader) {
                    return jsonResponse({ error: 'unauthorized' }, 401, corsHeaders);
                }
            }

            // Build context and call handler
            const context: HttpHandlerContext = {
                origin: requestOrigin,
                corsHeaders,
                body,
                rawBody,
                bodySize,
            };

            return await handler(req, context);
        } catch (error) {
            console.error('Edge function error:', error);
            return jsonResponse(
                {
                    error: 'internal_error',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                500,
                corsHeaders
            );
        }
    };
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
    data: unknown,
    status: number,
    headers: HeadersInit = {}
): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...headers,
            'Content-Type': 'application/json',
        },
    });
}

/**
 * Parse bearer token from Authorization header
 */
export function parseBearerToken(req: Request): string | null {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;
    return authHeader.replace('Bearer ', '').trim();
}
