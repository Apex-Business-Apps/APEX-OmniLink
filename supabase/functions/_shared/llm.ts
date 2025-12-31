/**
 * Shared LLM Utility Module for OmniLink APEX
 * Provides standardized OpenAI API integration with:
 * - JSON structured output mode
 * - Automatic model fallback
 * - Timeout handling
 * - Tool/Function calling support
 */

// Types for LLM interactions
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMResponse {
  content: string;
  tool_calls?: ToolCall[];
  finish_reason: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  json_mode?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  timeout_ms?: number;
}

// Default configuration
const DEFAULT_MODEL = 'gpt-4o-2024-08-06';
const FALLBACK_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Make a completion request to the OpenAI API
 */
export async function callLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const openAIKey = Deno.env.get('OPENAI_API_KEY');

  if (!openAIKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const {
    model = DEFAULT_MODEL,
    temperature = 0.2,
    max_tokens = DEFAULT_MAX_TOKENS,
    json_mode = false,
    tools,
    tool_choice,
    timeout_ms = DEFAULT_TIMEOUT_MS,
  } = options;

  // Build request body
  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_completion_tokens: max_tokens,
  };

  if (json_mode) {
    requestBody.response_format = { type: 'json_object' };
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    if (tool_choice) {
      requestBody.tool_choice = tool_choice;
    }
  }

  // Set up timeout controller
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeout_ms);

  try {
    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    // Handle model fallback on 404
    if (!response.ok && response.status === 404 && model !== FALLBACK_MODEL) {
      console.warn(`[LLM] Model ${model} not found, falling back to ${FALLBACK_MODEL}`);
      requestBody.model = FALLBACK_MODEL;
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM] API error:', errorText);
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content || '',
      tool_calls: choice.message.tool_calls,
      finish_reason: choice.finish_reason,
      usage: data.usage,
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`LLM request timed out after ${timeout_ms}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Make a JSON-structured completion request
 * Automatically parses the response as JSON
 */
export async function callLLMJson<T = unknown>(
  messages: LLMMessage[],
  options: Omit<LLMOptions, 'json_mode'> = {}
): Promise<{ data: T; usage?: LLMResponse['usage'] }> {
  const response = await callLLM(messages, {
    ...options,
    json_mode: true,
    temperature: options.temperature ?? 0.1, // Lower temp for JSON
  });

  try {
    const data = JSON.parse(response.content) as T;
    return { data, usage: response.usage };
  } catch (e) {
    console.error('[LLM] Failed to parse JSON response:', response.content);
    throw new Error('LLM returned invalid JSON');
  }
}

/**
 * Simple yes/no classification call with low temperature
 */
export async function classifyYesNo(
  systemPrompt: string,
  content: string
): Promise<{ answer: boolean; reason?: string }> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `${systemPrompt}\n\nRespond with JSON: {"answer": true/false, "reason": "brief explanation"}`
    },
    {
      role: 'user',
      content
    }
  ];

  const { data } = await callLLMJson<{ answer: boolean; reason?: string }>(messages, {
    temperature: 0,
    max_tokens: 150,
  });

  return data;
}

/**
 * Extract structured data from unstructured text
 */
export async function extractStructured<T>(
  systemPrompt: string,
  content: string,
  schema: Record<string, unknown>
): Promise<T> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `${systemPrompt}\n\nExtract information according to this JSON schema:\n${JSON.stringify(schema, null, 2)}`
    },
    {
      role: 'user',
      content
    }
  ];

  const { data } = await callLLMJson<T>(messages, {
    temperature: 0.1,
  });

  return data;
}
