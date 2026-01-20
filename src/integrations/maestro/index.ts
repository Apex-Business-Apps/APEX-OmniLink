/**
 * MAESTRO - Multi-Agent Execution with Safe Translation and Risk Orchestration
 *
 * A secure intent execution framework with:
 * - Risk-based routing (GREEN/YELLOW/RED/BLOCKED lanes)
 * - Injection detection and prevention
 * - Action allowlisting
 * - Idempotency support
 * - MAN (Manual Approval Needed) mode escalation
 */

// Types
export type {
  RiskLane,
  TranslationStatus,
  MaestroIdentity,
  MaestroIntent,
  ValidationResult,
  ExecutionResult,
  InjectionDetectionResult,
  RiskEvent,
  MANModeRequest,
  MANModeResponse,
  AllowlistedAction,
} from './types';

export {
  ALLOWLISTED_ACTIONS,
  BCP47_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
} from './types';

// Execution engine
export {
  isActionAllowlisted,
  registerCustomAction,
  clearCustomActions,
  validateIntent,
  executeIntent,
  executeBatch,
  requestMANMode,
} from './execution/engine';

// Safety module
export {
  detectInjection,
  validateInput,
  sanitizeInput,
  securityScan,
  logRiskEvent,
  queryRiskEvents,
  getRiskStats,
} from './safety';
