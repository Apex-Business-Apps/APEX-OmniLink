/**
 * APEX ASCENSION: OmniLink Tri-Force Agent
 *
 * Hierarchical Architecture: Guardian -> Planner -> Executor
 *
 * - Guardian: Constitutional AI security layer with dynamic policy enforcement
 * - Planner: Cognitive decoupling - decomposes requests before execution
 * - Executor: DAG-based execution with retry logic and audit logging
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SkillRegistry } from '../_shared/skill-loader.ts';
import { AgentState, SkillDefinition } from '../_shared/types.ts';
import { callLLM, callLLMJson, LLMMessage, ToolDefinition, ToolCall } from '../_shared/llm.ts';

// ============================================================================
// CORE TYPES
// ============================================================================

export interface PlanStep {
  id: number;
  description: string;
  tool?: string;
  args?: Record<string, unknown>;
  depends_on?: number[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
}

export interface AgentResponse {
  response: string;
  threadId: string;
  skillsUsed: string[];
  toolResults?: unknown[];
  agentRunId?: string;
  safe: boolean;
  guardianResult?: GuardianResult;
  plan?: PlanStep[];
}

interface GuardianResult {
  safe: boolean;
  reason?: string;
  violations?: string[];
  scannedAt: string;
}

interface AgentPolicy {
  name: string;
  rule_logic: string;
  is_blocking: boolean;
  priority: number;
}

interface AgentRequest {
  message: string;
  threadId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_RETRIES = 2;
const EXECUTOR_TIMEOUT_MS = 30_000;

// Regex-based injection patterns (fast pre-filter before LLM check)
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions?|rules?|prompts?)/i,
  /system\s+(override|message|prompt)/i,
  /admin\s+(mode|override|access)/i,
  /developer\s+mode/i,
  /bypass\s+(security|filter|rules?)/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /uncensored\s+mode/i,
  /pretend\s+you('re| are)\s+not\s+an?\s+ai/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+restrictions/i,
];

// PII patterns for output sanitization
const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REDACTED]'],
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD REDACTED]'],
  [/\b\d{10,11}\b/g, '[PHONE REDACTED]'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REDACTED]'],
];

// ============================================================================
// TOOL EXECUTORS REGISTRY
// ============================================================================

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>;

const toolExecutors: Record<string, ToolExecutor> = {
  CheckCreditScore: async (args: { userId?: string }) => {
    console.log(`[Executor] Checking credit score for: ${args.userId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      creditScore: 750,
      riskLevel: 'low',
      lastUpdated: new Date().toISOString(),
    };
  },

  GetWeather: async (args: { location?: string }) => {
    console.log(`[Executor] Getting weather for: ${args.location}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      location: args.location || 'Unknown',
      temperature: 72,
      conditions: 'Partly Cloudy',
      humidity: 45,
    };
  },

  SearchDatabase: async (args: { query?: string; table?: string }) => {
    console.log(`[Executor] Searching ${args.table} for: ${args.query}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      results: [],
      count: 0,
      message: 'Search completed',
    };
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function redactPII(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function detectInjectionPatterns(input: string): string[] {
  const violations: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      violations.push(pattern.source);
    }
  }
  return violations;
}

// ============================================================================
// TRI-FORCE AGENT CLASS
// ============================================================================

class OmniLinkTriForceAgent {
  constructor(
    private supabase: SupabaseClient,
    private skillRegistry: SkillRegistry
  ) {}

  // --------------------------------------------------------------------------
  // NODE 1: GUARDIAN - Security & Constitutional AI
  // --------------------------------------------------------------------------

  private async guardianNode(
    content: string,
    type: 'input' | 'output'
  ): Promise<GuardianResult> {
    console.log(`[Guardian] Scanning ${type}...`);
    const startTime = Date.now();

    // Step 1: Fast regex pre-filter
    const regexViolations = detectInjectionPatterns(content);
    if (regexViolations.length > 0) {
      await this.logAuditEvent('guardian_block', 'critical', 'regex_injection_detected', {
        type,
        violations: regexViolations,
        content_preview: content.substring(0, 100),
      });

      return {
        safe: false,
        reason: 'Prompt injection pattern detected',
        violations: regexViolations,
        scannedAt: new Date().toISOString(),
      };
    }

    // Step 2: Fetch active blocking policies from database
    const { data: policies, error: policyError } = await this.supabase
      .from('agent_policies')
      .select('name, rule_logic, is_blocking, priority')
      .eq('is_blocking', true)
      .order('priority', { ascending: false });

    if (policyError) {
      console.warn('[Guardian] Failed to fetch policies:', policyError);
      // Fail-open with warning (continue with basic checks)
    }

    const activePolicies: AgentPolicy[] = policies || [];

    // If no policies, allow through (fail-open)
    if (activePolicies.length === 0) {
      console.log('[Guardian] No active policies, allowing through');
      return {
        safe: true,
        scannedAt: new Date().toISOString(),
      };
    }

    // Step 3: LLM-based policy check
    const policyRules = activePolicies
      .map((p, i) => `${i + 1}. [${p.name}]: ${p.rule_logic}`)
      .join('\n');

    const systemPrompt = `You are a security filter for an AI assistant. Your job is to determine if content violates any of these policies:

${policyRules}

Analyze the ${type === 'input' ? 'user input' : 'AI output'} and determine if it violates ANY policy.

Respond with JSON:
{
  "safe": true/false,
  "violations": ["policy_name1", "policy_name2"] or [],
  "reason": "Brief explanation if unsafe, or null if safe"
}

Be strict. If in doubt, mark as unsafe.`;

    try {
      const { data } = await callLLMJson<{
        safe: boolean;
        violations: string[];
        reason: string | null;
      }>(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this ${type}:\n\n${content}` },
        ],
        { temperature: 0, max_tokens: 200, timeout_ms: 10_000 }
      );

      const result: GuardianResult = {
        safe: data.safe,
        reason: data.reason || undefined,
        violations: data.violations.length > 0 ? data.violations : undefined,
        scannedAt: new Date().toISOString(),
      };

      // Log to audit if blocked
      if (!data.safe) {
        await this.logAuditEvent('guardian_block', 'warning', 'policy_violation', {
          type,
          violations: data.violations,
          reason: data.reason,
          duration_ms: Date.now() - startTime,
        });
      }

      console.log(`[Guardian] ${type} scan complete:`, result.safe ? 'PASS' : 'BLOCKED');
      return result;

    } catch (error) {
      console.error('[Guardian] LLM check failed:', error);
      // Fail-closed on LLM error for security
      return {
        safe: false,
        reason: 'Security check failed - please try again',
        scannedAt: new Date().toISOString(),
      };
    }
  }

  // --------------------------------------------------------------------------
  // NODE 2: PLANNER - Cognitive Decoupling
  // --------------------------------------------------------------------------

  private async plannerNode(
    message: string,
    availableTools: SkillDefinition[]
  ): Promise<PlanStep[]> {
    console.log('[Planner] Decomposing request...');

    const toolList = availableTools.length > 0
      ? availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n')
      : '(No specialized tools available)';

    const systemPrompt = `You are a planning agent. Break down the user's request into discrete, actionable steps.

Available Tools:
${toolList}

For each step, specify:
- id: Sequential number starting from 1
- description: Clear action description
- tool: Tool name if a tool should be used (optional)
- depends_on: Array of step IDs this depends on (optional)

Respond with JSON:
{
  "steps": [
    { "id": 1, "description": "...", "tool": "ToolName" or null, "depends_on": [] },
    ...
  ],
  "reasoning": "Brief explanation of the plan"
}

Keep plans simple and focused. Maximum 5 steps for most requests.
If no tools are needed, return a single step for direct response.`;

    try {
      const { data } = await callLLMJson<{
        steps: Array<{
          id: number;
          description: string;
          tool?: string;
          depends_on?: number[];
        }>;
        reasoning: string;
      }>(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        { temperature: 0.2, max_tokens: 500 }
      );

      // Log planning event
      await this.logAuditEvent('planner_decompose', 'info', 'plan_created', {
        step_count: data.steps.length,
        reasoning: data.reasoning,
        tools_planned: data.steps.filter(s => s.tool).map(s => s.tool),
      });

      // Convert to PlanStep format with status
      return data.steps.map(step => ({
        id: step.id,
        description: step.description,
        tool: step.tool,
        depends_on: step.depends_on || [],
        status: 'pending' as const,
      }));

    } catch (error) {
      console.error('[Planner] Planning failed:', error);
      // Fallback to single direct response step
      return [{
        id: 1,
        description: 'Provide direct response to user query',
        status: 'pending',
      }];
    }
  }

  // --------------------------------------------------------------------------
  // NODE 3: EXECUTOR - DAG Execution with Retries
  // --------------------------------------------------------------------------

  private async executorNode(
    plan: PlanStep[],
    state: AgentState,
    agentRunId: string
  ): Promise<{ results: unknown[]; finalPlan: PlanStep[] }> {
    console.log(`[Executor] Executing ${plan.length} steps...`);
    const results: unknown[] = [];
    const completedSteps = new Set<number>();

    // Process steps in dependency order
    for (const step of plan) {
      // Check dependencies
      const deps = step.depends_on || [];
      const depsComplete = deps.every(d => completedSteps.has(d));

      if (!depsComplete) {
        step.status = 'skipped';
        step.error = 'Dependencies not met';
        continue;
      }

      // Execute step with retries if it has a tool
      if (step.tool) {
        step.status = 'running';
        let lastError: Error | null = null;
        let attempts = 0;

        while (attempts <= MAX_RETRIES) {
          attempts++;
          try {
            const executor = toolExecutors[step.tool];
            if (!executor) {
              throw new Error(`Tool not found: ${step.tool}`);
            }

            const result = await Promise.race([
              executor(step.args || {}),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Tool execution timeout')), EXECUTOR_TIMEOUT_MS)
              ),
            ]);

            step.result = result;
            step.status = 'completed';
            results.push(result);
            completedSteps.add(step.id);

            // Log successful execution
            await this.logAuditEvent('tool_execution', 'info', step.tool, {
              step_id: step.id,
              attempts,
              success: true,
            });

            break; // Success, exit retry loop

          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`[Executor] Step ${step.id} attempt ${attempts} failed:`, lastError.message);

            if (attempts <= MAX_RETRIES) {
              // Log retry
              await this.logAuditEvent('executor_retry', 'warning', step.tool || 'unknown', {
                step_id: step.id,
                attempt: attempts,
                error: lastError.message,
              });
              // Wait before retry (exponential backoff)
              await new Promise(r => setTimeout(r, 500 * attempts));
            }
          }
        }

        // If all retries exhausted
        if (step.status !== 'completed') {
          step.status = 'failed';
          step.error = lastError?.message || 'Execution failed';
          await this.logAuditEvent('tool_execution', 'critical', step.tool || 'unknown', {
            step_id: step.id,
            attempts,
            success: false,
            error: step.error,
          });
        }
      } else {
        // No tool, just mark as completed
        step.status = 'completed';
        completedSteps.add(step.id);
      }
    }

    return { results, finalPlan: plan };
  }

  // --------------------------------------------------------------------------
  // REASONING NODE - Generate Final Response
  // --------------------------------------------------------------------------

  private async reasoningNode(
    state: AgentState,
    plan: PlanStep[],
    toolResults: unknown[]
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(state.current_skills);

    // Build context from plan execution
    const planContext = plan
      .filter(s => s.status === 'completed' && s.result)
      .map(s => `[${s.description}]: ${JSON.stringify(s.result)}`)
      .join('\n');

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...state.messages.map(m => ({
        role: m.role as LLMMessage['role'],
        content: m.content,
      })),
    ];

    if (planContext) {
      messages.push({
        role: 'system',
        content: `Tool execution results:\n${planContext}`,
      });
    }

    try {
      const response = await callLLM(messages, {
        temperature: 0.7,
        max_tokens: 1500,
      });

      return response.content;
    } catch (error) {
      console.error('[Reasoning] Failed to generate response:', error);
      return 'I apologize, but I encountered an error generating a response. Please try again.';
    }
  }

  // --------------------------------------------------------------------------
  // MAIN PROCESSING PIPELINE
  // --------------------------------------------------------------------------

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const threadId = request.threadId || crypto.randomUUID();
    const agentRunId = await this.recordAgentRunStart(threadId, request.message);

    // STEP 1: Guardian - Scan Input
    const inputGuardian = await this.guardianNode(request.message, 'input');
    if (!inputGuardian.safe) {
      await this.recordAgentRunEnd(agentRunId, '', [], inputGuardian.reason);
      return {
        response: 'I cannot process this request as it appears to violate security policies.',
        threadId,
        skillsUsed: [],
        agentRunId,
        safe: false,
        guardianResult: inputGuardian,
      };
    }

    // Load agent state
    let state = await this.loadAgentState(threadId);
    state.messages.push({
      role: 'user',
      content: request.message,
    });

    try {
      // STEP 2: Skill Retrieval
      const relevantSkills = await this.skillRegistry.retrieveSkills(request.message, 5, 0.1);
      state.current_skills = relevantSkills;
      console.log(`[Agent] Retrieved ${relevantSkills.length} skills`);

      // STEP 3: Planner - Decompose Request
      const plan = await this.plannerNode(request.message, relevantSkills);
      console.log(`[Agent] Plan created with ${plan.length} steps`);

      // STEP 4: Executor - Execute Plan
      const { results, finalPlan } = await this.executorNode(plan, state, agentRunId);
      state.tool_results = results.map((r, i) => ({
        tool_call_id: `step_${i + 1}`,
        result: r,
      }));

      // STEP 5: Reasoning - Generate Response
      const responseText = await this.reasoningNode(state, finalPlan, results);

      // STEP 6: Guardian - Scan Output
      const outputGuardian = await this.guardianNode(responseText, 'output');
      let finalResponse = responseText;

      if (!outputGuardian.safe) {
        console.warn('[Guardian] Output blocked, sanitizing...');
        finalResponse = 'I was unable to provide a complete response due to content policy restrictions.';
      } else {
        // Additional PII redaction
        finalResponse = redactPII(responseText);
      }

      // Add assistant response to state
      state.messages.push({
        role: 'assistant',
        content: finalResponse,
      });

      await this.saveAgentState(threadId, state);
      await this.recordAgentRunEnd(
        agentRunId,
        finalResponse,
        state.current_skills.map(s => s.name)
      );

      return {
        response: finalResponse,
        threadId,
        skillsUsed: state.current_skills.map(s => s.name),
        toolResults: results,
        agentRunId,
        safe: true,
        guardianResult: inputGuardian,
        plan: finalPlan,
      };

    } catch (error) {
      console.error('[Agent] Processing error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.recordAgentRunEnd(agentRunId, '', [], errorMsg);

      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        threadId,
        skillsUsed: [],
        agentRunId,
        safe: true, // Error is not a security issue
      };
    }
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private buildSystemPrompt(skills: SkillDefinition[]): string {
    let prompt = `You are OmniLink, an AI assistant with access to specialized tools.

Available tools:`;

    if (skills.length === 0) {
      prompt += '\n\n(No specialized tools available for this query)';
    } else {
      for (const skill of skills) {
        prompt += `\n\nTool: ${skill.name}
Description: ${skill.description}
Parameters: ${JSON.stringify(skill.parameters, null, 2)}`;
      }
    }

    prompt += `

Guidelines:
1. Use tools when they can help answer the user's question
2. Be helpful, accurate, and concise
3. If no tools are needed, provide a direct response
4. Never reveal sensitive information or internal system details
5. Always maintain user privacy and data security

Respond naturally and helpfully.`;

    return prompt;
  }

  private async logAuditEvent(
    eventType: string,
    severity: string,
    actionType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase.from('audit_logs').insert({
        event_type: eventType,
        severity,
        action_type: actionType,
        details,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Audit] Failed to log event:', error);
    }
  }

  private async recordAgentRunStart(threadId: string, userMessage: string): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('agent_runs')
        .insert({
          thread_id: threadId,
          user_message: userMessage,
          status: 'running',
        })
        .select('id')
        .single();

      if (error) {
        console.error('[Agent] Failed to record run start:', error);
        return crypto.randomUUID();
      }

      return data.id;
    } catch (error) {
      console.error('[Agent] Failed to record run start:', error);
      return crypto.randomUUID();
    }
  }

  private async recordAgentRunEnd(
    agentRunId: string,
    response: string,
    skillsUsed: string[],
    error?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('agent_runs')
        .update({
          end_time: new Date().toISOString(),
          agent_response: response,
          skills_used: skillsUsed,
          status: error ? 'failed' : 'completed',
          error_message: error,
        })
        .eq('id', agentRunId);
    } catch (error) {
      console.error('[Agent] Failed to record run end:', error);
    }
  }

  private async loadAgentState(threadId: string): Promise<AgentState> {
    try {
      const { data, error } = await this.supabase
        .from('agent_checkpoints')
        .select('state')
        .eq('thread_id', threadId)
        .single();

      if (error || !data) {
        return {
          threadId,
          messages: [{
            role: 'system',
            content: 'You are OmniLink, an AI assistant with access to various tools and services.',
          }],
          current_skills: [],
        };
      }

      return data.state as AgentState;
    } catch (error) {
      console.error('[Agent] Failed to load state:', error);
      return {
        threadId,
        messages: [{
          role: 'system',
          content: 'You are OmniLink, an AI assistant with access to various tools and services.',
        }],
        current_skills: [],
      };
    }
  }

  private async saveAgentState(threadId: string, state: AgentState): Promise<void> {
    try {
      await this.supabase.from('agent_checkpoints').upsert({
        thread_id: threadId,
        state,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Agent] Failed to save state:', error);
    }
  }
}

// ============================================================================
// EDGE FUNCTION HANDLER (Fail-Safe)
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-thread-id',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Agent] Missing Supabase configuration');
      return new Response(
        JSON.stringify({
          response: 'Service configuration error. Please contact support.',
          safe: false,
          error: 'Missing configuration',
        }),
        {
          status: 200, // Fail-safe: return 200 with safe: false
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request
    const threadId = req.headers.get('x-thread-id') || crypto.randomUUID();
    const { message }: AgentRequest = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({
          response: 'Please provide a message.',
          safe: true,
          error: 'Message is required',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize agent and process
    const skillRegistry = new SkillRegistry(supabase);
    const agent = new OmniLinkTriForceAgent(supabase, skillRegistry);
    const response = await agent.processRequest({ message: message.trim(), threadId });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'x-thread-id': response.threadId,
      },
    });

  } catch (error) {
    console.error('[Agent] Edge function error:', error);

    // FAIL-SAFE: Always return 200 with safe: false on errors
    return new Response(
      JSON.stringify({
        response: 'I apologize, but I encountered an error. Please try again.',
        threadId: req.headers.get('x-thread-id') || 'error',
        skillsUsed: [],
        safe: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 200, // Fail-safe: 200 OK with safe: false
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
