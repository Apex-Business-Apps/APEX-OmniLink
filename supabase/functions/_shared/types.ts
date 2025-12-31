// Shared types for OmniLink Agentic RAG system
// Extended for APEX ASCENSION Tri-Force Architecture

export type JsonSchema = {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: any;
};

export type SkillDefinition = {
  name: string;
  description: string;
  parameters: JsonSchema;
  metadata?: Record<string, any>;
};

export type AgentState = {
  threadId: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  }>;
  current_skills: SkillDefinition[];
  tool_results?: Array<{
    tool_call_id: string;
    result: any;
    error?: string;
  }>;
};

export type ToolExecutionResult = {
  success: boolean;
  result?: any;
  error?: string;
};

export type SkillMatch = {
  id: string;
  name: string;
  description: string;
  tool_definition: JsonSchema;
  metadata: Record<string, any>;
  score: number;
};

// ============================================================================
// APEX ASCENSION: Tri-Force Architecture Types
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

export interface GuardianResult {
  safe: boolean;
  reason?: string;
  violations?: string[];
  scannedAt: string;
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

export interface AgentPolicy {
  id?: string;
  name: string;
  rule_logic: string;
  description?: string;
  is_blocking: boolean;
  priority: number;
  created_at?: string;
  updated_at?: string;
}