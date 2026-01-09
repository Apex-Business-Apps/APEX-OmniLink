# Semantic Translator Technical Specification

> OmniConnect Zero-Drift Data Pipeline - Event Translation Layer

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Canonical Event Schema](#canonical-event-schema)
4. [Translation Pipeline](#translation-pipeline)
5. [Policy Engine](#policy-engine)
6. [Delivery Layer](#delivery-layer)
7. [Idempotency & Race Conditions](#idempotency--race-conditions)
8. [Internationalization](#internationalization)
9. [API Reference](#api-reference)
10. [Configuration](#configuration)

---

## Overview

The Semantic Translator is the core data transformation layer of OmniConnect, responsible for:

- **Normalizing** provider-specific data formats into a canonical schema
- **Filtering** events based on app-specific policies
- **Translating** canonical events to target app formats
- **Delivering** translated events with retry and idempotency guarantees

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Zero-Drift** | Canonical schema ensures data consistency across all providers |
| **Idempotent** | Atomic lock pattern prevents duplicate processing |
| **Extensible** | Plugin architecture for custom translators |
| **Observable** | Correlation IDs enable end-to-end tracing |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OmniConnect Core                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │   Provider   │    │   Provider   │    │      Provider        │   │
│  │ (Meta Biz)   │    │  (LinkedIn)  │    │     (Twitter)        │   │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘   │
│         │                   │                       │               │
│         └───────────────────┴───────────────────────┘               │
│                             │                                        │
│                             ▼                                        │
│                   ┌─────────────────┐                               │
│                   │  Normalization  │                               │
│                   │    (→ Canon)    │                               │
│                   └────────┬────────┘                               │
│                            │                                        │
│                            ▼                                        │
│                   ┌─────────────────┐                               │
│                   │  Policy Engine  │                               │
│                   │   (Filter/PII)  │                               │
│                   └────────┬────────┘                               │
│                            │                                        │
│                            ▼                                        │
│                   ┌─────────────────┐                               │
│                   │   Semantic      │                               │
│                   │   Translator    │                               │
│                   └────────┬────────┘                               │
│                            │                                        │
│                            ▼                                        │
│                   ┌─────────────────┐                               │
│                   │ OmniLink        │                               │
│                   │ Delivery        │                               │
│                   └────────┬────────┘                               │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Target App    │
                    └─────────────────┘
```

---

## Canonical Event Schema

The canonical schema provides a standardized format for all provider data.

### EventType Enum

```typescript
enum EventType {
  // Social Media Events
  SOCIAL_POST_VIEWED = 'social_post_viewed',
  SOCIAL_POST_SAVED = 'social_post_saved',
  SOCIAL_POST_SHARED = 'social_post_shared',
  COMMENT = 'comment',
  MESSAGE = 'message',
  REACTION = 'reaction',

  // Business/Advertising Events
  AD_INSIGHT = 'ad_insight',
  PAGE_INSIGHT = 'page_insight',
  CAMPAIGN_PERFORMANCE = 'campaign_performance',
  AUDIENCE_INSIGHT = 'audience_insight',

  // Engagement Events
  PROFILE_VIEW = 'profile_view',
  CONNECTION_REQUEST = 'connection_request',
  FOLLOW = 'follow',
  UNFOLLOW = 'unfollow',

  // Content Events
  CONTENT_PUBLISHED = 'content_published',
  CONTENT_UPDATED = 'content_updated',
  CONTENT_DELETED = 'content_deleted',
}
```

### CanonicalEvent Interface

```typescript
interface CanonicalEvent {
  eventId: string;           // Unique event identifier (UUID)
  correlationId: string;     // End-to-end tracing ID
  tenantId: string;          // Multi-tenant isolation
  userId: string;            // User isolation
  source: string;            // Data source identifier
  provider: string;          // Provider name (meta_business, linkedin, etc.)
  externalId: string;        // External system identifier
  eventType: EventType;      // Standardized event type
  timestamp: string;         // ISO 8601 timestamp
  locale?: Locale;           // BCP-47 locale tag (e.g., 'en-US')
  consentFlags: ConsentFlags;// User consent status
  metadata: Record<string, any>;  // Provider-specific metadata
  payload: Record<string, any>;   // Standardized payload
}
```

### Consent Types

| Type | Description |
|------|-------------|
| `analytics` | Usage data collection |
| `marketing` | Marketing communications |
| `personalization` | Personalized experiences |
| `third_party_sharing` | Data sharing with partners |

---

## Translation Pipeline

### SemanticTranslator Class

```typescript
class SemanticTranslator {
  // Registry of app-specific translators
  private translators = new Map<string, TranslatorFunction>();

  // Translate canonical events to app format
  async translate(
    events: CanonicalEvent[],
    appId: string,
    correlationId: string
  ): Promise<TranslatedEvent[]>;

  // Register custom translator for an app
  registerTranslator(appId: string, translator: TranslatorFunction): void;

  // Unregister translator
  unregisterTranslator(appId: string): boolean;
}
```

### TranslatedEvent Interface

```typescript
interface TranslatedEvent {
  eventId: string;                  // Original event ID
  correlationId: string;            // Tracing ID
  appId: string;                    // Target application
  payload: Record<string, any>;     // App-specific format
  metadata: Record<string, any>;    // Translation metadata
}
```

### Custom Translator Example

```typescript
// Register app-specific translator
translator.registerTranslator('crm-app', (event: CanonicalEvent) => ({
  eventId: event.eventId,
  correlationId: event.correlationId,
  appId: 'crm-app',
  payload: {
    // Map to CRM-specific format
    contactId: event.externalId,
    interactionType: mapEventType(event.eventType),
    timestamp: event.timestamp,
    source: event.provider,
    details: event.payload
  },
  metadata: {
    originalProvider: event.provider,
    translatedAt: new Date().toISOString()
  }
}));
```

---

## Policy Engine

The Policy Engine filters and transforms events based on app-specific rules.

### AppFilterProfile

```typescript
interface AppFilterProfile {
  appId: string;
  allowedEventTypes: string[];      // Whitelist of event types
  piiHandling: 'mask' | 'redact' | 'allow';
  emotionalDataEnabled: boolean;    // Allow emotional/sentiment data
  contentCategories: {
    allow: string[];                // Allowed content categories
    deny: string[];                 // Blocked categories
  };
  rateLimit: {
    eventsPerMinute: number;
    burstLimit: number;
  };
}
```

### Policy Operations

| Operation | Description |
|-----------|-------------|
| `filter()` | Apply policy rules to event batch |
| `getProfile()` | Retrieve app filter profile |
| `setProfile()` | Configure app filter profile |
| `validateEvent()` | Validate single event against policy |

### PII Handling Modes

| Mode | Behavior |
|------|----------|
| `allow` | Pass PII data unchanged |
| `mask` | Replace with masked values (e.g., `j***@example.com`) |
| `redact` | Remove PII fields entirely |

---

## Delivery Layer

### OmniLinkDelivery Class

```typescript
class OmniLinkDelivery {
  private maxRetries = 3;
  private baseDelay = 1000;  // Exponential backoff base

  // Deliver batch of events
  async deliverBatch(
    events: TranslatedEvent[],
    appId: string,
    correlationId: string
  ): Promise<number>;

  // Check delivery status
  async getDeliveryStatus(eventId: string): Promise<DeliveryResult | null>;

  // Retry failed deliveries
  async retryFailedDeliveries(appId: string): Promise<number>;
}
```

### DeliveryResult

```typescript
interface DeliveryResult {
  eventId: string;
  success: boolean;
  attempts: number;
  error?: string;
  deliveredAt?: Date;
}
```

### Retry Strategy

```
Attempt 1: Immediate
Attempt 2: Wait 1s
Attempt 3: Wait 2s
Attempt 4: Wait 4s (max)
→ Dead-letter queue after max retries
```

---

## Idempotency & Race Conditions

### Atomic Lock Pattern

```sql
-- translation_receipts table
CREATE TABLE translation_receipts (
  event_id UUID PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result JSONB
);

-- Acquire lock (atomic)
INSERT INTO translation_receipts (event_id, correlation_id, app_id)
VALUES ($1, $2, $3)
ON CONFLICT (event_id) DO NOTHING
RETURNING *;

-- If row returned → acquired lock, proceed
-- If no row returned → another process has lock, skip
```

### Idempotency Flow

```
┌─────────────┐
│ Event       │
│ Received    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ INSERT ... ON CONFLICT  │
│ DO NOTHING              │
└──────────┬──────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────────┐
│ Row     │ │ No Row      │
│ Created │ │ (Duplicate) │
└────┬────┘ └──────┬──────┘
     │             │
     ▼             ▼
┌─────────┐ ┌─────────────┐
│ Process │ │ Skip        │
│ Event   │ │ (Idempotent)│
└─────────┘ └─────────────┘
```

---

## Internationalization

### Supported Locales

| Code | Language |
|------|----------|
| `en` | English |
| `es` | Spanish |
| `de` | German |
| `ja` | Japanese |
| `fr` | French |
| `pt` | Portuguese |
| `it` | Italian |

### I18N React Hook

```typescript
// Usage in components
const { locale, setLocale, t } = useI18n();

// Translation with fallback
t('welcome_message');  // Returns localized string or key
```

### Voice Interface Locale

```typescript
// WebSocket URL includes locale
const wsUrl = `wss://api.apex.app/voice?lang=${locale}`;

// Cleanup on locale change
useEffect(() => {
  return () => cleanup();
}, [locale]);
```

---

## API Reference

### OmniConnect Core Methods

| Method | Description |
|--------|-------------|
| `isEnabled()` | Check if OmniConnect is enabled for user/app |
| `getAvailableConnectors()` | List available provider connectors |
| `initiateHandshake(provider)` | Start OAuth flow |
| `completeHandshake(...)` | Complete OAuth with code |
| `syncAll()` | Sync all connected providers |
| `disconnectConnector(id)` | Disconnect a provider |
| `getConnectionStatus()` | Get all connection statuses |

### Translation Methods

| Method | Description |
|--------|-------------|
| `translate(events, appId, correlationId)` | Translate event batch |
| `registerTranslator(appId, fn)` | Register custom translator |
| `unregisterTranslator(appId)` | Remove translator |

### Policy Methods

| Method | Description |
|--------|-------------|
| `filter(events, appId, correlationId)` | Apply policy filters |
| `getProfile(appId)` | Get app filter profile |
| `setProfile(profile)` | Set app filter profile |
| `validateEvent(event, appId)` | Validate single event |

---

## Configuration

### Environment Variables

```bash
# OmniConnect Core
OMNICONNECT_ENABLED=true
OMNICONNECT_DEMO_MODE=false

# Provider Credentials
META_BUSINESS_APP_ID=xxx
META_BUSINESS_APP_SECRET=xxx
LINKEDIN_CLIENT_ID=xxx
LINKEDIN_CLIENT_SECRET=xxx

# Delivery
OMNILINK_BASE_URL=https://api.apex.app/omnilink
OMNILINK_API_KEY=xxx

# Idempotency
TRANSLATION_LOCK_TIMEOUT_MS=30000
TRANSLATION_MAX_RETRIES=3

# I18N
DEFAULT_LOCALE=en
SUPPORTED_LOCALES=en,es,de,ja,fr,pt,it
```

### Rate Limits

| Tier | Events/Min | Burst |
|------|------------|-------|
| Free | 100 | 20 |
| Pro | 1,000 | 100 |
| Enterprise | 10,000 | 1,000 |

---

## Files

| File | Purpose |
|------|---------|
| `src/omniconnect/core/omniconnect.ts` | Main orchestration service |
| `src/omniconnect/types/canonical.ts` | Canonical event schema |
| `src/omniconnect/translation/translator.ts` | Semantic translator |
| `src/omniconnect/policy/policy-engine.ts` | Policy filtering |
| `src/omniconnect/delivery/omnilink-delivery.ts` | Event delivery |
| `src/omniconnect/storage/encrypted-storage.ts` | Token storage |
| `supabase/migrations/*_translation_receipts.sql` | Idempotency table |

---

## Sequence Diagram

```
User        OmniConnect      Provider      Translator      OmniLink
 │               │               │              │              │
 │  syncAll()    │               │              │              │
 │──────────────>│               │              │              │
 │               │  fetchDelta() │              │              │
 │               │──────────────>│              │              │
 │               │    rawEvents  │              │              │
 │               │<──────────────│              │              │
 │               │               │              │              │
 │               │  normalize()  │              │              │
 │               │──────────────>│              │              │
 │               │  canonical    │              │              │
 │               │<──────────────│              │              │
 │               │               │              │              │
 │               │           filter()           │              │
 │               │─────────────────────────────>│              │
 │               │           filtered           │              │
 │               │<─────────────────────────────│              │
 │               │               │              │              │
 │               │               │  translate() │              │
 │               │───────────────────────────────>             │
 │               │               │  translated  │              │
 │               │<───────────────────────────────             │
 │               │               │              │              │
 │               │               │              │  deliver()   │
 │               │─────────────────────────────────────────────>
 │               │               │              │    ack       │
 │               │<─────────────────────────────────────────────
 │   result      │               │              │              │
 │<──────────────│               │              │              │
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-07 | Initial OmniConnect implementation |
| 1.1.0 | 2026-01-08 | Add I18N support, locale field in canonical schema |
| 1.2.0 | 2026-01-09 | Atomic idempotency, translation receipts table |

---

*Document generated for APEX OmniHub Zero-Drift Integration.*
