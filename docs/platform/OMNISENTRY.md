# OmniSentry

**Adaptive, Self-Healing, Ultra-Resilient Client-Side Monitoring**

## Overview

OmniSentry is an enterprise-grade monitoring system that runs entirely client-side with zero-maintenance operation. It provides circuit breaker protection, automatic error deduplication, and self-healing capabilities.

## Features

| Feature                 | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| **Circuit Breaker**     | Prevents cascade failures by opening circuit after 10 errors/min |
| **Self-Healing**        | Exponential backoff retry with jitter (max 30s)                  |
| **Self-Diagnosing**     | Periodic health checks every 30 seconds                          |
| **Error Deduplication** | Fingerprint-based deduplication (60s window)                     |
| **Zero-Maintenance**    | Autonomous operation, persists state to localStorage             |

## Quick Start

### Enable via UI Toggle

```tsx
import { OmniSentryDropdown } from "@/components/OmniSentryToggle";

// Add to your navigation bar
<OmniSentryDropdown />;
```

### Programmatic Usage

```typescript
import {
  getHealthStatus,
  reportOmniError,
  withResilience,
} from "@/lib/monitoring";

// Check system health
const health = getHealthStatus();
console.log(health.status); // 'healthy' | 'degraded' | 'critical'

// Wrap operations with resilience
const result = await withResilience(() => fetchData(), "fetchData");

// Report errors with deduplication
reportOmniError(new Error("Something failed"), { userId: "123" });
```

## Configuration

| Setting                 | Default | Description                   |
| ----------------------- | ------- | ----------------------------- |
| `errorThreshold`        | 10      | Errors before circuit opens   |
| `circuitResetMs`        | 60,000  | Circuit reset timeout (1 min) |
| `retryBaseMs`           | 1,000   | Base retry delay              |
| `maxRetries`            | 3       | Maximum retry attempts        |
| `healthCheckIntervalMs` | 30,000  | Diagnostic interval           |
| `dedupeWindowMs`        | 60,000  | Error deduplication window    |

## Components

### OmniSentryDropdown

Full settings dropdown with:

- Enable/disable toggle
- Health status display (status, circuit state, error rate)
- Diagnostics panel
- Clear data action

### OmniSentryIndicator

Compact status indicator for nav bars showing active status.

## API Reference

### `initializeOmniSentry(config?)`

Initialize with optional custom configuration.

### `getHealthStatus(): HealthStatus`

Returns current health metrics and diagnostics.

### `reportError(error, context?)`

Report an error with optional context (deduplicated).

### `withResilience<T>(operation, name): Promise<T | null>`

Execute operation with automatic retry and circuit breaker.

### `shutdownOmniSentry()`

Gracefully shutdown and persist state.

### `clearAllData()`

Clear all stored errors and reset circuit breaker.

## Storage Keys

| Key                   | Purpose                  |
| --------------------- | ------------------------ |
| `omni_sentry_enabled` | User preference (on/off) |
| `omni_sentry_errors`  | Error log (max 100)      |
| `omni_sentry_offline` | Offline queue (max 50)   |
| `omni_sentry_health`  | Last health status       |
| `omni_sentry_circuit` | Circuit breaker state    |

## Files

- [`src/lib/omni-sentry.ts`](../src/lib/omni-sentry.ts) - Core module
- [`src/components/OmniSentryToggle.tsx`](../src/components/OmniSentryToggle.tsx) - UI components
- [`src/lib/monitoring.ts`](../src/lib/monitoring.ts) - Integration & re-exports
