import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { runAdapterStep } from './adapters/index';
import { enforceSandboxGuardrails } from './guards/guardrails';
import { writeJsonReport } from './reporters/json';
import { writeJUnitReport } from './reporters/junit';
import { writeMarkdownReport } from './reporters/markdown';
import type {
  ReportBundle,
  RunnerOptions,
  ScenarioDefinition,
  ScenarioRunResult,
  ScenarioStep,
  StepResult,
} from './types';

function parseScenario(content: string): ScenarioDefinition {
  const parsed = yaml.load(content) as ScenarioDefinition;
  if (!parsed?.name || !parsed?.steps || !parsed?.assertions) {
    throw new Error('Invalid scenario definition.');
  }
  return parsed;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[index];
}

function computeScore(errorRate: number, retryCount: number): number {
  const score = 100 - errorRate * 100 - retryCount * 2;
  return Math.max(0, Math.min(100, score));
}

async function executeStep(
  step: ScenarioStep,
  auditLog: string[],
  mode: RunnerOptions['mode'],
  omnilinkPortUrl?: string,
  injectionDetected = false
): Promise<{ result: StepResult; injectionDetected: boolean }> {
  const start = Date.now();
  let status: StepResult['status'] = 'passed';
  let details: string | undefined;
  let updatedInjection = injectionDetected;

  if (step.action === 'wildcard_injection') {
    updatedInjection = true;
    status = 'passed';
    details = 'Wildcard payload injected.';
  } else {
    const adapterResult = await runAdapterStep(step, {
      mode,
      omnilinkPortUrl,
      auditLog,
      injectionDetected,
    });
    status = adapterResult.status;
    details = adapterResult.details;
  }

  auditLog.push(step.action);
  const durationMs = Date.now() - start;
  const retries = step.retries ?? 0;

  return {
    result: {
      id: step.id,
      action: step.action,
      status,
      durationMs,
      retries,
      details,
    },
    injectionDetected: updatedInjection,
  };
}

function evaluateAssertions(
  scenario: ScenarioDefinition,
  stepResults: StepResult[],
  auditLog: string[],
  injectionDetected: boolean
): Record<string, boolean> {
  const status = stepResults.some(result => result.status === 'failed')
    ? 'failed'
    : stepResults.some(result => result.status === 'blocked')
      ? 'blocked'
      : 'passed';

  const assertions: Record<string, boolean> = {};
  for (const assertion of scenario.assertions) {
    switch (assertion.type) {
      case 'orchestration_status':
        assertions[assertion.type] = assertion.expected === status;
        break;
      case 'audit_contains':
        assertions[assertion.type] =
          Array.isArray(assertion.expected) &&
          assertion.expected.every(expected => auditLog.includes(expected));
        break;
      case 'entities_updated':
        assertions[assertion.type] = stepResults.some(result => result.action === 'verify_entities');
        break;
      case 'nft_verification_recorded':
        assertions[assertion.type] = stepResults.some(result => result.action === 'mint_nft');
        break;
      case 'injection_blocked':
        assertions[assertion.type] = injectionDetected && status !== 'passed';
        break;
      case 'no_secret_leak':
        assertions[assertion.type] = !auditLog.some(entry => entry.toLowerCase().includes('secret'));
        break;
      default:
        assertions[assertion.type] = false;
    }
  }

  return assertions;
}

export async function runScenario(
  scenario: ScenarioDefinition,
  options: RunnerOptions
): Promise<ScenarioRunResult> {
  const startedAt = new Date().toISOString();
  if (options.mode === 'sandbox') {
    enforceSandboxGuardrails(options.omnilinkPortUrl);
  }

  const auditLog: string[] = [];
  const steps: StepResult[] = [];
  let injectionDetected = false;

  for (const step of scenario.steps) {
    const result = await executeStep(
      step,
      auditLog,
      options.mode,
      options.omnilinkPortUrl,
      injectionDetected
    );
    steps.push(result.result);
    injectionDetected = result.injectionDetected;
  }

  const assertions = evaluateAssertions(scenario, steps, auditLog, injectionDetected);
  const failedAssertions = Object.values(assertions).filter(Boolean).length !== scenario.assertions.length;
  const status = steps.some(step => step.status === 'failed')
    ? 'failed'
    : steps.some(step => step.status === 'blocked')
      ? 'blocked'
      : failedAssertions
        ? 'failed'
        : 'passed';

  const durations = steps.map(step => step.durationMs);
  const retryCount = steps.reduce((sum, step) => sum + step.retries, 0);
  const errorRate = steps.length === 0
    ? 0
    : steps.filter(step => step.status !== 'passed').length / steps.length;
  const metrics = {
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    retryCount,
    errorRate,
    finalScore: computeScore(errorRate, retryCount),
  };

  return {
    scenario,
    status,
    steps,
    assertions,
    auditLog,
    metrics,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

async function loadScenarios(scenarioDir: string): Promise<ScenarioDefinition[]> {
  const files = await readdir(scenarioDir);
  const scenarios: ScenarioDefinition[] = [];

  for (const file of files) {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
    const content = await readFile(path.join(scenarioDir, file), 'utf8');
    scenarios.push(parseScenario(content));
  }

  return scenarios;
}

export async function runWWWCT(options: RunnerOptions): Promise<ReportBundle> {
  const scenarios = await loadScenarios(options.scenarioDir);
  await mkdir(options.reportDir, { recursive: true });

  const results: ScenarioRunResult[] = [];
  for (const scenario of scenarios) {
    const result = await runScenario(scenario, options);
    results.push(result);
  }

  const summary = {
    total: results.length,
    passed: results.filter(result => result.status === 'passed').length,
    failed: results.filter(result => result.status === 'failed').length,
    blocked: results.filter(result => result.status === 'blocked').length,
    score:
      results.length === 0
        ? 0
        : results.reduce((sum, result) => sum + result.metrics.finalScore, 0) / results.length,
  };

  const report: ReportBundle = {
    summary,
    results,
    generatedAt: new Date().toISOString(),
  };

  await writeJsonReport(options.reportDir, report);
  await writeJUnitReport(options.reportDir, report);
  await writeMarkdownReport(options.reportDir, report);

  return report;
}
