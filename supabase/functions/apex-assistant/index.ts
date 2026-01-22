import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOmniLinkIntegrationBrainPrompt } from "../_shared/omnilinkIntegrationBrain.ts";
import { evaluatePromptSafety, validateLLMOutput } from "../_shared/promptDefense.ts";
import { buildCorsHeaders, handlePreflight, isOriginAllowed } from "../_shared/cors.ts";

// Maximum request body size (100KB)
const MAX_REQUEST_SIZE = 100 * 1024;

/**
 * Build standardized error response
 * @param error - Error message or object
 * @param status - HTTP status code
 * @param corsHeaders - CORS headers to include
 * @param additionalHeaders - Optional additional headers
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

const systemPromptPromise = getOmniLinkIntegrationBrainPrompt();

serve(async (req) => {
  // Handle CORS preflight with origin validation
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  const requestOrigin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;
  const corsHeaders = buildCorsHeaders(requestOrigin);

  // Validate origin for non-preflight requests
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
    const { query, history = [] } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    const traceId = crypto.randomUUID();

    if (!openAIKey) {
      return errorResponse('OPENAI_API_KEY not configured', 500, corsHeaders);
    }

    if (typeof query !== 'string' || !query.trim()) {
      return errorResponse('Query must be a non-empty string', 400, corsHeaders);
    }

    const promptSafety = evaluatePromptSafety(query);
    if (!promptSafety.safe) {
      console.warn('APEX: Prompt rejected', { traceId, violations: promptSafety.violations });
      return errorResponse('Prompt rejected by safety guardrails', 400, corsHeaders);
    }

    const systemPrompt = await systemPromptPromise;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: query },
    ];

    // Get model from env or use fallback
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-2024-08-06';
    const fallbackModel = 'gpt-4o-mini';
    
    console.log('APEX: Processing query', { traceId, length: query.length, historyCount: history.length });
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000); // 60 second timeout

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_completion_tokens: 2000,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        return errorResponse('Request timed out', 504, corsHeaders);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    
    console.log('OpenAI response status:', response.status, { traceId });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      
      // Try fallback model if primary model fails with 404
      if (response.status === 404 && model !== fallbackModel) {
        console.log('APEX: Trying fallback model:', fallbackModel);
        try {
          const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: fallbackModel,
              messages,
              max_completion_tokens: 2000,
              response_format: { type: "json_object" }
            }),
          });
          
          if (fallbackResponse.ok) {
            response = fallbackResponse;
          } else {
            throw new Error('Fallback model also failed');
          }
        } catch {
          return errorResponse(
            {
              error: 'AI request failed',
              details: errorText,
              message: 'Please ensure OPENAI_API_KEY is configured correctly'
            },
            500,
            corsHeaders
          );
        }
      } else {
        return errorResponse(
          {
            error: 'AI request failed',
            details: errorText,
            message: 'Please ensure OPENAI_API_KEY is configured correctly'
          },
          500,
          corsHeaders
        );
      }
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;
    
    console.log('APEX: Received response', { traceId });

    const outputSafety = validateLLMOutput(assistantMessage);
    if (!outputSafety.safe) {
      console.error('APEX: Output failed safety validation', { traceId, violations: outputSafety.violations });
      return errorResponse('AI response blocked by safety guardrails', 502, corsHeaders);
    }

    // Try to parse as JSON for structured output
    let structuredResponse;
    try {
      structuredResponse = JSON.parse(assistantMessage);
      console.log('APEX: Successfully parsed structured response');
    } catch {
      console.log('APEX: Response not in JSON format, wrapping as plain text');
      // If not JSON, return as plain text
      structuredResponse = {
        summary: [assistantMessage.substring(0, 200)],
        details: [],
        next_actions: ["APEX returned unstructured output - try rephrasing your query"],
        sources_used: ['AI response'],
        notes: assistantMessage,
      };
    }

    return new Response(
      JSON.stringify({ response: structuredResponse, raw: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('APEX assistant error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      corsHeaders
    );
  }
});
