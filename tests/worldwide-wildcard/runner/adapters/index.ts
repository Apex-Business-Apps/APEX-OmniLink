import type { ScenarioMode, ScenarioStep } from '../types';

export interface AdapterResult {
  status: 'passed' | 'failed' | 'blocked';
  details?: string;
}

export interface AdapterContext {
  mode: ScenarioMode;
  omnilinkPortUrl?: string;
  auditLog: string[];
  injectionDetected: boolean;
}

async function emitToOmniLink(
  omnilinkPortUrl: string,
  endpoint: string,
  payload: Record<string, unknown>
): Promise<void> {
  const url = new URL(endpoint, omnilinkPortUrl).toString();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OmniLink port call failed (${response.status}): ${text}`);
  }
}

export async function runAdapterStep(
  step: ScenarioStep,
  context: AdapterContext
): Promise<AdapterResult> {
  if (context.injectionDetected && step.action !== 'verify_audit') {
    return {
      status: 'blocked',
      details: 'Wildcard injection detected; step blocked by guardrails.',
    };
  }

  if (context.mode === 'sandbox') {
    if (!context.omnilinkPortUrl) {
      return {
        status: 'failed',
        details: 'OMNILINK_PORT_URL is required for sandbox mode.',
      };
    }

    if (['send_command', 'create_doc', 'mint_nft'].includes(step.action)) {
      await emitToOmniLink(context.omnilinkPortUrl, '/commands', {
        id: step.id,
        action: step.action,
        target: step.target,
        content: step.content,
      });
    }

    if (['emit_event', 'report_back', 'send_email'].includes(step.action)) {
      await emitToOmniLink(context.omnilinkPortUrl, '/events', {
        id: step.id,
        action: step.action,
        target: step.target,
        payload: step.content,
      });
    }

    if (step.action === 'verify_audit') {
      await emitToOmniLink(context.omnilinkPortUrl, '/workflows', {
        id: step.id,
        action: step.action,
        target: step.target,
      });
    }
  }

  return { status: 'passed' };
}
