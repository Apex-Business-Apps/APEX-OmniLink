/**
 * MAESTRO Execution Adapter
 *
 * Single-port entry point for ExecutionIntent processing.
 * Implements fail-closed execution with dependency injection for testing.
 */

import type { CryptoProvider } from './crypto';
import type {
  ExecutionIntent,
  ExecutionResult,
} from './orchestrator';

/**
 * Receipt claimer interface for idempotency
 */
export interface ReceiptClaimer {
  claim(idempotencyKey: string): Promise<{ claimed: boolean }>;
}

/**
 * Risk event sink interface for logging
 */
export interface RiskEventSink {
  log(message: string, context: Record<string, unknown>): void;
}

/**
 * MAN mode escalator interface
 */
export interface ManModeEscalator {
  escalate(intent: ExecutionIntent): Promise<{ id: string }>;
}

/**
 * Action executor interface
 */
export interface ActionExecutor {
  execute(
    actionType: string,
    objectId: string,
    params: Record<string, unknown>
  ): Promise<unknown>;
}

/**
 * Console-based risk event sink (default for tests)
 */
class ConsoleRiskSink implements RiskEventSink {
  log(message: string, context: Record<string, unknown>): void {
    console.error('[MAESTRO RISK]', message, context);
  }
}

/**
 * Console-based MAN mode escalator warning
 */
class ConsoleManMode implements ManModeEscalator {
  async escalate(intent: ExecutionIntent): Promise<{ id: string }> {
    console.warn(
      '[MAESTRO] Escalating to MAN mode:',
      'RED risk lane requires human approval',
      { intent: intent.trace_id }
    );
    return { id: 'pending' };
  }
}

/**
 * HTTP-based receipt claimer (production)
 */
class HttpReceiptClaimer implements ReceiptClaimer {
  constructor(private syncUrl: string) {}

  async claim(idempotencyKey: string): Promise<{ claimed: boolean }> {
    const response = await fetch(`${this.syncUrl}/receipt/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotency_key: idempotencyKey }),
    });

    if (!response.ok) {
      throw new Error('Receipt claim failed');
    }

    return response.json();
  }
}

/**
 * HTTP-based MAN mode escalator (production)
 */
class HttpManMode implements ManModeEscalator {
  constructor(private manModeUrl: string) {}

  async escalate(intent: ExecutionIntent): Promise<{ id: string }> {
    // Log escalation (for observability)
    console.warn(
      '[MAESTRO] Escalating to MAN mode:',
      'RED risk lane requires human approval',
      { intent: intent.trace_id }
    );

    const response = await fetch(this.manModeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intent),
    });

    if (!response.ok) {
      throw new Error('MAN mode escalation failed');
    }

    return response.json();
  }
}

/**
 * Default action executor (mock implementation)
 */
class DefaultActionExecutor implements ActionExecutor {
  async execute(
    actionType: string,
    objectId: string,
    _params: Record<string, unknown>
  ): Promise<unknown> {
    return {
      executed: true,
      action: actionType,
      object: objectId,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Allowlisted actions (email.send is the only allowed action for tests)
 */
const ALLOWLISTED_ACTIONS = new Set(['email.send']);

/**
 * MAESTRO Execution Adapter
 *
 * Implements fail-closed execution with full validation:
 * - Idempotency via receipt claiming
 * - Injection defense via allowlisting
 * - Risk lane routing (GREEN/YELLOW/RED/BLOCKED)
 * - Translation status validation
 * - Confidence threshold enforcement (>= 0.7)
 * - User confirmation requirement
 * - BCP-47 locale validation
 * - MAN mode escalation for RED lane
 * - Fail-closed on errors
 */
export class MaestroExecutionAdapter {
  private receiptClaimer: ReceiptClaimer;
  private riskSink: RiskEventSink;
  private manMode: ManModeEscalator;
  private executor: ActionExecutor;
  private syncUrl: string;
  private manModeUrl: string;

  constructor(
    crypto: CryptoProvider | null,
    syncUrl: string,
    manModeUrl?: string,
    options?: {
      receiptClaimer?: ReceiptClaimer;
      riskSink?: RiskEventSink;
      manMode?: ManModeEscalator;
      executor?: ActionExecutor;
    }
  ) {
    this.syncUrl = syncUrl;
    this.manModeUrl = manModeUrl || '';

    // Use injected dependencies or defaults
    this.receiptClaimer =
      options?.receiptClaimer || new HttpReceiptClaimer(syncUrl);
    this.riskSink = options?.riskSink || new ConsoleRiskSink();
    this.manMode =
      options?.manMode ||
      (manModeUrl
        ? new HttpManMode(manModeUrl)
        : new ConsoleManMode());
    this.executor = options?.executor || new DefaultActionExecutor();
  }

  /**
   * Main execution entry point
   *
   * Enforces fail-closed semantics:
   * 1. Validate intent structure and fields
   * 2. Check translation status
   * 3. Check confidence threshold
   * 4. Check user confirmation
   * 5. Route by risk lane
   * 6. Claim receipt (idempotency)
   * 7. Execute allowlisted action OR escalate to MAN mode
   *
   * Returns failure if any validation fails or receipt claim fails.
   */
  async executeExecutionIntent(
    intent: unknown
  ): Promise<ExecutionResult> {
    // 1. Validate required identity fields
    const validationError = this.validateRequiredFields(intent);
    if (validationError) {
      this.riskSink.log(validationError, { intent: 'unknown' });
      return {
        success: false,
        error: validationError,
      };
    }

    const typedIntent = intent as ExecutionIntent;

    // 2. Validate locale format (BCP-47)
    if (!this.isValidBCP47Locale(typedIntent.locale)) {
      this.riskSink.log('Invalid locale format', {
        intent: typedIntent.trace_id,
        locale: typedIntent.locale,
      });
      return {
        success: false,
        error: 'Invalid locale format (expected BCP-47)',
      };
    }

    // 3. Validate confidence range
    if (
      typedIntent.confidence < 0 ||
      typedIntent.confidence > 1
    ) {
      this.riskSink.log('Invalid confidence range', {
        intent: typedIntent.trace_id,
        confidence: typedIntent.confidence,
      });
      return {
        success: false,
        error: 'Confidence must be between 0 and 1',
      };
    }

    // 4. Check translation status
    if (typedIntent.translation_status === 'FAILED') {
      this.riskSink.log('Translation failed', {
        intent: typedIntent.trace_id,
      });
      return {
        success: false,
        error: 'Translation failed',
      };
    }

    // 5. Check confidence threshold (>= 0.7)
    if (typedIntent.confidence < 0.7) {
      this.riskSink.log('Confidence below threshold', {
        intent: typedIntent.trace_id,
        confidence: typedIntent.confidence,
      });
      return {
        success: false,
        error: `Confidence ${typedIntent.confidence} below threshold 0.7`,
      };
    }

    // 6. Check user confirmation
    if (!typedIntent.user_confirmed) {
      this.riskSink.log('User confirmation required', {
        intent: typedIntent.trace_id,
      });
      return {
        success: false,
        error: 'User confirmation required',
      };
    }

    // 7. Route by risk lane
    if (typedIntent.risk_lane === 'BLOCKED') {
      this.riskSink.log('Risk lane BLOCKED', {
        intent: typedIntent.trace_id,
      });
      return {
        success: false,
        error: 'Risk lane BLOCKED',
      };
    }

    if (typedIntent.risk_lane === 'RED') {
      // Escalate to MAN mode
      try {
        await this.manMode.escalate(typedIntent);
        return {
          success: true,
          result: { man_mode_escalated: true, task_id: 'pending' },
        };
      } catch (error) {
        this.riskSink.log('MAN mode escalation failed', {
          intent: typedIntent.trace_id,
          error:
            error instanceof Error ? error.message : 'Unknown error',
        });
        return {
          success: false,
          error: 'MAN mode escalation failed',
        };
      }
    }

    // 8. Check if action is allowlisted
    if (!ALLOWLISTED_ACTIONS.has(typedIntent.canonical_action_type)) {
      this.riskSink.log(
        `Action ${typedIntent.canonical_action_type} not allowlisted`,
        { intent: typedIntent.trace_id }
      );
      return {
        success: false,
        error: `Action ${typedIntent.canonical_action_type} not allowlisted`,
      };
    }

    // 9. Claim receipt (idempotency check)
    let receiptClaimed: { claimed: boolean };
    try {
      receiptClaimed = await this.receiptClaimer.claim(
        typedIntent.idempotency_key
      );
    } catch (error) {
      this.riskSink.log('Receipt claim failed', {
        intent: typedIntent.trace_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: 'Receipt claim failed',
      };
    }

    // 10. If receipt already claimed, return idempotent result
    if (!receiptClaimed.claimed) {
      return {
        success: true,
        receipt: typedIntent.idempotency_key,
        result: { idempotent: true },
      };
    }

    // 11. Execute allowlisted action
    try {
      const result = await this.executor.execute(
        typedIntent.canonical_action_type,
        typedIntent.canonical_object_id,
        typedIntent.params
      );

      // 12. Sync to backend (fire and forget)
      fetch(this.syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: typedIntent.idempotency_key,
          result,
        }),
      }).catch(() => {
        // Ignore sync errors (already executed locally)
      });

      return {
        success: true,
        receipt: typedIntent.idempotency_key,
        result,
      };
    } catch (error) {
      this.riskSink.log('Execution failed', {
        intent: typedIntent.trace_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: 'Execution failed',
      };
    }
  }

  /**
   * Validate required identity fields
   */
  private validateRequiredFields(
    intent: unknown
  ): string | null {
    if (!intent || typeof intent !== 'object') {
      return 'Missing required identity fields';
    }

    const i = intent as Record<string, unknown>;

    const requiredFields = [
      'tenant_id',
      'subject_id',
      'trace_id',
      'canonical_action_type',
    ];

    for (const field of requiredFields) {
      if (!i[field]) {
        return 'Missing required identity fields';
      }
    }

    return null;
  }

  /**
   * Validate BCP-47 locale format
   *
   * Examples: en, en-US, zh-Hans-CN
   * Pattern: language[-script][-region]
   */
  private isValidBCP47Locale(locale: string): boolean {
    const bcp47Pattern =
      /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/;
    return bcp47Pattern.test(locale);
  }
}

// Global instance for singleton access
let globalAdapter: MaestroExecutionAdapter | null = null;

/**
 * Get or create global MAESTRO execution adapter
 */
export function getMaestroExecutionAdapter(): MaestroExecutionAdapter | null {
  return globalAdapter;
}

/**
 * Initialize MAESTRO execution adapter
 */
export async function initializeMaestroExecutionAdapter(
  syncUrl: string,
  manModeUrl?: string
): Promise<void> {
  globalAdapter = new MaestroExecutionAdapter(null, syncUrl, manModeUrl);
}
