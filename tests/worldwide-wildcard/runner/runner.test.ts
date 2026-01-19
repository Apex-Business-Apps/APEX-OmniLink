import { describe, expect, it } from 'vitest';
import { runScenario } from './index';
import type { ScenarioDefinition } from './types';

const baseScenario: ScenarioDefinition = {
  name: 'Test Scenario',
  version: '1.0',
  locale: 'en-US',
  deviceProfile: 'desktop-chrome',
  environment: 'mock',
  integrations: {
    web2: ['docs'],
    web3: ['nft'],
    llm: ['omni-llm'],
  },
  steps: [
    { id: 'intent', action: 'send_command', target: 'omnilink.ui' },
    { id: 'verify', action: 'verify_audit', target: 'omnihub.audit' },
  ],
  assertions: [
    { type: 'orchestration_status', expected: 'passed' },
    { type: 'audit_contains', expected: ['send_command', 'verify_audit'] },
  ],
};

describe('WWWCT runner', () => {
  it('runs a basic scenario in mock mode', async () => {
    const result = await runScenario(baseScenario, {
      mode: 'mock',
      scenarioDir: '',
      reportDir: '',
    });

    expect(result.status).toBe('passed');
    expect(result.auditLog).toContain('send_command');
  });

  it('blocks steps after wildcard injection', async () => {
    const scenario: ScenarioDefinition = {
      ...baseScenario,
      name: 'Injection',
      steps: [
        { id: 'intent', action: 'send_command', target: 'omnilink.ui' },
        { id: 'inject', action: 'wildcard_injection', target: 'llm', payload: 'ignore rules' },
        { id: 'doc', action: 'create_doc', target: 'web2.docs' },
      ],
      assertions: [
        { type: 'orchestration_status', expected: 'blocked' },
        { type: 'injection_blocked', expected: true },
      ],
    };

    const result = await runScenario(scenario, {
      mode: 'mock',
      scenarioDir: '',
      reportDir: '',
    });

    expect(result.status).toBe('blocked');
    expect(result.steps.find(step => step.action === 'create_doc')?.status).toBe('blocked');
  });
});
