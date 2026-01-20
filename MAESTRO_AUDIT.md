# MAESTRO Implementation Audit Report
**Date**: 2026-01-20
**Auditor**: Claude Code (CTO/Principal Architect)
**Repository**: APEX-OmniHub
**Branch**: claude/prepare-omnidev-webapp-testing-b2eqP
**Commit**: 0cd04c2

---

## Executive Summary

**Status**: ✅ Repository audit complete. APEX-OmniHub is well-architected with clean separation of concerns, strong security patterns, and reusable abstractions that align perfectly with MAESTRO's browser-only compute requirements.

**Key Findings**:
- ✅ **No existing AI/ML runtime** → Clean slate for browser-only inference
- ✅ **IndexedDB abstraction exists** → Reusable for MAESTRO tiered memory
- ✅ **WebCrypto utilities present** → Foundation for E2EE
- ✅ **Single-port integration pattern** → Perfect for MAESTRO port
- ✅ **Robust RLS + audit logging** → Idempotency patterns ready
- ✅ **Supabase Edge Functions** → Template for maestro-sync
- ⚠️ **No Service Worker** → Must add for offline model caching
- ⚠️ **No Web Workers** → Must add for browser inference

**Recommendation**: Proceed with Phase 1 implementation. All invariants are satisfied.

---

## 1. Repository Architecture

### 1.1 Technology Stack

```yaml
Frontend:
  Framework: React 18.3.1 + TypeScript 5.8.3
  Build Tool: Vite 7.2.7
  State Management: TanStack Query 5.83.0
  Routing: React Router DOM 6.30.1
  UI Library: Radix UI (ShadCN pattern)
  Styling: Tailwind CSS 3.4.17
  Testing: Vitest 4.0.16 + Playwright 1.57.0

Backend:
  Platform: Supabase (Postgres 16 + Edge Functions/Deno)
  Auth: Supabase Auth (JWT + RLS)
  Storage: Supabase Storage (S3-compatible)
  Functions: Deno 1.x (Edge Functions)

Additional:
  Web3: viem 2.43.4 + wagmi 2.19.5
  Forms: React Hook Form 7.61.1 + Zod 3.25.76
  Date: date-fns 3.6.0
```

### 1.2 Directory Structure

```
/home/user/APEX-OmniHub/
├── src/                          # Frontend source
│   ├── integrations/             # ✅ Single-port integration pattern
│   │   ├── lovable/              # Example: Lovable integration
│   │   ├── omnilink/             # Example: OmniLink integration
│   │   ├── supabase/             # Supabase client + types
│   │   └── [maestro/]            # 🎯 MAESTRO integration port (TO ADD)
│   ├── lib/                      # Core libraries
│   │   ├── storage/              # ✅ Storage abstraction
│   │   ├── database/             # ✅ Database abstraction
│   │   ├── security.ts           # ✅ WebCrypto utilities
│   │   ├── supabase/client.ts    # Supabase client factory
│   │   ├── offline.ts            # Offline support patterns
│   │   ├── ratelimit.ts          # Rate limiting
│   │   └── monitoring.ts         # Observability
│   ├── libs/                     # Shared utilities
│   │   └── persistence.ts        # ✅ IndexedDB abstraction
│   ├── components/               # React components
│   ├── pages/                    # Route pages
│   ├── contexts/                 # React contexts
│   ├── guardian/                 # Security monitoring
│   ├── security/                 # Security features
│   └── omniconnect/              # Existing integration system
├── supabase/                     # Backend
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── _shared/              # Shared utilities (CORS, clients)
│   │   ├── lovable-audit/        # ✅ Audit function pattern
│   │   └── [maestro-sync/]       # 🎯 MAESTRO sync function (TO ADD)
│   └── migrations/               # Database migrations
│       ├── 20251218000000_create_audit_logs_table.sql  # ✅ Audit logs
│       ├── 20260119000000_create_man_notifications.sql # ✅ Idempotency pattern
│       └── [maestro_*.sql]       # 🎯 MAESTRO tables (TO ADD)
├── scripts/                      # Build/ops scripts
├── tests/                        # Test suites
└── public/                       # Static assets
```

---

## 2. Reusable Components

### 2.1 Frontend Abstractions (REUSE)

#### A. IndexedDB Persistence (`/src/libs/persistence.ts`)
**Status**: ✅ Production-ready
**Reusability**: HIGH
**Usage**: Extend for MAESTRO tiered memory stores

```typescript
// Current API:
persistentGet<T>(key: string): Promise<T | null>
persistentSet<T>(key: string, value: T): Promise<void>
persistentDelete(key: string): Promise<void>

// Pattern:
// 1. IndexedDB first (omnilink-cache DB)
// 2. localStorage fallback
// 3. In-memory fallback
// 4. Handles quota errors gracefully
```

**MAESTRO Adaptation**:
- Create separate `maestro-memory` IndexedDB database
- Add store per tier: `core`, `working`, `episodic`, `semantic`, `procedural`
- Reuse error handling and fallback logic

#### B. Storage Abstraction (`/src/lib/storage/interface.ts`)
**Status**: ✅ Production-ready
**Reusability**: HIGH
**Usage**: Store E2EE blobs + metadata

```typescript
interface IStorage {
  upload(bucket, path, file, options): Promise<StorageResult<string>>
  download(bucket, path, options): Promise<StorageResult<Blob>>
  getMetadata(bucket, path): Promise<StorageResult<StorageFile>>
  createSignedUrl(bucket, path, options): Promise<StorageResult<string>>
  // ... full S3-compatible API
}
```

**MAESTRO Adaptation**:
- Use `maestro-encrypted` bucket for ciphertext blobs
- Store metadata: `content_hash`, `key_version`, `locale`, `tier`
- Leverage presigned URLs for large blob uploads

#### C. Security Utilities (`/src/lib/security.ts`)
**Status**: ✅ Production-ready
**Reusability**: HIGH
**Usage**: WebCrypto foundation for E2EE

```typescript
// Already implemented:
generateRequestSignature(data, secret): Promise<string>    // HMAC-SHA256
verifyRequestSignature(data, sig, secret): Promise<boolean>
generateCsrfToken(): string                                 // crypto.getRandomValues
```

**MAESTRO Adaptation**:
- Add `generateEncryptionKey()` → AES-GCM key derivation
- Add `encryptMemory(plaintext, key)` → WebCrypto AES-GCM
- Add `decryptMemory(ciphertext, key)` → WebCrypto AES-GCM
- Add `deriveKeyFromPassphrase(passphrase, salt)` → PBKDF2

### 2.2 Backend Patterns (REUSE)

#### A. Edge Function Template (`/supabase/functions/lovable-audit/index.ts`)
**Status**: ✅ Production-ready
**Pattern**: Auth + CORS + RLS + error handling

```typescript
// Template pattern:
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return handlePreflight(req);

  // Auth
  const authHeader = req.headers.get('Authorization');
  const supabase = createAnonClient(authHeader);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return unauthorized(corsHeaders);

  // Business logic
  const body = await req.json();
  await writeToDatabase(body);

  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

**MAESTRO Adaptation**:
- Clone to `/supabase/functions/maestro-sync/index.ts`
- Add schema validation (reject plaintext content)
- Add idempotency receipt check/insert
- Add audit log append

#### B. RLS Policy Patterns (`/supabase/migrations/`)
**Status**: ✅ Consistent patterns across tables
**Pattern**: Deny by default + user isolation + service role bypass

```sql
-- Example from man_notifications:
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY table_service_full_access ON table_name
FOR ALL USING (true);

-- Users can read own data
CREATE POLICY table_user_read ON table_name
FOR SELECT USING (auth.uid() = user_id);
```

**MAESTRO Adaptation**:
- Apply to `maestro_receipts`, `maestro_audit`, `maestro_encrypted_blobs`
- Add `tenant_id` column for multi-tenancy
- Use `auth.uid() = tenant_id` for user isolation

#### C. Idempotency Pattern (`man_notifications` table)
**Status**: ✅ DB-enforced via UNIQUE constraint
**Pattern**: Idempotency key + UNIQUE constraint + metadata

```sql
CREATE TABLE man_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE NOT NULL,  -- ✅ Enforces uniqueness
    task_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN man_notifications.idempotency_key
IS 'Format: man_notify:{task_id}:{channel}';
```

**MAESTRO Adaptation**:
- Apply to `maestro_receipts` table
- Format: `SHA-256(tenant_id|subject_id|canonical_action|...)`
- Return cached response on duplicate key violation

---

## 3. Gap Analysis (MUST ADD)

### 3.1 Missing Frontend Components

| Component | Status | Priority | Justification |
|-----------|--------|----------|---------------|
| **AI Inference Runtime** | ❌ Missing | P0 | Core MAESTRO requirement |
| **Web Workers** | ❌ Missing | P0 | Off-main-thread inference |
| **Service Worker** | ❌ Missing | P0 | Offline model caching |
| **JSON Schema Validator** | ❌ Missing | P0 | Contract enforcement |
| **MAESTRO Integration Port** | ❌ Missing | P0 | Single entrypoint |

### 3.2 Missing Backend Components

| Component | Status | Priority | Justification |
|-----------|--------|----------|---------------|
| **maestro-sync Edge Function** | ❌ Missing | P0 | Server-side sync |
| **maestro_receipts Table** | ❌ Missing | P0 | Idempotency enforcement |
| **maestro_audit Table** | ❌ Missing | P0 | Audit trail |
| **maestro_encrypted_blobs Table** | ❌ Missing | P1 | E2EE blob metadata |
| **/health/maestro Endpoint** | ❌ Missing | P1 | Observability |

### 3.3 Dependency Additions Required

```json
{
  "dependencies": {
    // Option A (Recommended): transformers.js for WebGPU/WASM
    "@xenova/transformers": "^2.17.0",

    // OR Option B: onnxruntime-web
    // "onnxruntime-web": "^1.17.0",

    // JSON Schema validation
    "ajv": "^8.12.0",
    "ajv-formats": "^3.0.0",

    // BCP-47 locale handling
    "bcp-47": "^2.1.0"
  }
}
```

**Decision Point**: **transformers.js** (Option A) is recommended because:
1. ✅ WebGPU + WASM support out-of-box
2. ✅ Built-in model hub integration
3. ✅ Transformer-based models (ideal for embeddings, translation)
4. ✅ Active community (Hugging Face)
5. ✅ Smaller bundle size than ONNX Runtime

---

## 4. Database Schema Design (NEW TABLES)

### 4.1 maestro_receipts (Idempotency)

```sql
CREATE TABLE IF NOT EXISTS maestro_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  canonical_event JSONB NOT NULL,
  outcome JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency enforcement
  CONSTRAINT maestro_receipts_unique_key
    UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX idx_maestro_receipts_tenant
  ON maestro_receipts(tenant_id, created_at DESC);
CREATE INDEX idx_maestro_receipts_key
  ON maestro_receipts(idempotency_key);

-- RLS
ALTER TABLE maestro_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY maestro_receipts_service ON maestro_receipts
FOR ALL USING (true);

CREATE POLICY maestro_receipts_user_read ON maestro_receipts
FOR SELECT USING (tenant_id::text = auth.uid()::text);
```

### 4.2 maestro_audit (Audit Trail)

```sql
CREATE TABLE IF NOT EXISTS maestro_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trace_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  risk_lane TEXT CHECK (risk_lane IN ('GREEN', 'YELLOW', 'RED')),
  content_hash TEXT,  -- SHA-256 of ciphertext
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maestro_audit_tenant
  ON maestro_audit(tenant_id, created_at DESC);
CREATE INDEX idx_maestro_audit_trace
  ON maestro_audit(trace_id);
CREATE INDEX idx_maestro_audit_risk
  ON maestro_audit(risk_lane) WHERE risk_lane = 'RED';

-- RLS
ALTER TABLE maestro_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY maestro_audit_service ON maestro_audit
FOR ALL USING (true);

CREATE POLICY maestro_audit_user_read ON maestro_audit
FOR SELECT USING (tenant_id::text = auth.uid()::text);
```

### 4.3 maestro_encrypted_blobs (E2EE Storage Metadata)

```sql
CREATE TABLE IF NOT EXISTS maestro_encrypted_blobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  blob_path TEXT NOT NULL,  -- Supabase Storage path
  content_hash TEXT NOT NULL,  -- SHA-256 of ciphertext
  key_version INTEGER NOT NULL DEFAULT 1,
  locale TEXT NOT NULL,  -- BCP-47
  tier TEXT CHECK (tier IN ('core', 'working', 'episodic', 'semantic', 'procedural')),
  size_bytes INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- For working tier TTL

  CONSTRAINT maestro_blobs_unique_hash
    UNIQUE (tenant_id, content_hash)
);

CREATE INDEX idx_maestro_blobs_tenant
  ON maestro_encrypted_blobs(tenant_id, tier, created_at DESC);
CREATE INDEX idx_maestro_blobs_hash
  ON maestro_encrypted_blobs(content_hash);
CREATE INDEX idx_maestro_blobs_expires
  ON maestro_encrypted_blobs(expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE maestro_encrypted_blobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY maestro_blobs_service ON maestro_encrypted_blobs
FOR ALL USING (true);

CREATE POLICY maestro_blobs_user_access ON maestro_encrypted_blobs
FOR ALL USING (tenant_id::text = auth.uid()::text);
```

---

## 5. Integration Points

### 5.1 Frontend Integration Port

**Path**: `/src/integrations/maestro/index.ts`

**Exports** (Single Entrypoint):
```typescript
// Primary API
export { useMaestro } from './hooks/useMaestro';
export { MaestroProvider } from './providers/MaestroProvider';

// Types
export type {
  MaestroConfig,
  MemoryTier,
  CanonicalEvent,
  ExecutionIntent,
  GroundingResult
} from './types';

// Feature flags
export { isMaestroEnabled } from './config';
```

**Usage Pattern**:
```tsx
// In app root:
import { MaestroProvider } from '@/integrations/maestro';

<MaestroProvider config={maestroConfig}>
  <App />
</MaestroProvider>

// In components:
import { useMaestro } from '@/integrations/maestro';

const { memory, grounding, execute } = useMaestro();
```

### 5.2 Backend Integration Port

**Path**: `/supabase/functions/maestro-sync/index.ts`

**Endpoint**: `POST /functions/v1/maestro-sync`

**Request Schema**:
```typescript
{
  "tenant_id": "uuid",
  "trace_id": "string",
  "idempotency_key": "sha256-hash",
  "event_type": "memory_sync|execution_request",
  "content_ciphertext": "base64-string",
  "content_hash": "sha256-hash",
  "metadata": {
    "locale": "en-CA",
    "tier": "working",
    "key_version": 1
  }
}
```

**Response**:
```typescript
{
  "status": "ok"|"duplicate",
  "receipt_id": "uuid",
  "outcome_ref": "uuid"  // If duplicate
}
```

### 5.3 Health Check Integration

**Path**: `/src/pages/Health.tsx` (extend existing)

**Endpoint**: `GET /api/health/maestro`

**Response**:
```json
{
  "enabled": true,
  "status": "healthy",
  "checks": {
    "indexeddb": { "status": "ok", "db_size_mb": 12.5 },
    "webgpu": { "status": "ok", "adapter": "nvidia-rtx" },
    "wasm": { "status": "ok" },
    "service_worker": { "status": "ok", "cached_models": 3 },
    "sync": { "status": "ok", "last_sync": "2026-01-20T10:30:00Z" }
  },
  "queue_depth": 0,
  "dlq_count": 0
}
```

---

## 6. Feature Flag Strategy

### 6.1 Environment Variables

```bash
# .env.example additions:

# MAESTRO Configuration
VITE_MAESTRO_ENABLED=false  # Default: off
VITE_MAESTRO_DEBUG=false    # Verbose logging
VITE_MAESTRO_MODELS_PATH=/models  # Service Worker cache path

# Browser Inference Budgets (deterministic)
VITE_MAESTRO_MAX_TOKENS=512
VITE_MAESTRO_MAX_EMBEDDINGS_PER_QUERY=100
VITE_MAESTRO_INFERENCE_TIMEOUT_MS=10000
```

### 6.2 Runtime Check

```typescript
// /src/integrations/maestro/config.ts
export function isMaestroEnabled(): boolean {
  return import.meta.env.VITE_MAESTRO_ENABLED === 'true';
}

// Usage:
if (!isMaestroEnabled()) {
  return <PriorBehavior />;
}
```

---

## 7. Security Threat Model (Preview)

**Full Document**: `/docs/maestro-threat-model.md` (Phase 1)

| OWASP LLM Category | Threat | MAESTRO Mitigation |
|--------------------|--------|-------------------|
| **LLM01: Prompt Injection** | Malicious input alters intent | Rule-based detection + local classifier → RiskEvent → no Core writes |
| **LLM02: Insecure Output** | XSS via generated text | Sanitize with DOMPurify before render |
| **LLM03: Training Data Poisoning** | N/A (using pre-trained models) | Pin model versions + integrity checks |
| **LLM04: Model DoS** | Infinite loop/large input | Deterministic budgets (MAX_TOKENS, timeout) |
| **LLM05: Supply Chain** | Compromised model files | Subresource Integrity (SRI) hashes for models |
| **LLM06: Sensitive Info Disclosure** | Model leaks PII | E2EE (server never sees plaintext) |
| **LLM07: Insecure Plugin Design** | Malicious executor action | Allowlist-only executors + no freeform eval |
| **LLM08: Excessive Agency** | Auto-execution of RED lane | RED lane → MAN Mode (human approval) |
| **LLM09: Overreliance** | Blind trust of output | Translation verification (back-translation check) |
| **LLM10: Model Theft** | N/A (open models) | Models cached locally, no IP risk |

---

## 8. Rollback Plan

**Trigger Conditions**:
1. Critical security issue (injection bypass, RLS failure)
2. Data corruption (IndexedDB/blob desync)
3. Performance degradation (>30% regression)
4. User-reported blockers (unable to authenticate, data loss)

**Rollback Steps**:
```bash
# 1. Set feature flag off
echo "VITE_MAESTRO_ENABLED=false" >> .env.production

# 2. Deploy rollback
npm run build
# Deploy to production

# 3. Disable maestro-sync function
supabase functions delete maestro-sync

# 4. (Optional) Drop MAESTRO tables (if data integrity concern)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS maestro_receipts CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS maestro_audit CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS maestro_encrypted_blobs CASCADE;"

# 5. Clear client-side state
# Instruct users: localStorage.clear(); indexedDB.deleteDatabase('maestro-memory');
```

**Recovery Time Objective (RTO)**: <15 minutes
**Recovery Point Objective (RPO)**: 0 (no data loss; encrypted blobs preserved)

---

## 9. Implementation Phases (Detailed)

### Phase 0: Audit ✅ COMPLETE
- [x] Map repository structure
- [x] Identify reusable components
- [x] Gap analysis
- [x] Design database schema
- [x] Define integration ports
- [x] Document rollback plan

### Phase 1: Foundation (ETA: 8-12 hours)
- [ ] Add dependencies (transformers.js, ajv, bcp-47)
- [ ] Create `/src/integrations/maestro/` structure
- [ ] Implement IndexedDB tiered stores (5 tiers)
- [ ] Add JSON schemas for CanonicalEvent, ExecutionIntent, etc.
- [ ] Create MaestroProvider + useMaestro hook
- [ ] Add feature flag checks
- [ ] Extend `/src/lib/security.ts` with E2EE functions
- [ ] Create Service Worker scaffold (model caching)
- [ ] Unit tests: IndexedDB, schemas, E2EE

**Deliverable**: MAESTRO integration port compiles, IndexedDB tiers functional, E2EE proven

### Phase 2: Browser Inference (ETA: 10-15 hours)
- [ ] Create Web Workers for inference (`/src/integrations/maestro/workers/`)
- [ ] Implement embedding generation (local)
- [ ] Implement translation + verification (back-translation)
- [ ] Implement summarization/compaction
- [ ] Add deterministic budgets (MAX_TOKENS, timeout)
- [ ] Add WebGPU/WASM detection + fallback
- [ ] Integration tests: inference in Workers, embeddings, translation
- [ ] Performance tests: latency <10s, no UI blocking

**Deliverable**: Browser performs all AI compute, no server calls for inference

### Phase 3: Local Retrieval (ETA: 6-10 hours)
- [ ] Implement semantic search (cosine similarity on embeddings)
- [ ] Implement cross-lingual retrieval
- [ ] Add tier-specific retrieval logic
- [ ] Implement memory ranking/scoring
- [ ] Integration tests: retrieval accuracy, locale handling
- [ ] Performance tests: <500ms for 1000 embeddings

**Deliverable**: Retrieval works offline, cross-lingual, local-only

### Phase 4: Backend Sync (ETA: 8-12 hours)
- [ ] Create database migrations (maestro_receipts, maestro_audit, maestro_encrypted_blobs)
- [ ] Create `/supabase/functions/maestro-sync/index.ts`
- [ ] Implement schema validation (reject plaintext)
- [ ] Implement idempotency check/insert
- [ ] Implement audit log append
- [ ] Add rate limiting
- [ ] Create `/supabase/functions/maestro-health/index.ts`
- [ ] Integration tests: sync, idempotency, RLS
- [ ] E2E tests: frontend → backend → DB

**Deliverable**: maestro-sync deployed, idempotency enforced, audit trail functional

### Phase 5: Execution & Safety (ETA: 8-12 hours)
- [ ] Create ExecutionIntent schema + validation
- [ ] Implement allowlisted executor integration
- [ ] Add prompt injection detection (rule-based + optional classifier)
- [ ] Add translation verification fail-closed logic
- [ ] Wire ExecutionIntent → existing executor/MAN-mode
- [ ] Implement RiskEvent logging
- [ ] Integration tests: injection fail-closed, RED lane → MAN, idempotency
- [ ] Security tests: injection bypass attempts, side effect prevention

**Deliverable**: Execution fail-closed, injection blocked, RED lane quarantined

### Phase 6: Testing & Evidence (ETA: 6-10 hours)
- [ ] E2E test: duplicate intent → no duplicate side effects
- [ ] E2E test: injection → fail-closed, RiskEvent logged, no Core writes
- [ ] E2E test: translation verification fail → execution blocked
- [ ] E2E test: offline read-only with cached assets
- [ ] E2E test: cross-lingual retrieval returns expected memory
- [ ] E2E test: MAESTRO_ENABLED=false → prior behavior unchanged
- [ ] Load test: 1000 concurrent users, <5s p99
- [ ] Security test: OWASP LLM Top 10 scenarios
- [ ] Generate evidence report

**Deliverable**: All tests passing, evidence documented

### Phase 7: Documentation & Launch (ETA: 4-6 hours)
- [ ] Create `/docs/maestro-threat-model.md`
- [ ] Create `/docs/maestro-runbook.md`
- [ ] Update `/docs/LAUNCH_READINESS.md`
- [ ] Create rollback checklist
- [ ] Update `/src/pages/Health.tsx` with MAESTRO checks
- [ ] Create migration guide for users
- [ ] Prepare launch announcement
- [ ] Final review: CTO sign-off

**Deliverable**: Production-ready, documented, rollback-ready

**Total ETA**: 50-77 hours (~1.5-2 weeks for single engineer)

---

## 10. File Paths Reference

### Files to Modify
```
/package.json                                    # Add dependencies
/src/pages/Health.tsx                           # Add MAESTRO health check
/.env.example                                   # Add MAESTRO env vars
/src/lib/security.ts                            # Add E2EE functions
/src/libs/persistence.ts                        # (Reuse, minor extensions)
```

### Files to Create (Frontend)
```
/src/integrations/maestro/
  ├── index.ts                                  # Single entrypoint
  ├── config.ts                                 # Feature flags
  ├── types.ts                                  # TypeScript types
  ├── schemas/                                  # JSON schemas
  │   ├── canonical-event.schema.json
  │   ├── execution-intent.schema.json
  │   ├── grounding-result.schema.json
  │   └── index.ts
  ├── providers/
  │   └── MaestroProvider.tsx                   # React context provider
  ├── hooks/
  │   ├── useMaestro.ts                         # Primary hook
  │   ├── useMemory.ts                          # Memory tiers
  │   ├── useGrounding.ts                       # Grounding/retrieval
  │   └── useExecution.ts                       # Execution intents
  ├── stores/
  │   ├── indexeddb.ts                          # IndexedDB tiers
  │   ├── core-memory.ts                        # T1 Core
  │   ├── working-memory.ts                     # T2 Working
  │   ├── episodic-memory.ts                    # T3 Episodic
  │   ├── semantic-memory.ts                    # T4 Semantic
  │   └── procedural-memory.ts                  # T5 Procedural
  ├── workers/
  │   ├── inference.worker.ts                   # Inference worker
  │   ├── embeddings.worker.ts                  # Embeddings worker
  │   └── translation.worker.ts                 # Translation worker
  ├── crypto/
  │   ├── encryption.ts                         # AES-GCM E2EE
  │   ├── key-derivation.ts                     # PBKDF2
  │   └── hashing.ts                            # SHA-256
  ├── inference/
  │   ├── runtime.ts                            # transformers.js wrapper
  │   ├── embeddings.ts                         # Embedding generation
  │   ├── translation.ts                        # Translation + verification
  │   └── summarization.ts                      # Summarization/compaction
  ├── retrieval/
  │   ├── semantic-search.ts                    # Cosine similarity search
  │   ├── ranking.ts                            # Memory ranking
  │   └── cross-lingual.ts                      # Locale-aware retrieval
  ├── execution/
  │   ├── intent-builder.ts                     # ExecutionIntent factory
  │   ├── executor-adapter.ts                   # Executor integration
  │   └── man-mode-adapter.ts                   # MAN Mode queue
  ├── security/
  │   ├── injection-detection.ts                # Prompt injection rules
  │   ├── risk-classifier.ts                    # Risk lane assignment
  │   └── translation-verification.ts           # Back-translation check
  ├── sync/
  │   ├── sync-client.ts                        # maestro-sync caller
  │   ├── idempotency.ts                        # Idempotency key gen
  │   └── offline-queue.ts                      # Offline sync queue
  └── utils/
      ├── locale.ts                             # BCP-47 handling
      ├── validation.ts                         # Schema validation (ajv)
      └── budgets.ts                            # Deterministic budgets

/public/
  └── maestro-sw.js                             # Service Worker (model caching)
```

### Files to Create (Backend)
```
/supabase/migrations/
  ├── 20260120000000_create_maestro_receipts.sql
  ├── 20260120000001_create_maestro_audit.sql
  └── 20260120000002_create_maestro_encrypted_blobs.sql

/supabase/functions/maestro-sync/
  ├── index.ts                                  # Sync endpoint
  └── schema.ts                                 # Request schema

/supabase/functions/maestro-health/
  └── index.ts                                  # Health check endpoint
```

### Files to Create (Documentation)
```
/docs/
  ├── maestro-threat-model.md                   # Security threat model
  ├── maestro-runbook.md                        # Operations guide
  ├── maestro-architecture.md                   # Architecture decisions
  └── maestro-rollback.md                       # Rollback procedures
```

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|---------|------------|
| **IndexedDB quota exceeded** | Medium | High | Bounded eviction + compaction; crash-safe |
| **WebGPU unavailable** | Low | Medium | WASM fallback; read-only if both fail |
| **Model loading timeout** | Low | Medium | Service Worker pre-caching; retry logic |
| **Idempotency key collision** | Very Low | High | SHA-256 (2^256 space); time_bucket included |
| **Translation verification false negative** | Low | Medium | Tunable threshold; manual override path |
| **Prompt injection bypass** | Low | High | Multi-layer defense (rules + classifier + allowlist) |
| **Key loss** | Medium | Critical | Document limits; no recovery for historical data |
| **RLS misconfiguration** | Very Low | Critical | Automated tests; deny-by-default policy |

---

## 12. Success Criteria

### Phase 1-7 Completion:
- ✅ All 52 sub-tasks completed
- ✅ All tests passing (unit, integration, E2E, security)
- ✅ Evidence documented with commands + outputs
- ✅ Rollback plan tested in staging
- ✅ CTO/Principal Architect sign-off

### Non-Functional Requirements:
- ✅ Browser inference latency: <10s p99
- ✅ Retrieval latency: <500ms for 1000 embeddings
- ✅ IndexedDB write throughput: >100 writes/sec
- ✅ Sync endpoint: <2s p95
- ✅ Offline functionality: Full read-only access
- ✅ Feature flag off: 0 MAESTRO code paths executed
- ✅ Bundle size increase: <2MB (gzipped)

### Security Requirements:
- ✅ No server-side AI compute (validated by code review)
- ✅ No plaintext memory content on server (validated by audit logs)
- ✅ Idempotency enforced (validated by duplicate intent test)
- ✅ Injection fail-closed (validated by security test suite)
- ✅ RLS deny-by-default (validated by policy tests)

---

## 13. Next Steps

**Immediate Actions**:
1. ✅ Review this audit report
2. ⏭️ Approve dependency additions (transformers.js + ajv + bcp-47)
3. ⏭️ Create Phase 1 branch: `feature/maestro-phase1-foundation`
4. ⏭️ Begin Phase 1 implementation

**Phase 1 Kickoff Checklist**:
- [ ] `npm install @xenova/transformers ajv ajv-formats bcp-47`
- [ ] Create `/src/integrations/maestro/` directory structure
- [ ] Create `/docs/maestro-threat-model.md` skeleton
- [ ] Update project README with MAESTRO section
- [ ] Schedule Phase 1 review (post-implementation)

---

## Appendix A: Existing Integration Examples

### A.1 Lovable Integration Structure
```
/src/integrations/lovable/
├── client.ts           # API client
└── types.ts            # TypeScript types
```

### A.2 OmniLink Integration Structure
```
/src/integrations/omnilink/
├── client.ts           # OmniLink client
├── types.ts            # TypeScript types
└── hooks.ts            # React hooks
```

### A.3 Supabase Integration Structure
```
/src/integrations/supabase/
├── client.ts           # Supabase client factory (see above)
└── types.ts            # Database types (auto-generated)
```

**Pattern**: MAESTRO will follow this proven structure.

---

## Appendix B: Dependency Justification

### B.1 Why transformers.js over onnxruntime-web?

| Criterion | transformers.js | onnxruntime-web |
|-----------|----------------|-----------------|
| **WebGPU Support** | ✅ Native | ✅ Via webgpu EP |
| **WASM Fallback** | ✅ Built-in | ✅ Built-in |
| **Bundle Size** | ~1.5MB (gzipped) | ~3MB (gzipped) |
| **Model Hub** | ✅ Hugging Face direct | ⚠️ Manual conversion |
| **Embedding Models** | ✅ Sentence-transformers | ✅ Custom ONNX |
| **Translation Models** | ✅ mT5, M2M100 | ✅ Custom ONNX |
| **Community** | ✅ Very active | ✅ Active |
| **Maintenance** | ✅ Hugging Face backed | ✅ Microsoft backed |

**Decision**: transformers.js for faster iteration, smaller bundle, direct model access.

### B.2 Why ajv for JSON Schema?

| Criterion | ajv | zod | yup |
|-----------|-----|-----|-----|
| **JSON Schema Draft** | ✅ 2020-12 | ❌ Custom DSL | ❌ Custom DSL |
| **Performance** | ✅ Fastest | ⚠️ Slower | ⚠️ Slower |
| **Standards Compliance** | ✅ Full | ❌ Partial | ❌ No |
| **Bundle Size** | ~50KB | ~30KB | ~40KB |
| **Server + Client** | ✅ Yes | ✅ Yes | ✅ Yes |

**Decision**: ajv for JSON Schema standard compliance (contract enforcement requires interop).

---

**End of Audit Report**
**Next**: Phase 1 Implementation
**Prepared by**: Claude Code (CTO/Principal Architect)
**Date**: 2026-01-20
