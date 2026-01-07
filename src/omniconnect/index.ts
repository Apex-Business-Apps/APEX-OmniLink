/**
 * OmniConnect - Universal Paywall-Gated Integration Layer
 *
 * Main entry point for all OmniConnect functionality
 */

export * from './types/canonical';
export * from './types/connector';

// Core services
export * from './core/registry';
export * from './core/omniconnect';

// Connectors
export * from './connectors/base';
export * from './connectors/meta-business';

// Storage & Security
export * from './storage/encrypted-storage';

// Policy & Guardrails
export * from './policy/policy-engine';

// Translation
export * from './translation/translator';

// Entitlements
export * from './entitlements/entitlements-service';

// Delivery
export * from './delivery/omnilink-delivery';

// Utils
export * from './utils/correlation';
export * from './utils/validation';