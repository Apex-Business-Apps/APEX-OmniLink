/**
 * Shared authentication utilities for Supabase Edge Functions
 *
 * Provides standardized JWT validation and user authentication
 * to eliminate duplication across functions.
 *
 * Author: OmniLink APEX
 * Date: 2026-01-19
 */

import { createClient, User } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Initialize Supabase client with service role
 * @returns Configured Supabase client
 */
export function createSupabaseClient(): ReturnType<typeof createClient> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Validate JWT token and get authenticated user
 * @param authHeader - Authorization header value
 * @param supabase - Supabase client instance
 * @returns Authentication result
 */
export async function authenticateUser(authHeader: string | null, supabase: ReturnType<typeof createClient>): Promise<AuthResult> {
  if (!authHeader) {
    return { success: false, error: 'Authentication required' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Invalid authorization header format' };
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      return { success: false, error: 'Invalid or expired session' };
    }

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return { success: true, user };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Get client IP address from request
 * @param req - The request object
 * @returns Client IP address
 */
export function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown';
}

/**
 * Get client user agent from request
 * @param req - The request object
 * @returns User agent string
 */
export function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') || 'unknown';
}

/**
 * Create standardized error response for authentication failures
 * @param error - Error message
 * @param status - HTTP status code (default: 401)
 * @returns Response object
 */
export function createAuthErrorResponse(error: string, status: number = 401) {
  return new Response(
    JSON.stringify({
      error: 'unauthorized',
      message: error,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create standardized error response for method not allowed
 * @param allowedMethods - Array of allowed HTTP methods
 * @returns Response object
 */
export function createMethodNotAllowedResponse(allowedMethods: string[] = ['POST']) {
  return new Response(
    JSON.stringify({
      error: 'method_not_allowed',
      message: `Only ${allowedMethods.join(', ')} requests are allowed`,
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': allowedMethods.join(', '),
      },
    }
  );
}

/**
 * Create standardized error response for internal server errors
 * @param message - Error message (sanitized for client)
 * @returns Response object
 */
export function createInternalErrorResponse(message: string = 'An unexpected error occurred') {
  return new Response(
    JSON.stringify({
      error: 'internal_error',
      message,
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
