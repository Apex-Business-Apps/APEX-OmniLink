/**
 * Shared Authentication Utilities for Edge Functions
 *
 * Provides JWT verification and user extraction for authenticated endpoints.
 * CVE Remediation: Centralized auth prevents inconsistent authentication patterns.
 *
 * Usage:
 *   import { requireAuth, getUser, AuthError } from '../_shared/auth.ts';
 */

import { createClient, User } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { buildCorsHeaders } from './cors.ts';

export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'missing_token' | 'invalid_token' | 'expired_token' | 'unauthorized',
    public status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthResult {
  user: User;
  token: string;
}

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  // Support both "Bearer <token>" and raw token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Verify JWT and extract user information
 * Throws AuthError if authentication fails
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const token = extractToken(req);

  if (!token) {
    throw new AuthError(
      'Missing authorization token',
      'missing_token',
      401
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AuthError(
      'Server configuration error',
      'unauthorized',
      500
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError(
      error?.message || 'Invalid or expired token',
      'invalid_token',
      401
    );
  }

  return { user, token };
}

/**
 * Get user from request without throwing (returns null if not authenticated)
 */
export async function getUser(req: Request): Promise<User | null> {
  try {
    const result = await verifyAuth(req);
    return result.user;
  } catch {
    return null;
  }
}

/**
 * Middleware-style auth check - returns error Response or null if auth passes
 */
export async function requireAuth(req: Request): Promise<Response | AuthResult> {
  try {
    const result = await verifyAuth(req);
    return result;
  } catch (error) {
    if (error instanceof AuthError) {
      const origin = req.headers.get('origin');
      return new Response(
        JSON.stringify({
          error: error.code,
          message: error.message,
        }),
        {
          status: error.status,
          headers: {
            ...buildCorsHeaders(origin),
            'Content-Type': 'application/json',
          },
        }
      );
    }
    throw error;
  }
}

/**
 * Check if user has admin role (for sensitive operations)
 */
export function isAdmin(user: User): boolean {
  const role = user.app_metadata?.role || user.user_metadata?.role;
  return role === 'admin' || role === 'service_role';
}

/**
 * WebSocket authentication - extract and verify token from URL or headers
 */
export async function verifyWebSocketAuth(req: Request): Promise<AuthResult> {
  // Try URL query param first (common for WebSocket clients)
  const url = new URL(req.url);
  const tokenFromUrl = url.searchParams.get('token');

  if (tokenFromUrl) {
    // Create a new request with the token in the header for verification
    const fakeReq = new Request(req.url, {
      headers: new Headers({
        Authorization: `Bearer ${tokenFromUrl}`,
      }),
    });
    return verifyAuth(fakeReq);
  }

  // Fall back to header-based auth
  return verifyAuth(req);
}

/**
 * Create unauthorized response for WebSocket upgrade denial
 */
export function unauthorizedWebSocketResponse(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Bearer realm="websocket"',
    },
  });
}
