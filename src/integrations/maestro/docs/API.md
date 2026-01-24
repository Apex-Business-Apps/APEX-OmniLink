# MAESTRO API Reference

**M.A.E.S.T.R.O. = Memory Augmented Execution Synchronization To Reproduce Orchestration**

This document covers MAESTRO’s public-facing APIs. It is written to align with the MAESTRO Safety Module barrel exports:

```ts
export { detectInjection, validateInput, sanitizeInput, securityScan } from "./injection-detection";
export { logRiskEvent, queryRiskEvents, getRiskStats } from "./risk-events";
```

If your MAESTRO root module additionally exports execution helpers (e.g., `executeIntent`), keep the imports shown below. Otherwise, document only what your root barrel exports.

---

## Table of Contents

- [Types](#types)
- [Safety Module](#safety-module)
  - [detectInjection](#detectinjection)
  - [validateInput](#validateinput)
  - [sanitizeInput](#sanitizeinput)
  - [securityScan](#securityscan)
  - [logRiskEvent](#logriskevent)
  - [queryRiskEvents](#queryriskevents)
  - [getRiskStats](#getriskstats)
- [Execution Engine](#execution-engine)
- [Validation Rules](#validation-rules)
- [References](#references)

---

## Types

### RiskLane

```ts
export type RiskLane = "GREEN" | "YELLOW" | "RED" | "BLOCKED";
```

### TranslationStatus

```ts
export type TranslationStatus = "PENDING" | "COMPLETED" | "FAILED";
```

### MaestroIdentity

```ts
export interface MaestroIdentity {
  tenant_id: string;
  user_id: string;
  session_id: string;
  device_fingerprint?: string;
}
```

### MaestroIntent

```ts
export interface MaestroIntent {
  intent_id: string;
  idempotency_key: string; // 64-char hex (SHA-256)
  tenant_id: string;
  user_id: string;
  session_id: string;

  action: string;
  parameters: Record<string, unknown>;

  locale?: string; // BCP-47
  translation_status?: TranslationStatus;
  risk_lane?: RiskLane;
  confidence?: number; // 0..1
  created_at?: string; // ISO-8601
}
```

### ValidationResult

```ts
export interface ValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}
```

### InjectionDetectionResult

```ts
export interface InjectionDetectionResult {
  detected: boolean;
  blocked: boolean;
  risk_score: number; // 0-100
  patterns_matched: string[];
  warnings: string[];
  sanitized_input?: string;
}
```

### ExecutionResult

```ts
export interface ExecutionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  risk_lane: RiskLane;
  injection_result?: InjectionDetectionResult;
  execution_time_ms?: number;
}
```

---

## Safety Module

### Imports

```ts
import {
  detectInjection,
  validateInput,
  sanitizeInput,
  securityScan,
  logRiskEvent,
  queryRiskEvents,
  getRiskStats,
} from "@/integrations/maestro/safety";
```

### detectInjection

Scans text for injection patterns.

```ts
export function detectInjection(
  input: string,
  options?: { threshold?: number }
): InjectionDetectionResult;
```

- `threshold` default: `70`

### validateInput

Validates text length and basic content.

```ts
export function validateInput(
  input: string,
  options?: { maxLength?: number }
): ValidationResult;
```

- `maxLength` default: `10000`

### sanitizeInput

Removes hidden/dangerous characters and delimiters.

```ts
export function sanitizeInput(input: string): string;
```

### securityScan

Combined validate + detect + sanitize.

```ts
export function securityScan(
  input: string,
  options?: { threshold?: number; maxLength?: number }
): {
  passed: boolean;
  input_valid: boolean;
  validation_error?: string;
  injection_result: InjectionDetectionResult;
  sanitized?: string;
};
```

### logRiskEvent

Logs a risk event to the configured audit store.

```ts
export async function logRiskEvent(
  event: Omit<RiskEvent, "event_id" | "created_at">
): Promise<void>;
```

### queryRiskEvents

```ts
export async function queryRiskEvents(filters: {
  tenant_id?: string;
  event_type?: string;
  risk_lane?: RiskLane;
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<RiskEvent[]>;
```

### getRiskStats

```ts
export async function getRiskStats(
  tenant_id: string,
  period: "hour" | "day" | "week" | "month"
): Promise<{
  total_events: number;
  by_type: Record<string, number>;
  by_lane: Record<RiskLane, number>;
  blocked_rate: number;
}>;
```

---

## Execution Engine

If exported by your MAESTRO root barrel (commonly `@/integrations/maestro`), the engine typically provides:

- `validateIntent(intent)`
- `executeIntent(intent, options?)`
- `executeBatch(intents, options?)`
- `isActionAllowlisted(action)`
- `registerCustomAction(action)`
- `requestMANMode(request)`

Document these functions here only if they exist in your root exports.

---

## Validation Rules

### Idempotency Key

Idempotency keys should be 64-character lowercase hex (SHA-256 digest):

```ts
export const IDEMPOTENCY_KEY_PATTERN = /^[a-f0-9]{64}$/;
```

### Locale / BCP-47

BCP-47 is complex; a small regex is not a complete validator. MAESTRO recommends canonicalization using platform APIs when available:

```ts
export function isValidLocaleTag(tag: string): boolean {
  try {
    Intl.getCanonicalLocales(tag);
    return true;
  } catch {
    return false;
  }
}
```

---

## References

- OWASP Top 10 for Large Language Model Applications (v1.1): https://owasp.org/www-project-top-10-for-large-language-model-applications/
- RFC 5646 (BCP 47 language tags): https://datatracker.ietf.org/doc/html/rfc5646
- MDN BCP 47 language tag overview: https://developer.mozilla.org/en-US/docs/Glossary/BCP_47_language_tag
