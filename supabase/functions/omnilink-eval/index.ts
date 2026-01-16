import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth, isAdmin, AuthResult } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

interface EvalRequest {
  eval_case_id?: string;
  run_all_active?: boolean;
  custom_message?: string;
}

interface EvalResponse {
  eval_case_id: string;
  eval_result_id: string;
  score: number;
  verdict: 'pass' | 'fail' | 'partial' | 'error';
  skills_found: string[];
  skills_expected: string[];
  response_quality: number;
  security_check_passed: boolean;
  performance_ms: number;
  agent_response: string;
}

// Simple scoring function for evaluation
function scoreEvaluation(
  userMessage: string,
  agentResponse: string,
  expectedSkills: string[],
  skillsFound: string[],
  expectedPattern?: string
): { score: number; verdict: 'pass' | 'fail' | 'partial' | 'error'; responseQuality: number } {
  let score = 0;
  let responseQuality = 50; // Base quality score

  // Check if expected skills were found
  const skillMatchRatio = expectedSkills.length > 0
    ? skillsFound.filter(skill => expectedSkills.includes(skill)).length / expectedSkills.length
    : 1;

  score += skillMatchRatio * 40; // 40% weight on skill matching

  // Check response quality (basic heuristics)
  if (agentResponse.length > 10) responseQuality += 20;
  if (agentResponse.includes('?') || agentResponse.includes('!')) responseQuality += 10;
  if (expectedPattern && new RegExp(expectedPattern, 'i').test(agentResponse)) responseQuality += 20;

  score += Math.min(responseQuality, 100) * 0.6; // 60% weight on response quality

  // Determine verdict
  let verdict: 'pass' | 'fail' | 'partial' | 'error' = 'fail';
  if (score >= 80) verdict = 'pass';
  else if (score >= 60) verdict = 'partial';

  return {
    score: Math.round(Math.min(score, 100)),
    verdict,
    responseQuality: Math.min(responseQuality, 100)
  };
}

// Security check function
function performSecurityCheck(agentResponse: string): boolean {
  const securityPatterns = [
    /password|token|key|secret|credential/i,
    /ssn|social.security|tax.id/i,
    /credit.card|card.number/i,
    /private.key|certificate/i
  ];

  return !securityPatterns.some(pattern => pattern.test(agentResponse));
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  try {
    // Require authentication - evaluation endpoint is sensitive
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) {
      return authResult; // Return 401 response
    }

    // Only admins can run evaluations
    if (!isAdmin(authResult.user)) {
      return new Response(JSON.stringify({
        error: 'forbidden',
        message: 'Admin access required for evaluation endpoint'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[omnilink-eval] Evaluation triggered by user ${authResult.user.id}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { eval_case_id, run_all_active, custom_message }: EvalRequest = await req.json();

    if (!eval_case_id && !run_all_active && !custom_message) {
      return new Response(JSON.stringify({
        error: 'Must provide eval_case_id, run_all_active=true, or custom_message'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: EvalResponse[] = [];

    if (run_all_active) {
      // Run evaluation on all active eval cases
      const { data: evalCases, error: casesError } = await supabase
        .from('eval_cases')
        .select('*')
        .eq('is_active', true);

      if (casesError) throw casesError;

      for (const evalCase of evalCases || []) {
        const result = await runSingleEvaluation(supabase, evalCase.id);
        results.push(result);
      }
    } else if (eval_case_id) {
      // Run evaluation on specific case
      const result = await runSingleEvaluation(supabase, eval_case_id);
      results.push(result);
    } else if (custom_message) {
      // Run evaluation with custom message (create temporary eval case)
      const tempEvalCase = {
        name: `temp_eval_${Date.now()}`,
        description: 'Temporary evaluation case',
        category: 'general',
        user_message: custom_message,
        expected_skills: [],
        difficulty: 'medium'
      };

      // Insert temporary eval case
      const { data: insertedCase, error: insertError } = await supabase
        .from('eval_cases')
        .insert(tempEvalCase)
        .select()
        .single();

      if (insertError) throw insertError;

      const result = await runSingleEvaluation(supabase, insertedCase.id);
      results.push(result);

      // Clean up temporary case
      await supabase.from('eval_cases').delete().eq('id', insertedCase.id);
    }

    return new Response(JSON.stringify({
      success: true,
      evaluations: results,
      total_evaluations: results.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Evaluation error:', error);
    return new Response(JSON.stringify({
      error: 'Evaluation failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function runSingleEvaluation(supabase: SupabaseClient, evalCaseId: string): Promise<EvalResponse> {
  // Get eval case
  const { data: evalCase, error: caseError } = await supabase
    .from('eval_cases')
    .select('*')
    .eq('id', evalCaseId)
    .single();

  if (caseError) throw caseError;

  const startTime = Date.now();

  try {
    // Call omnilink-agent with the eval case message
    const agentResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/omnilink-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'x-thread-id': `eval_${evalCaseId}_${Date.now()}`
      },
      body: JSON.stringify({
        message: evalCase.user_message
      })
    });

    if (!agentResponse.ok) {
      throw new Error(`Agent call failed: ${agentResponse.status}`);
    }

    const agentResult = await agentResponse.json();

    // Extract skills used from agent response
    const skillsFound = agentResult.skillsUsed || [];

    // Perform evaluation scoring
    const evaluation = scoreEvaluation(
      evalCase.user_message,
      agentResult.response,
      evalCase.expected_skills,
      skillsFound,
      evalCase.expected_response_pattern
    );

    // Security check
    const securityPassed = performSecurityCheck(agentResult.response);

    const endTime = Date.now();
    const performanceMs = endTime - startTime;

    // Store evaluation result
    const evalResultData = {
      eval_case_id: evalCaseId,
      agent_run_id: agentResult.threadId ? null : null, // Would need to extract from telemetry if available
      score: evaluation.score,
      verdict: evaluation.verdict,
      skills_found: skillsFound,
      skills_expected: evalCase.expected_skills,
      response_quality: evaluation.responseQuality,
      security_check_passed: securityPassed,
      performance_ms: performanceMs,
      raw_response: agentResult,
      metadata: {
        eval_timestamp: new Date().toISOString(),
        agent_version: '1.0',
        evaluation_version: '1.0'
      }
    };

    const { data: insertedResult, error: resultError } = await supabase
      .from('eval_results')
      .insert(evalResultData)
      .select()
      .single();

    if (resultError) throw resultError;

    return {
      eval_case_id: evalCaseId,
      eval_result_id: insertedResult.id,
      score: evaluation.score,
      verdict: evaluation.verdict,
      skills_found: skillsFound,
      skills_expected: evalCase.expected_skills,
      response_quality: evaluation.responseQuality,
      security_check_passed: securityPassed,
      performance_ms: performanceMs,
      agent_response: agentResult.response
    };

  } catch (error) {
    console.error(`Evaluation failed for case ${evalCaseId}:`, error);

    // Store failed evaluation result
    const { data: failedResult, error: failError } = await supabase
      .from('eval_results')
      .insert({
        eval_case_id: evalCaseId,
        score: 0,
        verdict: 'error',
        skills_found: [],
        skills_expected: evalCase.expected_skills,
        response_quality: 0,
        security_check_passed: false,
        performance_ms: Date.now() - startTime,
        error_message: error.message,
        metadata: { error_timestamp: new Date().toISOString() }
      })
      .select()
      .single();

    if (failError) console.error('Failed to store error result:', failError);

    return {
      eval_case_id: evalCaseId,
      eval_result_id: failedResult?.id || 'error',
      score: 0,
      verdict: 'error',
      skills_found: [],
      skills_expected: evalCase.expected_skills,
      response_quality: 0,
      security_check_passed: false,
      performance_ms: Date.now() - startTime,
      agent_response: `Error: ${error.message}`
    };
  }
}

// Export for Deno
export { handler };