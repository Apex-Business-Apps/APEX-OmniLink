import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOmniLinkIntegrationBrainPrompt } from "../_shared/omnilinkIntegrationBrain.ts";
import { evaluatePromptSafety, validateLLMOutput } from "../_shared/promptDefense.ts";
import { buildCorsHeaders, handlePreflight, isOriginAllowed } from "../_shared/cors.ts";

// Maximum request body size (100KB)
const MAX_REQUEST_SIZE = 100 * 1024;

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
    const { query, history = [] } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    const traceId = crypto.randomUUID();

    if (!openAIKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof query !== 'string' || !query.trim()) {
      return new Response(
        JSON.stringify({ error: 'Query must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const promptSafety = evaluatePromptSafety(query);
    if (!promptSafety.safe) {
      console.warn('APEX: Prompt rejected', { traceId, violations: promptSafety.violations });
      return new Response(
        JSON.stringify({ error: 'Prompt rejected by safety guardrails' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        return new Response(
          JSON.stringify({ error: 'Request timed out' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
          return new Response(
            JSON.stringify({ 
              error: 'AI request failed', 
              details: errorText,
              message: 'Please ensure OPENAI_API_KEY is configured correctly' 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'AI request failed', 
            details: errorText,
            message: 'Please ensure OPENAI_API_KEY is configured correctly' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;
    
    console.log('APEX: Received response', { traceId });

    const outputSafety = validateLLMOutput(assistantMessage);
    if (!outputSafety.safe) {
      console.error('APEX: Output failed safety validation', { traceId, violations: outputSafety.violations });
      return new Response(
        JSON.stringify({ error: 'AI response blocked by safety guardrails' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
