/**
 * OmniPort - The Proprietary Ingress Engine
 * =============================================================================
 * Central export point for OmniPort ingress components.
 *
 * Usage:
 * ```typescript
 * import {
 *   OmniPort,
 *   ingest,
 *   processVoiceCommand,
 *   getOmniPortMetrics,
 *   getOmniPortStatus,
 * } from '@/omniconnect/ingress';
 * ```
 * =============================================================================
 */

// Core OmniPort Engine
export {
  OmniPort,
  OmniPortEngine,
  ingest,
  validateAndIngest,
} from './OmniPort';

// Type Definitions (re-exported for convenience)
export {
  RawInput,
  TextSource,
  VoiceSource,
  WebhookSource,
  IngestResult,
  IngestStatus,
  RiskLane,
  SecurityError,
  validateRawInput,
  safeValidateRawInput,
  isTextSource,
  isVoiceSource,
  isWebhookSource,
  detectHighRiskIntents,
  HIGH_RISK_INTENTS,
} from '../types/ingress';

// Metrics & Observability
export {
  omniPortMetrics,
  getOmniPortMetrics,
  getOmniPortStatus,
  recordIngestEvent,
  resetMetricsCollector,
  type OmniPortMetrics,
  type OmniPortStatus,
  type IngestEvent,
} from './omniport-metrics';

// Voice Command Handler
export {
  omniPortVoice,
  processVoiceCommand,
  quickVoiceCommand,
  startVoiceSession,
  endVoiceSession,
  configureVoiceHandler,
  type VoiceCommandConfig,
  type VoiceCommandResult,
  type VoiceSession,
} from './omniport-voice';
