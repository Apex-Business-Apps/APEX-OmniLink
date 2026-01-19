export type ScenarioMode = 'mock' | 'sandbox';

export type StepAction =
  | 'send_command'
  | 'emit_event'
  | 'verify_audit'
  | 'mint_nft'
  | 'send_email'
  | 'create_doc'
  | 'wildcard_injection'
  | 'verify_entities'
  | 'report_back';

export interface ScenarioIntegrationSet {
  web2: string[];
  web3: string[];
  llm: string[];
  japanMarket?: string[];
}

export interface ScenarioStep {
  id: string;
  action: StepAction;
  target: string;
  content?: string;
  payload?: string;
  retries?: number;
}

export interface ScenarioAssertion {
  type:
    | 'orchestration_status'
    | 'audit_contains'
    | 'entities_updated'
    | 'nft_verification_recorded'
    | 'injection_blocked'
    | 'no_secret_leak';
  expected: string | boolean | string[];
}

export interface ScenarioDefinition {
  name: string;
  version: string;
  locale: string;
  deviceProfile: string;
  environment: ScenarioMode;
  integrations: ScenarioIntegrationSet;
  steps: ScenarioStep[];
  assertions: ScenarioAssertion[];
}

export interface StepResult {
  id: string;
  action: StepAction;
  status: 'passed' | 'failed' | 'blocked';
  durationMs: number;
  retries: number;
  details?: string;
}

export interface ScenarioMetrics {
  p50Ms: number;
  p95Ms: number;
  retryCount: number;
  errorRate: number;
  finalScore: number;
}

export interface ScenarioRunResult {
  scenario: ScenarioDefinition;
  status: 'passed' | 'failed' | 'blocked';
  steps: StepResult[];
  assertions: Record<string, boolean>;
  auditLog: string[];
  metrics: ScenarioMetrics;
  startedAt: string;
  finishedAt: string;
  notes?: string[];
}

export interface ReportBundle {
  summary: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    score: number;
  };
  results: ScenarioRunResult[];
  generatedAt: string;
}

export interface RunnerOptions {
  mode: ScenarioMode;
  scenarioDir: string;
  reportDir: string;
  omnilinkPortUrl?: string;
}
