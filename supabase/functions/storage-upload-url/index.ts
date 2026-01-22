import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders, handlePreflight, isOriginAllowed } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitExceededResponse, RATE_LIMIT_PROFILES, addRateLimitHeaders } from "../_shared/ratelimit.ts";
import { createServiceClient } from "../_shared/supabaseClient.ts";

// Maximum request body size (1MB for upload metadata)
const MAX_REQUEST_SIZE = 1024 * 1024;

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Build standardized error response
 * @param error - Error message or object
 * @param status - HTTP status code
 * @param headers - Additional headers (corsHeaders will be merged)
 * @param corsHeaders - CORS headers to include
 * @returns Response object
 */
function errorResponse(
  error: string | Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
  additionalHeaders?: Record<string, string>
): Response {
  const body = typeof error === 'string' ? { error } : error;
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        ...additionalHeaders,
      }
    }
  );
}

serve(async (req) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const requestOrigin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;
  const corsHeaders = buildCorsHeaders(requestOrigin);

  console.log(`[${requestId}] Request started: ${req.method} ${req.url}`);

  // Handle CORS preflight with origin validation
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  // Validate origin
  if (!isOriginAllowed(requestOrigin)) {
    return errorResponse('Origin not allowed', 403, corsHeaders);
  }

  // Check request size limit
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_REQUEST_SIZE) {
    return errorResponse(
      { error: 'Request body too large', max_size: MAX_REQUEST_SIZE },
      413,
      corsHeaders
    );
  }

  try {
    // Create Supabase client with service role
    const supabase = createServiceClient();

    // Get user from Authorization header
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      console.error("Authentication error:", authErr);
      return errorResponse("Unauthorized", 401, corsHeaders);
    }

    // Distributed rate limiting check
    const rateCheck = await checkRateLimit(user.id, RATE_LIMIT_PROFILES.upload);
    if (!rateCheck.allowed) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
      return rateLimitExceededResponse(rateCheck, RATE_LIMIT_PROFILES.upload, corsHeaders);
    }

    // Parse request body
    const { filename, mime: _mime, size } = await req.json();

    if (!filename) {
      return errorResponse("Filename is required", 400, corsHeaders);
    }

    // Enhanced filename sanitization (path traversal prevention)
    const safe = filename
      .replace(/[^\w.-]+/g, "_")
      .replace(/\.{2,}/g, ".")  // Prevent directory traversal
      .replace(/^\.+/, "")       // Remove leading dots
      .replace(/^_+/, "")        // Remove leading underscores
      .slice(0, 180);

    // Validate sanitized filename is not empty
    if (!safe || safe.length === 0) {
      return errorResponse("Invalid filename", 400, corsHeaders);
    }

    // Validate file size (10MB limit)
    if (size && size > 10 * 1024 * 1024) {
      return errorResponse("File size exceeds 10MB limit", 400, corsHeaders);
    }

    const path = `${user.id}/${Date.now()}-${safe}`;
    console.log(`Creating signed upload URL for path: ${path}`);

    // Create signed upload URL (valid for ~2 hours)
    const { data, error } = await supabase
      .storage
      .from("user-files")
      .createSignedUploadUrl(path);

    if (error) {
      console.error("Error creating signed upload URL:", error);
      return errorResponse("Failed to create upload URL", 500, corsHeaders);
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Successfully created signed upload URL for: ${path} (${duration}ms)`);

    return new Response(
      JSON.stringify({ path, token: data.token, signedUrl: data.signedUrl }),
      {
        headers: addRateLimitHeaders(
          {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
          rateCheck,
          RATE_LIMIT_PROFILES.upload
        ),
        status: 200
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Unexpected error (${duration}ms):`, error);

    return errorResponse(
      { error: "Internal server error", requestId },
      500,
      corsHeaders,
      { "X-Request-ID": requestId }
    );
  }
});
