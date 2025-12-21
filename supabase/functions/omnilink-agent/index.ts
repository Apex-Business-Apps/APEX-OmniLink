import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SkillRegistry } from '../_shared/skill-loader.ts';
import { AgentState, SkillDefinition, ToolExecutionResult } from '../_shared/types.ts';

interface AgentRequest {
  message: string;
  threadId?: string;
}

interface AgentResponse {
  response: string;
  threadId: string;
  skillsUsed: string[];
  toolResults?: any[];
  agentRunId?: string;
}

// Prompt injection patterns to detect and block
const INJECTION_PATTERNS = [
  /system message/i,
  /admin override/i,
  /developer mode/i,
  /ignore previous/i,
  /override instructions/i,
  /bypass security/i,
  /jailbreak/i,
  /dan mode/i,
  /uncensored/i
];

// Tool executors registry
const toolExecutors: Record<string, (args: any) => Promise<any>> = {
  // Example tool executor - replace with actual implementations
  CheckCreditScore: async (args: { userId: string }) => {
    // Mock implementation - replace with actual credit score checking logic
    console.log(`Checking credit score for user: ${args.userId}`);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock response with PII redaction
    return {
      creditScore: 750,
      riskLevel: 'low',
      lastUpdated: new Date().toISOString(),
      // Note: Never return actual PII like SSN, full names, etc.
    };
  }
};

function sanitizeInput(input: string): string {
  // Remove or flag potential prompt injection attempts
  let sanitized = input;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      console.warn('Potential prompt injection detected:', input.substring(0, 100));
      // Replace suspicious content with safe placeholder
      sanitized = sanitized.replace(pattern, '[FILTERED]');
    }
  }

  return sanitized.trim();
}

function redactPII(text: string): string {
  // Basic PII redaction patterns (expand as needed)
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REDACTED]')  // SSN
    .replace(/\b\d{16}\b/g, '[CARD REDACTED]')  // Credit card
    .replace(/\b\d{10}\b/g, '[PHONE REDACTED]')  // Phone
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REDACTED]'); // Email
}

class OmniLinkAgent {
  private supabase: SupabaseClient;
  private skillRegistry: SkillRegistry;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.skillRegistry = new SkillRegistry(supabase);
  }

  // Telemetry recording methods
  private async recordAgentRunStart(threadId: string, userMessage: string): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('agent_runs')
        .insert({
          thread_id: threadId,
          user_message: userMessage,
          status: 'running'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to record agent run start:', error);
        return crypto.randomUUID(); // Fallback ID
      }

      return data.id;
    } catch (error) {
      console.error('Failed to record agent run start:', error);
      return crypto.randomUUID(); // Fallback ID
    }
  }

  private async recordAgentRunEnd(agentRunId: string, response: string, skillsUsed: string[], error?: string): Promise<void> {
    try {
      const endTime = new Date().toISOString();
      const status = error ? 'failed' : 'completed';

      await this.supabase
        .from('agent_runs')
        .update({
          end_time: endTime,
          agent_response: response,
          skills_used: skillsUsed,
          status: status,
          error_message: error,
          total_duration_ms: 0 // Would need to calculate from start time
        })
        .eq('id', agentRunId);
    } catch (error) {
      console.error('Failed to record agent run end:', error);
    }
  }

  private async recordSkillMatches(agentRunId: string, query: string, matches: any[]): Promise<void> {
    try {
      const skillMatchRecords = matches.map((match, index) => ({
        agent_run_id: agentRunId,
        query_text: query,
        skill_name: match.name,
        score: match.score,
        rank: index + 1,
        search_type: 'hybrid', // Assuming hybrid search
        final_score: match.score
      }));

      if (skillMatchRecords.length > 0) {
        await this.supabase
          .from('skill_matches')
          .insert(skillMatchRecords);
      }
    } catch (error) {
      console.error('Failed to record skill matches:', error);
    }
  }

  private async recordToolInvocation(agentRunId: string, skillMatchId: string | null, toolName: string, args: any, result: any, error?: string): Promise<void> {
    try {
      const startTime = new Date();
      const endTime = new Date();

      await this.supabase
        .from('tool_invocations')
        .insert({
          agent_run_id: agentRunId,
          skill_match_id: skillMatchId,
          tool_name: toolName,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_ms: endTime.getTime() - startTime.getTime(),
          status: error ? 'failed' : 'completed',
          input_args: args,
          output_result: result,
          error_message: error
        });
    } catch (error) {
      console.error('Failed to record tool invocation:', error);
    }
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const threadId = request.threadId || crypto.randomUUID();
    const sanitizedMessage = sanitizeInput(request.message);

    // Record agent run start
    const agentRunId = await this.recordAgentRunStart(threadId, sanitizedMessage);

    // Load or initialize agent state
    let state = await this.loadAgentState(threadId);

    // Add user message to conversation
    state.messages.push({
      role: 'user',
      content: sanitizedMessage
    });

    try {
      // Phase 1: Skill Retrieval Node
      const skillMatches = await this.skillRetrievalNode(state, sanitizedMessage);

      // Record skill matches in telemetry
      await this.recordSkillMatches(agentRunId, sanitizedMessage, skillMatches);

      // Phase 2: Agent Reasoning Node
      const response = await this.agentReasoningNode(state);

      // Phase 3: Tool Execution Node (if tools were called)
      if (response.toolCalls && response.toolCalls.length > 0) {
        await this.toolExecutionNode(state, response.toolCalls, agentRunId);
        // Re-run reasoning with tool results
        const finalResponse = await this.agentReasoningNode(state);
        await this.saveAgentState(threadId, state);

        const finalResponseText = redactPII(finalResponse.content);
        await this.recordAgentRunEnd(agentRunId, finalResponseText, state.current_skills.map(s => s.name));

        return {
          response: finalResponseText,
          threadId,
          skillsUsed: state.current_skills.map(s => s.name),
          toolResults: state.tool_results,
          agentRunId
        };
      }

      await this.saveAgentState(threadId, state);
      const responseText = redactPII(response.content);
      await this.recordAgentRunEnd(agentRunId, responseText, state.current_skills.map(s => s.name));

      return {
        response: responseText,
        threadId,
        skillsUsed: state.current_skills.map(s => s.name),
        agentRunId
      };

    } catch (error) {
      console.error('Agent processing error:', error);
      // Record failed run
      await this.recordAgentRunEnd(agentRunId, '', [], error.message);

      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        threadId,
        skillsUsed: [],
        agentRunId
      };
    }
  }

  private async skillRetrievalNode(state: AgentState, userMessage: string): Promise<any[]> {
    try {
      // Retrieve relevant skills based on user message
      const relevantSkills = await this.skillRegistry.retrieveSkills(userMessage, 5, 0.1);
      state.current_skills = relevantSkills;
      console.log(`Retrieved ${relevantSkills.length} skills for query: ${userMessage}`);

      // Return skill matches for telemetry (simplified version)
      return relevantSkills.map((skill, index) => ({
        name: skill.name,
        score: 1.0 - (index * 0.1) // Mock score for telemetry
      }));
    } catch (error) {
      console.error('Skill retrieval failed:', error);
      state.current_skills = []; // Fallback to no skills
      return [];
    }
  }

  private async agentReasoningNode(state: AgentState): Promise<{ content: string; toolCalls?: any[] }> {
    // Prepare system prompt with available skills
    const systemPrompt = this.buildSystemPrompt(state.current_skills);

    // Call LLM (using Supabase AI or external provider)
    // For now, using a mock implementation - replace with actual LLM call
    const llmResponse = await this.callLLM(systemPrompt, state.messages);

    // Parse response for tool calls or direct response
    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      // Add assistant message with tool calls
      state.messages.push({
        role: 'assistant',
        content: llmResponse.content || '',
        tool_calls: llmResponse.tool_calls
      });
      return { content: llmResponse.content || '', toolCalls: llmResponse.tool_calls };
    } else {
      // Direct response
      state.messages.push({
        role: 'assistant',
        content: llmResponse.content
      });
      return { content: llmResponse.content };
    }
  }

  private async toolExecutionNode(state: AgentState, toolCalls: any[], agentRunId: string): Promise<void> {
    const toolResults: any[] = [];

    for (const toolCall of toolCalls) {
      try {
        const executor = toolExecutors[toolCall.function.name];
        if (!executor) {
          console.warn(`No executor found for tool: ${toolCall.function.name}`);
          toolResults.push({
            tool_call_id: toolCall.id,
            error: `Tool ${toolCall.function.name} not available`
          });
          continue;
        }

        const args = JSON.parse(toolCall.function.arguments);
        const result = await executor(args);

        toolResults.push({
          tool_call_id: toolCall.id,
          result: result
        });

        // Record tool invocation telemetry
        await this.recordToolInvocation(agentRunId, null, toolCall.function.name, args, result);

        // Add tool result to conversation
        state.messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id
        });

      } catch (error) {
        console.error(`Tool execution failed for ${toolCall.function.name}:`, error);
        toolResults.push({
          tool_call_id: toolCall.id,
          error: `Execution failed: ${error.message}`
        });

        // Record failed tool invocation telemetry
        await this.recordToolInvocation(agentRunId, null, toolCall.function.name, JSON.parse(toolCall.function.arguments), null, error.message);

        // Add error result to conversation
        state.messages.push({
          role: 'tool',
          content: `Error: ${error.message}`,
          tool_call_id: toolCall.id
        });
      }
    }

    state.tool_results = toolResults;
  }

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
2. Be helpful and accurate
3. If no tools are needed, provide a direct response
4. Always maintain security and never reveal sensitive information

Respond naturally to the user. If using tools, explain what you're doing.`;

    return prompt;
  }

  private async callLLM(systemPrompt: string, messages: any[]): Promise<any> {
    // Mock LLM implementation - replace with actual LLM integration
    // This should be replaced with actual OpenAI/Anthropic/Supabase AI call

    const lastMessage = messages[messages.length - 1];

    // Simple mock logic: if message contains "credit", call credit check tool
    if (lastMessage.content.toLowerCase().includes('credit') &&
        messages.some(m => m.role === 'system' && m.content.includes('CheckCreditScore'))) {

      return {
        content: "I'll check your credit score for you.",
        tool_calls: [{
          id: 'call_' + Date.now(),
          type: 'function',
          function: {
            name: 'CheckCreditScore',
            arguments: JSON.stringify({ userId: 'current_user' })
          }
        }]
      };
    }

    return {
      content: "I understand your request. Let me help you with that information."
    };
  }

  private async loadAgentState(threadId: string): Promise<AgentState> {
    try {
      const { data, error } = await this.supabase
        .from('agent_checkpoints')
        .select('state')
        .eq('thread_id', threadId)
        .single();

      if (error || !data) {
        // Initialize new state
        return {
          threadId,
          messages: [{
            role: 'system',
            content: 'You are OmniLink, an AI assistant with access to various tools and services.'
          }],
          current_skills: []
        };
      }

      return data.state as AgentState;
    } catch (error) {
      console.error('Failed to load agent state:', error);
      // Return fresh state on error
      return {
        threadId,
        messages: [{
          role: 'system',
          content: 'You are OmniLink, an AI assistant with access to various tools and services.'
        }],
        current_skills: []
      };
    }
  }

  private async saveAgentState(threadId: string, state: AgentState): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('agent_checkpoints')
        .upsert({
          thread_id: threadId,
          state: state,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to save agent state:', error);
      }
    } catch (error) {
      console.error('Failed to save agent state:', error);
    }
  }
}

// Edge Function handler
Deno.serve(async (req: Request) => {
  try {
    // Initialize Supabase client with service role for backend operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get thread ID from header or generate new one
    const threadId = req.headers.get('x-thread-id') || crypto.randomUUID();

    // Parse request body
    const { message }: AgentRequest = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize agent and process request
    const agent = new OmniLinkAgent(supabase);
    const response = await agent.processRequest({ message, threadId });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'x-thread-id': response.threadId
      }
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      response: 'I apologize, but I encountered an error. Please try again.',
      threadId: req.headers.get('x-thread-id') || 'error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});