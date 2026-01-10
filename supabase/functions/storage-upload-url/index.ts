import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, handlePreflight, isOriginAllowed } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitExceededResponse, RATE_LIMIT_PROFILES, addRateLimitHeaders } from "../_shared/ratelimit.ts";

// Maximum request body size (1MB for upload metadata)
const MAX_REQUEST_SIZE = 1024 * 1024;

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check request size limit
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_REQUEST_SIZE) {
    return new Response(
      JSON.stringify({ error: 'Request body too large', max_size: MAX_REQUEST_SIZE }),
      { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from Authorization header
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      console.error("Authentication error:", authErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Distributed rate limiting check
    const rateCheck = await checkRateLimit(user.id, RATE_LIMIT_PROFILES.upload);
    if (!rateCheck.allowed) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
      return rateLimitExceededResponse(rateCheck, RATE_LIMIT_PROFILES.upload, corsHeaders);
    }

    // Parse request body
    const { filename, mime, size } = await req.json();

    if (!filename) {
      return new Response(JSON.stringify({ error: "Filename is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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
      return new Response(JSON.stringify({ error: "Invalid filename" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate file size (10MB limit)
    if (size && size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File size exceeds 10MB limit" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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
      return new Response(JSON.stringify({ error: "Failed to create upload URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
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

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        requestId
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-ID": requestId
        }
      }
    );
  }
});
