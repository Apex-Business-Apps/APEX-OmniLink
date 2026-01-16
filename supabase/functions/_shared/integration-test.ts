/**
 * Shared utilities for integration testing
 * Reduces duplication across integration test functions
 */

export interface IntegrationConfig {
  apiKey?: string;
  webhookUrl?: string;
  [key: string]: unknown;
}

export interface TestResult {
  connected: boolean;
  message: string;
  details?: Record<string, unknown> | null;
}

interface ApiTestOptions {
  url: string;
  headers: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: unknown;
}

/**
 * Validates that a required config key exists
 */
export function validateConfigKey(
  config: IntegrationConfig,
  key: keyof IntegrationConfig,
  errorMessage: string
): TestResult | null {
  if (!config[key]) {
    return { connected: false, message: errorMessage };
  }
  return null;
}

/**
 * Makes an API test request and returns a standardized result
 */
export async function testApiConnection(
  options: ApiTestOptions,
  onSuccess: (data: unknown, response: Response) => TestResult,
  onFailure?: (data: unknown) => string
): Promise<TestResult> {
  const { url, headers, method = 'GET', body } = options;

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && method === 'POST') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json();

  if (response.ok) {
    return onSuccess(data, response);
  }

  return {
    connected: false,
    message: onFailure ? onFailure(data) : 'Authentication failed',
  };
}

/**
 * Builds an authorization header for Bearer token
 */
export function buildBearerAuth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Builds an authorization header for token-based auth (e.g., GitHub)
 */
export function buildTokenAuth(token: string): Record<string, string> {
  return { Authorization: `token ${token}` };
}
