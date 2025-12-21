// Shared types for OmniLink Agentic RAG system

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