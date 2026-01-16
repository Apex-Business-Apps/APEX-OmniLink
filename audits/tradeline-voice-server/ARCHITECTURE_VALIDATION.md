# Architecture Validation: Documented vs Implemented

**Audit Date:** January 16, 2026
**Reference:** "Definitive End-to-End Workflow for Stateful Event-Driven AI Voice Agent"

---

## Architecture Overview

```
[Caller] <===(PSTN)===> [Twilio] <===(WebSocket)===> [Railway/Supabase] <===(WebSocket)===> [OpenAI Realtime]
                           ^                                |
                           | (Webhook)                      | (Tools & Logic)
                           v                                v
                   [Supabase Edge Function]          [Email/Database]
```

---

## Step-by-Step Validation

### Step 1: The Dial (Twilio Receives Call)

| Documented | Status |
|------------|--------|
| Customer dials Twilio phone number | EXTERNAL (Twilio handles) |
| Twilio looks up Voice Webhook URL | EXTERNAL (Twilio handles) |

**Status:** N/A (External System)

---

### Step 2: The Gateway (Supabase TwiML Function)

| Documented | Actual Implementation | Status |
|------------|----------------------|--------|
| POST to `telephony-voice` Supabase function | NOT FOUND | MISSING |
| Returns TwiML with `<Say>` (Polly.Joanna-Neural) | NOT FOUND | MISSING |
| Returns `<Connect><Stream>` to Railway | NOT FOUND | MISSING |
| Embeds caller phone as parameter | NOT FOUND | MISSING |

**Status:** CRITICAL - The `telephony-voice` function does not exist in the codebase.

**What EXISTS instead:**
- `apex-voice/index.ts` - WebSocket-only bridge (no TwiML)
- `ops-voice-health/index.ts` - Health metrics endpoint

---

### Step 3: WebSocket Connection to Voice Server

| Documented | Actual (tradeline247-railway) | Actual (APEX-OmniHub) |
|------------|------------------------------|----------------------|
| Twilio connects to `/media-stream` | IMPLEMENTED (server.mjs:103) | IMPLEMENTED (apex-voice) |
| Fastify accepts connection | IMPLEMENTED | Deno.serve accepts |

**Status:** PARTIAL - Two implementations exist:

1. **tradeline247-railway** (`server.mjs`)
   - Endpoint: `/media-stream`
   - Framework: Fastify + WebSocket
   - Audio Format: `g711_ulaw`
   - Model: `gpt-4o-realtime-preview-2024-10-01`

2. **APEX-OmniHub** (`apex-voice/index.ts`)
   - Endpoint: WebSocket upgrade
   - Framework: Deno.serve
   - Audio Format: `pcm16`
   - Model: `gpt-4o-realtime-preview-2024-12-17`

---

### Step 4: Brain Activation (OpenAI Connection)

| Feature | tradeline247-railway | apex-voice | Documented |
|---------|---------------------|------------|------------|
| OpenAI Realtime API | YES | YES | YES |
| Session update | YES | YES | YES |
| System prompt | Generic receptionist | APEX-specific | Custom |
| Voice | `shimmer` | `alloy` | Configurable |
| VAD Mode | `server_vad` | `server_vad` (threshold 0.6) | `server_vad` |
| Tools defined | 3 tools | 1 tool (`update_context`) | N tools |

**Status:** IMPLEMENTED (both versions)

---

### Step 5: Audio Relay (Conversation Loop)

| Feature | tradeline247-railway | apex-voice |
|---------|---------------------|------------|
| Twilio → Server → OpenAI | YES | YES |
| OpenAI → Server → Twilio | YES | YES |
| Audio format conversion | g711_ulaw | pcm16 |

**Status:** IMPLEMENTED

---

### Step 6: Smart Interruption (Barge-In)

| Feature | tradeline247-railway | apex-voice |
|---------|---------------------|------------|
| VAD detection | YES (server_vad) | YES (server_vad) |
| Clear buffer on interrupt | NOT IMPLEMENTED | NOT IMPLEMENTED |
| Latency tracking | NOT IMPLEMENTED | YES (turn_latency metric) |

**Status:** PARTIAL - VAD exists but explicit buffer clearing not implemented

---

### Step 7: Business Logic (Tools)

| Tool | tradeline247-railway | apex-voice | Status |
|------|---------------------|------------|--------|
| `check_availability` | STUB (hardcoded) | NOT IMPLEMENTED | GAP |
| `book_appointment` | STUB (hardcoded) | NOT IMPLEMENTED | GAP |
| `transfer_call` | IMPLEMENTED (Twilio API) | NOT IMPLEMENTED | PARTIAL |
| `update_context` | NOT IMPLEMENTED | IMPLEMENTED | PARTIAL |

**Status:** CRITICAL GAPS

---

### Step 8: Human Handoff (Dispatch)

| Feature | tradeline247-railway | apex-voice |
|---------|---------------------|------------|
| Transfer detection | YES (transfer_call tool) | NO |
| Twilio REST API update | YES (twilioClient.calls.update) | NO |
| TwiML override to `<Dial>` | YES | NO |

**Status:** tradeline247 only

---

### Step 9: Audit Trail (Post-Call)

| Feature | tradeline247-railway | apex-voice |
|---------|---------------------|------------|
| Status callback | YES (`/voice-status`) | NO |
| Session memory | YES (sessionStore Map) | YES (sessionState object) |
| Email transcript | YES (Nodemailer) | NO |
| Session cleanup | YES (delete on completion) | NO (in-memory only) |

**Status:** tradeline247 more complete

---

## Security Features Comparison

| Feature | tradeline247-railway | apex-voice |
|---------|---------------------|------------|
| Voice safety evaluation | NO | YES (multi-lang injection detection) |
| Phonetic jailbreak detection | NO | YES |
| PII leak detection | NO | YES |
| Helmet middleware | In deps, NOT USED | N/A (Deno) |
| Webhook signature validation | NO | N/A |

**Winner:** apex-voice (has actual security scanning)

---

## Missing Components Summary

### 1. TwiML Gateway Function (`telephony-voice`)
```
MISSING: No function to provide initial TwiML with:
- <Say voice="Polly.Joanna-Neural">Welcome to TradeLine 24/7...</Say>
- <Connect><Stream url="wss://railway-url/media-stream"></Stream></Connect>
```

### 2. Tool Integrations
```
MISSING: Real implementations for:
- check_availability (needs Calendar API)
- book_appointment (needs Database persistence)
- RAG skill retrieval (needs SkillRegistry integration)
```

### 3. Unified Architecture
```
MISSING: The two voice implementations don't share:
- Common tool definitions
- Session state persistence
- Transcript storage
```

---

## Validation Score

| Category | Score | Notes |
|----------|-------|-------|
| Initiation (TwiML Gateway) | 0/100 | telephony-voice doesn't exist |
| WebSocket Bridge | 80/100 | Both implementations work |
| OpenAI Integration | 90/100 | Both connect correctly |
| Tools | 20/100 | Mostly stubs |
| Security | 60/100 | apex-voice has safety, tradeline has nothing |
| Audit Trail | 40/100 | tradeline has email, neither has persistence |
| **OVERALL** | **48/100** | **NOT PRODUCTION READY** |

---

## Recommendations

### Immediate (Blocking)
1. Create `telephony-voice` Supabase function with TwiML
2. Replace hardcoded tools with real integrations
3. Add `/voice-answer` endpoint to tradeline247 OR use apex-voice

### Short-Term
1. Integrate `SkillRegistry` from APEX-OmniHub RAG
2. Add `voiceSafety` evaluation to tradeline247
3. Persist transcripts to Supabase

### Architecture Decision
Choose ONE voice server path:
- **Option A:** tradeline247-railway (Fastify/Node.js, g711_ulaw)
- **Option B:** apex-voice (Deno/Supabase, pcm16)

Currently both exist but neither is complete.

---

## Appendix: Component Locations

| Component | Location | Status |
|-----------|----------|--------|
| tradeline247-railway | github.com/apexbusiness-systems/tradeline247-railway | INCOMPLETE |
| apex-voice | APEX-OmniHub/supabase/functions/apex-voice | INCOMPLETE |
| telephony-voice | NOT FOUND | MISSING |
| voiceSafety | APEX-OmniHub/supabase/functions/_shared/voiceSafety.ts | IMPLEMENTED |
| SkillRegistry (RAG) | APEX-OmniHub/supabase/functions/_shared/skill-loader.ts | IMPLEMENTED |
| agent_skills (DB) | APEX-OmniHub/supabase/migrations/...rag.sql | IMPLEMENTED |
