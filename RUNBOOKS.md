# MAESTRO Operational Runbooks

This document outlines standard operating procedures (SOPs) for managing the M.A.E.S.T.R.O. system in production.

## 1. Emergency Killswitch
**Scenario**: Active security incident or severe bug in Maestro logic.
**Action**: 
1. Log into your Deployment Provider (Vercel/Netlify/Railway).
2. Set environment variable: `VITE_MAESTRO_ENABLED=false`.
3. Redeploy.
**Effect**: `MaestroClient` will skip initialization. The app will revert to standard behavior (bypassing orchestrator logic if fallback is implemented, or failing safely).

## 2. Cryptographic Key Loss
**Scenario**: User clears browser data or IndexedDB corruption.
**Impact**: `T1` (Core) and `T2` (Working) memory becomes inaccessible if not synced.
**Recovery**:
1. MAESTRO is designed to be ephemeral-first for session keys in Phase 1.
2. Upon page reload, a **new session key** is generated.
3. Historical encrypted data in `maestro_memory_v1` cannot be decrypted without the old key. 
4. **Correction**: The user accepts memory loss. (Future phases will implement Key Derivation from User Password for persistence).

## 3. Storage Quota Eviction
**Scenario**: Browser clears IndexedDB due to disk space pressure.
**Indicators**: `MaestroClient` logs `Initialization failed` or `DataCloneError`.
**Recovery**:
1. The `TieredMemory` class automatically attempts to re-open/re-create the DB on init.
2. If quota is exceeded, older `T3_Episodic` (Timeline) items should be dropped first.
3. **Manual Action**: User can clear site data in DevTools > Application > Storage > Clear Site Data to reset.

## 4. Partial Sync Recovery
**Scenario**: User executes action while Offline. `SYNC_FAILED` warning logged.
**Impact**: Action executed locally, but audit trail is missing on server.
**Recovery (Automated)**:
- Future feature. Currently, the orchestrator logs a warning.
**Manual Recovery**:
- Check `maestro_audit_logs` table in Supabase.
- If critical, ask user to re-perform action when Online.

## 5. Deployment Checklist
Before promoting to Production:
- [ ] `VITE_MAESTRO_ENABLED=true`
- [ ] `VITE_SUPABASE_URL` is set to Production URL.
- [ ] `public/models/` contains valid `.onnx` files (if inference enabled).
- [ ] Supabase Migrations (`20260120...`) applied to Production DB.
