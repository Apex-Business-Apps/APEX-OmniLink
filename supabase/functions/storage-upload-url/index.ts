import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
};

// Enhanced rate limiting with cleanup
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = { maxRequests: 20, windowMs: 60000 }; // 20 uploads per minute

function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let record = rateLimitStore.get(identifier);
  
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT.windowMs };
  }
  
  if (record.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetTime };
  }
  
  record.count++;
  rateLimitStore.set(identifier, record);
  return { 
    allowed: true, 
    remaining: RATE_LIMIT.maxRequests - record.count,
    resetAt: record.resetTime 
  };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[${requestId}] Request started: ${req.method} ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Rate limiting check
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
      
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later.",
          retryAfter 
        }),
        { 
          status: 429,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "X-RateLimit-Limit": RATE_LIMIT.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateCheck.resetAt).toISOString(),
            "Retry-After": retryAfter.toString(),
            "X-Request-ID": requestId
          }
        }
      );
    }

    // Parse request body
    const { filename, mime, size } = await req.json();
    
    if (!filename) {
      return new Response(JSON.stringify({ error: "Filename is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Enhanced filename sanitization
    const safe = filename
      .replace(/[^\w.-]+/g, "_")
      .replace(/\.{2,}/g, ".")  // Prevent directory traversal
      .replace(/^\.+/, "")       // Remove leading dots
      .slice(0, 180);
    
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
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Successfully created signed upload URL for: ${path} (${duration}ms)`);

    return new Response(
      JSON.stringify({ path, token: data.token, signedUrl: data.signedUrl }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
          "X-RateLimit-Limit": RATE_LIMIT.maxRequests.toString(),
          "X-RateLimit-Remaining": rateCheck.remaining.toString(),
        },
        status: 200
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Unexpected error (${duration}ms):`, error);
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
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