# Device Registry

## Model
- `device_id, user_id, first_seen_at, last_seen_at, device_fingerprint, status (trusted/suspect/blocked)`.
- Implemented in `src/zero-trust/deviceRegistry.ts`.

## How IDs Are Derived
- Current stub: stored `device_id` in `localStorage` and uses `navigator.userAgent` as a fingerprint.
- Replace with stronger fingerprinting (hardware/browser signals) before production use.

## Status Usage
- New devices start as `suspect`, promoted to `trusted` after successful auth.
- `blocked` devices should be denied sessions and alerted in monitoring.

## Hooks
- Auth flow registers and marks devices trusted on successful login (`AuthContext`).
- Extend to add MFA challenge or additional checks for `suspect` devices.

