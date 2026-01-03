// ============================================================================
// EMERGENCY CONTROLS MIDDLEWARE
// ============================================================================
// Purpose: Operator supremacy enforcement for all OmniHub operations
//
// Usage:
//   import { enforceEmergencyControls } from '../_shared/emergency-controls.ts'
//
//   Deno.serve(async (req) => {
//     // Check emergency controls BEFORE any operation
//     const controls = await enforceEmergencyControls('operation_name')
//
//     // If we reach here, operation is allowed
//     // ...perform operation...
//   })
//
// Security: Fail-closed (if controls table unreachable, assume kill switch ON)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Emergency Controls State
 */
export interface EmergencyControls {
  kill_switch: boolean
  safe_mode: boolean
  operator_takeover: boolean
  allowed_operations: string[]
  updated_at: string
  updated_by: string | null
  reason: string | null
}

/**
 * Emergency Controls Error (thrown when operation is blocked)
 */
export class EmergencyControlsError extends Error {
  constructor(
    message: string,
    public readonly control: 'kill_switch' | 'safe_mode' | 'operator_takeover',
    public readonly controls: EmergencyControls
  ) {
    super(message)
    this.name = 'EmergencyControlsError'
  }
}

/**
 * In-memory cache for emergency controls (60 second TTL)
 * Reduces database queries, but ensures timely updates
 */
let cachedControls: EmergencyControls | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

/**
 * Get Emergency Controls from database (with caching)
 */
export async function getEmergencyControls(): Promise<EmergencyControls> {
  // Check cache first
  const now = Date.now()
  if (cachedControls && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedControls
  }

  // Fetch from database
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const { data, error } = await supabase
    .from('emergency_controls')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  if (error || !data) {
    // FAIL CLOSED: If we can't read emergency controls, assume kill switch is ON
    console.error('❌ CRITICAL: Failed to load emergency controls - failing closed', error)

    return {
      kill_switch: true,
      safe_mode: true,
      operator_takeover: true,
      allowed_operations: [],
      updated_at: new Date().toISOString(),
      updated_by: null,
      reason: 'SYSTEM FAILSAFE: Emergency controls table unreachable'
    }
  }

  // Update cache
  cachedControls = data as EmergencyControls
  cacheTimestamp = now

  return cachedControls
}

/**
 * Enforce Emergency Controls (main entry point)
 *
 * @param operationName - Name of operation being performed (e.g., 'execute_workflow', 'mint_nft')
 * @throws {EmergencyControlsError} if operation is blocked
 * @returns {EmergencyControls} current control state (if operation allowed)
 */
export async function enforceEmergencyControls(
  operationName: string
): Promise<EmergencyControls> {
  const controls = await getEmergencyControls()

  // Check 1: Kill Switch (blocks ALL operations)
  if (controls.kill_switch) {
    console.warn(
      `🚨 KILL SWITCH ACTIVE: Blocking operation "${operationName}"`,
      { reason: controls.reason, updated_at: controls.updated_at }
    )

    throw new EmergencyControlsError(
      `OMNIHUB_KILL_SWITCH is enabled - all operations are disabled. Reason: ${controls.reason || 'Not specified'}`,
      'kill_switch',
      controls
    )
  }

  // Check 2: Operator Takeover (requires operation in allowed list)
  if (controls.operator_takeover && !controls.allowed_operations.includes(operationName)) {
    console.warn(
      `⚠️  OPERATOR TAKEOVER ACTIVE: Operation "${operationName}" not in allowed list`,
      { allowed_operations: controls.allowed_operations, reason: controls.reason }
    )

    throw new EmergencyControlsError(
      `OPERATOR_TAKEOVER is enabled - operation "${operationName}" requires manual approval. Allowed operations: ${controls.allowed_operations.join(', ') || 'none'}`,
      'operator_takeover',
      controls
    )
  }

  // Check 3: Safe Mode (warning only, not blocking)
  if (controls.safe_mode) {
    console.warn(
      `ℹ️  SAFE MODE ACTIVE: Operation "${operationName}" should run in advisory-only mode (no side effects)`,
      { reason: controls.reason }
    )
  }

  // All checks passed - operation is allowed
  return controls
}

/**
 * Middleware wrapper for Deno.serve
 *
 * Usage:
 *   Deno.serve(
 *     withEmergencyControls('my_operation', async (req, controls) => {
 *       // Operation implementation here
 *       // controls parameter contains current emergency controls state
 *       return new Response('OK')
 *     })
 *   )
 */
export function withEmergencyControls(
  operationName: string,
  handler: (req: Request, controls: EmergencyControls) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    try {
      // Enforce emergency controls
      const controls = await enforceEmergencyControls(operationName)

      // Pass controls to handler
      return await handler(req, controls)
    } catch (error) {
      if (error instanceof EmergencyControlsError) {
        // Return 503 Service Unavailable with emergency controls info
        return new Response(
          JSON.stringify({
            error: error.message,
            control: error.control,
            controls: {
              kill_switch: error.controls.kill_switch,
              safe_mode: error.controls.safe_mode,
              operator_takeover: error.controls.operator_takeover,
              reason: error.controls.reason,
              updated_at: error.controls.updated_at
            }
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60' // Suggest client retry after 60 seconds
            }
          }
        )
      }

      // Other errors - re-throw
      throw error
    }
  }
}

/**
 * Clear emergency controls cache (for testing)
 */
export function clearEmergencyControlsCache() {
  cachedControls = null
  cacheTimestamp = 0
}

/**
 * Get emergency controls status for health check endpoint
 *
 * Returns minimal info suitable for public health check
 */
export async function getEmergencyControlsStatus(): Promise<{
  omnihub_enabled: boolean
  status: 'ok' | 'kill_switch' | 'operator_takeover' | 'safe_mode'
  last_updated: string
}> {
  try {
    const controls = await getEmergencyControls()

    if (controls.kill_switch) {
      return {
        omnihub_enabled: false,
        status: 'kill_switch',
        last_updated: controls.updated_at
      }
    }

    if (controls.operator_takeover) {
      return {
        omnihub_enabled: false,
        status: 'operator_takeover',
        last_updated: controls.updated_at
      }
    }

    if (controls.safe_mode) {
      return {
        omnihub_enabled: true,
        status: 'safe_mode',
        last_updated: controls.updated_at
      }
    }

    return {
      omnihub_enabled: true,
      status: 'ok',
      last_updated: controls.updated_at
    }
  } catch (error) {
    // Fail closed
    return {
      omnihub_enabled: false,
      status: 'kill_switch',
      last_updated: new Date().toISOString()
    }
  }
}
