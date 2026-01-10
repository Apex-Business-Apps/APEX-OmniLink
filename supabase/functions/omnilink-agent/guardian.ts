/**
 * Guardian Gate - Edge-first validation and moderation for OmniLink requests
 *
 * This module provides cheap, fast validation before expensive orchestrator calls.
 * Designed to prevent malicious input, spam, and nonsensical requests.
 */

interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

interface RequestPayload {
  query: string;
  traceId: string;
}

/**
 * Main guardian check - orchestrates all validation layers
 */
export async function checkRequest(request: Request, payload: RequestPayload): Promise<ValidationResult> {
  try {
    // 1. Content-Type validation (fast)
    if (!isValidContentType(request)) {
      return { allowed: false, reason: "invalid_request" };
    }

    // 2. Size limits (fast)
    if (!isValidSize(payload)) {
      return { allowed: false, reason: "invalid_request" };
    }

    // 3. Moderation check (cheap API call)
    const moderationResult = await checkModeration(payload.query);
    if (!moderationResult.allowed) {
      return { allowed: false, reason: "moderation_flagged" };
    }

    // 4. Intent sanity check (optional, low-cost LLM call)
    if (shouldCheckIntent()) {
      const intentResult = await checkIntentSanity(payload.query);
      if (!intentResult.allowed) {
        return { allowed: false, reason: "failed_intent_check" };
      }
    }

    return { allowed: true };
  } catch (error) {
    console.error("Guardian check failed:", error);
    // Fail-safe: allow on error to avoid blocking legitimate requests
    return { allowed: true };
  }
}

/**
 * Validate Content-Type header
 */
function isValidContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  return contentType?.includes("application/json") ?? false;
}

/**
 * Validate request size limits
 */
function isValidSize(payload: RequestPayload): boolean {
  const { query } = payload;

  // Character limits
  const MAX_QUERY_LENGTH = 2000;
  if (query.length > MAX_QUERY_LENGTH) {
    return false;
  }

  // Depth limits (prevent nested JSON attacks)
  const MAX_DEPTH = 3;
  try {
    const parsed = JSON.parse(JSON.stringify(payload)); // Deep clone to check
    if (getJsonDepth(parsed) > MAX_DEPTH) {
      return false;
    }
  } catch {
    return false; // Invalid JSON
  }

  return true;
}

/**
 * Check content against OpenAI moderation API
 */
async function checkModeration(content: string): Promise<ValidationResult> {
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.warn("OPENAI_API_KEY not set, skipping moderation");
      return { allowed: true };
    }

    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: content,
      }),
    });

    if (!response.ok) {
      console.warn("Moderation API failed, allowing request");
      return { allowed: true };
    }

    const result = await response.json();
    const flagged = result.results?.[0]?.flagged ?? false;

    return { allowed: !flagged };
  } catch (error) {
    console.error("Moderation check error:", error);
    // Fail-safe: allow on error
    return { allowed: true };
  }
}

/**
 * Optional intent sanity check using cheap LLM
 */
async function checkIntentSanity(query: string): Promise<ValidationResult> {
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return { allowed: true };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Cheap and fast
        messages: [
          {
            role: "system",
            content: "You are a validator. Respond with only 'VALID' or 'INVALID'. Check if this appears to be a coherent request that an AI assistant could help with."
          },
          {
            role: "user",
            content: query.substring(0, 500) // Limit input
          }
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      return { allowed: true };
    }

    const result = await response.json();
    const responseText = result.choices?.[0]?.message?.content?.trim().toUpperCase();

    return { allowed: responseText === "VALID" };
  } catch (error) {
    console.error("Intent check error:", error);
    return { allowed: true };
  }
}

/**
 * Determine if intent check should run (configurable)
 */
function shouldCheckIntent(): boolean {
  return Deno.env.get("GUARDIAN_INTENT_CHECK_ENABLED") === "true";
}

/**
 * Calculate JSON depth (prevents nested object attacks)
 */
function getJsonDepth(obj: unknown, currentDepth = 0): number {
  if (obj === null || typeof obj !== "object") {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  for (const value of Object.values(obj)) {
    maxDepth = Math.max(maxDepth, getJsonDepth(value, currentDepth + 1));
  }

  return maxDepth;
}
