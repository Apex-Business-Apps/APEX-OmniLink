/**
 * APEX OmniLink Agent - Skinny Router (Edge → Orchestrator)
 *
 * Architecture: Fast validation → Delegate to Python/Temporal orchestrator
 *
 * This Edge Function is now a ROUTER, not a processor.
 * Heavy lifting (Guardian, Planner, Executor) happens in the Python orchestrator.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Fast validation (PII redaction, basic checks)
 * 3. Create EventEnvelope
 * 4. POST to Python orchestrator
 * 5. Return workflow ID for polling
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

interface AgentRequest {
  message: string;
  threadId?: string;
  context?: Record<string, unknown>;
}

interface EventEnvelope {
  event_id: string;
  correlation_id: string;
  idempotency_key: string;
  tenant_id: string;
  event_type: string;
  payload: {
    goal: string;
    user_id: string;
    context?: Record<string, unknown>;
  };
  timestamp: string;
  source: string;
  trace: {
    trace_id: string;
    span_id: string;
  };
}

// ============================================================================
// FAST VALIDATION (< 100ms)
// ============================================================================

// Basic injection patterns (regex only - no LLM)
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions?|rules?|prompts?)/i,
  /system\s+(override|message|prompt)/i,
  /admin\s+(mode|override|access)/i,
  /developer\s+mode/i,
  /bypass\s+(security|filter|rules?)/i,
];

function fastValidation(message: string): { safe: boolean; reason?: string } {
  // Quick regex check
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        safe: false,
        reason: "Input rejected by security policy (injection attempt detected)",
      };
    }
  }

  // Length check
  if (message.length > 10000) {
    return { safe: false, reason: "Input too long (max 10,000 characters)" };
  }

  return { safe: true };
}

// ============================================================================
// EVENT ENVELOPE CREATION
// ============================================================================

function generateUUID(): string {
  return crypto.randomUUID();
}

function createEventEnvelope(
  userId: string,
  message: string,
  context?: Record<string, unknown>
): EventEnvelope {
  const correlationId = generateUUID();
  const timestamp = new Date().toISOString();

  return {
    event_id: generateUUID(),
    correlation_id: correlationId,
    idempotency_key: `${userId}-goal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    tenant_id: userId.split("-")[0] || "default", // Extract tenant from user ID
    event_type: "omnilink:agent.goal_received",
    payload: {
      goal: message,
      user_id: userId,
      context,
    },
    timestamp,
    source: "omnihub",
    trace: {
      trace_id: correlationId,
      span_id: generateUUID(),
    },
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    // ========================================================================
    // STEP 1: AUTHENTICATION
    // ========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ========================================================================
    // STEP 2: PARSE REQUEST
    // ========================================================================
    const body = (await req.json()) as AgentRequest;
    const { message, context } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'message' field" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 3: FAST VALIDATION (< 100ms)
    // ========================================================================
    const validation = fastValidation(message);
    if (!validation.safe) {
      console.warn(`[Security] Rejected input from user ${user.id}: ${validation.reason}`);
      return new Response(
        JSON.stringify({
          error: validation.reason,
          safe: false,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 4: CREATE EVENT ENVELOPE
    // ========================================================================
    const envelope = createEventEnvelope(user.id, message, context);

    console.log(`[Router] Created event envelope for user ${user.id}`);
    console.log(`[Router] Correlation ID: ${envelope.correlation_id}`);

    // ========================================================================
    // STEP 5: DISPATCH TO PYTHON ORCHESTRATOR
    // ========================================================================
    const orchestratorUrl = Deno.env.get("ORCHESTRATOR_URL");

    if (!orchestratorUrl) {
      console.error("ORCHESTRATOR_URL not configured");

      // Fallback: Return error with helpful message
      return new Response(
        JSON.stringify({
          error: "Orchestrator not configured. Set ORCHESTRATOR_URL environment variable.",
          fallback_mode: true,
          message: "Python orchestrator is not connected. Please configure ORCHESTRATOR_URL.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[Router] Dispatching to orchestrator: ${orchestratorUrl}`);

    const orchestratorResponse = await fetch(
      `${orchestratorUrl}/api/v1/goals`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("ORCHESTRATOR_API_KEY") || ""}`,
        },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(5000), // 5s timeout for orchestrator response
      }
    );

    if (!orchestratorResponse.ok) {
      const errorText = await orchestratorResponse.text();
      console.error(
        `[Router] Orchestrator error (${orchestratorResponse.status}): ${errorText}`
      );

      return new Response(
        JSON.stringify({
          error: "Orchestrator unavailable",
          status: orchestratorResponse.status,
          details: errorText,
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 6: RETURN WORKFLOW ID TO CLIENT
    // ========================================================================
    const orchestratorData = await orchestratorResponse.json();

    console.log(`[Router] Workflow started: ${orchestratorData.workflow_id}`);

    return new Response(
      JSON.stringify({
        status: "accepted",
        workflow_id: orchestratorData.workflow_id,
        correlation_id: envelope.correlation_id,
        poll_url: orchestratorData.poll_url || `/api/v1/workflows/${orchestratorData.workflow_id}/status`,
        message: "Your request is being processed by the AI orchestrator",
      }),
      {
        status: 202, // 202 Accepted (async processing)
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("[Router] Unexpected error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * MIGRATION NOTES:
 *
 * Old Flow (Fat Edge):
 * Edge Function → Guardian (LLM) → Planner (LLM) → Executor (DAG)
 * Problem: 60s timeout, no durability, no event sourcing
 *
 * New Flow (Skinny Router):
 * Edge Function (fast validation) → Python Orchestrator → Temporal Workflows
 * Benefits: Unlimited time, durable execution, event sourcing, Saga rollback
 *
 * Required Environment Variables:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_ANON_KEY: Anon/publishable key
 * - ORCHESTRATOR_URL: Python orchestrator endpoint (e.g., https://apex-orchestrator.fly.dev)
 * - ORCHESTRATOR_API_KEY: (Optional) API key for orchestrator authentication
 *
 * Frontend Changes Required:
 * - Poll for results using workflow_id
 * - See: src/hooks/useAgentWorkflow.ts
 */
