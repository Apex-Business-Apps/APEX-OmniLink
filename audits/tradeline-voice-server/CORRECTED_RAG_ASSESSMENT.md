# CORRECTED RAG ASSESSMENT

**Update:** January 16, 2026

## Key Clarification

The initial audit correctly identified that **tradeline247-railway does NOT have RAG**.

However, the **APEX-OmniHub platform DOES have a production RAG implementation** that the voice server could integrate with.

---

## APEX-OmniHub RAG Infrastructure (EXISTS)

### 1. Database Layer
**File:** `supabase/migrations/20251221000000_omnilink_agentic_rag.sql`

| Component | Status | Details |
|-----------|--------|---------|
| `agent_skills` table | IMPLEMENTED | Vector(384) embeddings, gte-small compatible |
| HNSW Index | IMPLEMENTED | Cosine similarity, m=16, ef_construction=64 |
| GIN Index | IMPLEMENTED | Full-text search support |
| `match_skills()` RPC | IMPLEMENTED | Hybrid search with RRF (Reciprocal Rank Fusion) |
| `agent_checkpoints` table | IMPLEMENTED | Thread state persistence |
| RLS Policies | IMPLEMENTED | User-scoped access control |

### 2. Application Layer
**File:** `supabase/functions/_shared/skill-loader.ts`

| Component | Status | Details |
|-----------|--------|---------|
| `SkillRegistry` class | IMPLEMENTED | Full CRUD operations |
| Embedding Generation | IMPLEMENTED | Uses Supabase AI (gte-small) |
| Hybrid Search | IMPLEMENTED | Vector + Full-text with RRF |
| Input Sanitization | IMPLEMENTED | Trims and validates inputs |

### 3. Type System
**File:** `supabase/functions/_shared/types.ts`

| Type | Status | Purpose |
|------|--------|---------|
| `SkillDefinition` | DEFINED | Skill schema with parameters |
| `AgentState` | DEFINED | Thread state structure |
| `SkillMatch` | DEFINED | Search result format |
| `PlanStep` | DEFINED | Tri-Force planning |
| `GuardianResult` | DEFINED | Safety scanning results |

---

## tradeline247-railway Integration Gap

The voice server at `tradeline247-railway` is **NOT integrated** with APEX-OmniHub's RAG system.

### What tradeline247-railway COULD do:

```javascript
// Instead of hardcoded tools...
const TOOLS = [
  { name: 'check_availability', ... },  // HARDCODED
  { name: 'book_appointment', ... },    // HARDCODED
];

// It SHOULD call APEX-OmniHub's RAG:
const skillRegistry = new SkillRegistry(supabaseClient);
const relevantSkills = await skillRegistry.retrieveSkills(userQuery, 5);
// Use relevantSkills dynamically based on user intent
```

### Missing Integration Points:

1. **No Supabase client** in tradeline247-railway
2. **No skill retrieval** - Uses static tool list
3. **No embedding generation** - No dynamic skill discovery
4. **No checkpoint persistence** - Session memory only in-process

---

## Updated Recommendation

### For tradeline247-railway:

1. Add `@supabase/supabase-js` dependency
2. Import `SkillRegistry` from shared functions
3. Replace hardcoded tools with dynamic RAG retrieval
4. Persist call transcripts to `agent_checkpoints`

### For APEX-OmniHub RAG:

The existing RAG implementation is **production-quality**:
- Proper vector indexing (HNSW)
- Hybrid search (semantic + keyword)
- RLS security
- Input sanitization
- Error handling

**Recommendation:** Validate with integration tests against live Supabase instance.

---

## Test Coverage Needed

| Test | Target | Priority |
|------|--------|----------|
| Embedding generation | skill-loader.ts | HIGH |
| Hybrid search accuracy | match_skills RPC | HIGH |
| RLS policy enforcement | agent_skills table | HIGH |
| Checkpoint persistence | agent_checkpoints | MEDIUM |
| Voice server integration | tradeline247 | HIGH |

---

## Conclusion

| System | RAG Status |
|--------|------------|
| **APEX-OmniHub** | IMPLEMENTED (production-ready) |
| **tradeline247-railway** | NOT INTEGRATED (uses hardcoded stubs) |

The RAG infrastructure exists in APEX-OmniHub. The gap is that tradeline247-railway doesn't use it.
