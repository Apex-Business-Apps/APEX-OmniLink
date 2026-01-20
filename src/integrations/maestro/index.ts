/**
 * MAESTRO Integration - Single Entrypoint
 *
 * Browser-only compute system with E2EE and multi-lingual support.
 * Default: MAESTRO_ENABLED=false (optional-by-default invariant)
 */

// ===========================================================================
// PRIMARY API
// ===========================================================================

export { MaestroProvider } from './providers/MaestroProvider';
export { useMaestro } from './hooks/useMaestro';
export { useMemory } from './hooks/useMemory';
export { useGrounding } from './hooks/useGrounding';
export { useExecution } from './hooks/useExecution';

// ===========================================================================
// CONFIGURATION
// ===========================================================================

export { isMaestroEnabled, isMaestroDebugEnabled, getMaestroConfig } from './config';
export type { MaestroConfig } from './config';

// ===========================================================================
// TYPES
// ===========================================================================

export type {
  MemoryTier,
  RiskLane,
  LocaleString,
  CanonicalEvent,
  MemoryItem,
  MemoryDelta,
  GroundingResult,
  MaestroPlan,
  PlanStep,
  ExecutionIntent,
  RiskEvent,
  TranslationVerification,
  InferenceBudget,
  EncryptionKeyMetadata,
  SyncRequest,
  SyncResponse,
  MaestroHealthResponse,
} from './types';

// ===========================================================================
// VALIDATION
// ===========================================================================

export {
  validateCanonicalEvent,
  validateExecutionIntent,
  validateGroundingResult,
  assertValidCanonicalEvent,
  assertValidExecutionIntent,
  assertValidGroundingResult,
} from './utils/validation';
export type { ValidationResult } from './utils/validation';

// ===========================================================================
// INDEXEDDB STORES
// ===========================================================================

export {
  initMaestroDb,
  storeMemoryItem,
  getMemoryItem,
  getAllMemoryItems,
  getMemoryItemsByLocale,
  deleteMemoryItem,
  clearMemoryTier,
  compactMemoryTier,
  getDatabaseSize,
  checkIndexedDbHealth,
} from './stores/indexeddb';
