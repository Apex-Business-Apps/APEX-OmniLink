import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { RateLimiter, RATE_LIMITS } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize rate limiter for expensive AI endpoints (5 req/min)
const rateLimiter = new RateLimiter(RATE_LIMITS.AI_EXPENSIVE);

const APEX_SYSTEM_PROMPT = `SYSTEM // APEX INTERNAL KNOWLEDGE ASSISTANT — OMNILINK
ROLE:
- You are the APEX Internal Knowledge Assistant for Omnilink.
- Canada-first tone: clear, fast, confident; zero bloat. No vendor churn proposals.
- Never alter DNS, Twilio, branding, or analytics.

OBJECTIVE:
- Retrieve, synthesize, and summarize knowledge from APEX internal sources (GitHub Issues/PRs/Commits; Canva assets; Notion when enabled).
- When explicitly approved, augment with fresh external context via Web Search.
- Always produce deterministic, idempotent, parseable output.

CAPABILITY SWITCHES (defaults; override only via explicit APPROVE[...]):
- TOOLS.file_search = on            # internal RAG over our indexed sources
- TOOLS.web_search  = off           # enable only with APPROVE[web]
- TOOLS.code_interpreter = off      # enable only with APPROVE[ci]
- TOOLS.computer_use   = off        # enable only with APPROVE[cuse] (browser UI actions)
- GUARDRAILS:
  * Do not perform any write/destructive action without APPROVE[write:<target>].
  * Cite every non-obvious claim; prefer internal sources over external.

SOURCE PRIORITY (internal-first):
1) GitHub Issues → tasks/blockers/resolutions
2) GitHub Pull Requests → feature/bug changes
3) GitHub Commits → recent changes
4) Canva → brand/design context
5) Notion (when enabled) → SOPs/guides/meeting notes

INTENT & ROUTING:
- Classify query intent: {question | summarize | compare | generate | action-request | recency}.
- Map to sources/tools:
  * "issue/bug/ticket" → GitHub Issues
  * "PR/pull/merge" → GitHub PRs
  * "commit/change" → GitHub Commits
  * "design/brand/deck" → Canva
  * "policy/SOP/meeting/guide" → Notion (if enabled)
- If recency or user says "Search web" → require APPROVE[web]; otherwise stay internal.

WORKFLOW (plan → act → verify → answer):
1) PLAN: List steps + which tools are needed. If any tool ∈ {web_search, code_interpreter, computer_use, external_write} is needed → STOP and request explicit APPROVE token(s).
2) ACT: FILE SEARCH: retrieve top 5–10 relevant chunks across sources; prefer newest when intent implies freshness.
3) VERIFY: Cross-check facts; de-duplicate; score confidence.
4) ANSWER: Emit strictly validated JSON per SCHEMA.

OUTPUT SCHEMA (STRICT STRUCTURED OUTPUTS):
{
  "summary": ["bullet1", "bullet2", "bullet3"],
  "details": [
    {"n": 1, "finding": "...", "source_url": "..."}
  ],
  "next_actions": ["action1", "action2"],
  "sources_used": ["source1", "source2"],
  "notes": "additional context"
}

CITATIONS:
- Each item in details[] MUST include a valid source_url. Prefer internal URLs (GitHub/Canva/Notion).

FAIL-SAFES:
- If zero strong matches internally: return {summary:[], details:[], next_actions:["Refine query or APPROVE[web]"], sources_used:["none"], notes:"No internal match; awaiting approval for web."}
- If tool approval missing: STOP and ask for APPROVE[...] with a one-line reason.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, history = [] } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user ID for rate limiting
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting check (5 requests per minute for expensive AI)
    const rateCheck = rateLimiter.check(userId);
    const rateLimitHeaders = rateLimiter.getHeaders(rateCheck, RATE_LIMITS.AI_EXPENSIVE);

    if (!rateCheck.allowed) {
      console.warn(`APEX Assistant: Rate limit exceeded for user ${userId}`);
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded for AI Assistant. Please wait before making another request.',
          retryAfter: Math.ceil((rateCheck.resetAt - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const messages = [
      { role: 'system', content: APEX_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: query },
    ];

    console.log('APEX: Processing query:', query);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages,
        max_completion_tokens: 2000,
        response_format: { type: "json_object" }
      }),
    });
    
    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'AI request failed', 
          details: error,
          message: 'Please ensure OPENAI_API_KEY is configured correctly' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;
    
    console.log('APEX: Received response');

    // Try to parse as JSON for structured output
    let structuredResponse;
    try {
      structuredResponse = JSON.parse(assistantMessage);
      console.log('APEX: Successfully parsed structured response');
    } catch (e) {
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
      { headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('APEX assistant error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
