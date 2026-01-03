/**
 * DATABASE ABSTRACTION LAYER - FACTORY
 *
 * Purpose: Create database instances with provider abstraction
 * Usage:
 *   import { createDatabase, db } from '@/lib/database'
 *
 *   // Option 1: Use singleton instance (recommended)
 *   const users = await db.find('users', { filters: [{ column: 'active', operator: '=', value: true }] })
 *
 *   // Option 2: Create custom instance
 *   const adminDb = createDatabase({ provider: 'supabase', url: '...', serviceRoleKey: '...' })
 */

import type { IDatabase, DatabaseFactoryOptions } from './interface'
import { SupabaseDatabase } from './providers/supabase'

// ============================================================================
// DATABASE FACTORY
// ============================================================================

/**
 * Create a database instance based on provider
 */
export function createDatabase(options: DatabaseFactoryOptions): IDatabase {
  switch (options.provider) {
    case 'supabase':
      if (!options.url || !options.apiKey) {
        throw new Error(
          'Supabase provider requires "url" and "apiKey" options'
        )
      }

      return new SupabaseDatabase({
        url: options.url,
        apiKey: options.apiKey,
        serviceRoleKey: options.serviceRoleKey,
        debug: options.debug,
      })

    case 'postgresql':
      // Future implementation
      throw new Error('PostgreSQL provider not yet implemented')

    case 'planetscale':
      // Future implementation
      throw new Error('PlanetScale provider not yet implemented')

    default:
      throw new Error(`Unknown database provider: ${options.provider}`)
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Default database instance (Supabase)
 * Configured from environment variables
 */
let _db: IDatabase | null = null

export function getDatabase(): IDatabase {
  if (_db) {
    return _db
  }

  // Read from environment variables
  const provider = (import.meta.env.VITE_DATABASE_PROVIDER || 'supabase') as DatabaseFactoryOptions['provider']
  const url = import.meta.env.VITE_SUPABASE_URL
  const apiKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  const debug = import.meta.env.DEV

  if (!url || !apiKey) {
    throw new Error(
      'Database not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables.'
    )
  }

  _db = createDatabase({
    provider,
    url,
    apiKey,
    serviceRoleKey,
    debug,
  })

  return _db
}

/**
 * Singleton database instance
 * Lazy-loaded on first access
 */
export const db = new Proxy({} as IDatabase, {
  get(target, prop) {
    const instance = getDatabase()
    return (instance as any)[prop]
  },
})

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type {
  IDatabase,
  QueryFilter,
  QueryOptions,
  DatabaseResult,
  DatabaseListResult,
  DatabaseProvider,
  DatabaseFactoryOptions,
} from './interface'

export { SupabaseDatabase } from './providers/supabase'

// ============================================================================
// MIGRATION HELPER
// ============================================================================

/**
 * Helper for migrating from direct Supabase usage to abstraction layer
 *
 * Before:
 *   import { supabase } from '@/integrations/supabase/client'
 *   const { data } = await supabase.from('users').select('*').eq('id', userId)
 *
 * After:
 *   import { db } from '@/lib/database'
 *   const { data } = await db.findById('users', userId)
 */
export const migrationGuide = {
  // Query operations
  select: 'db.find(table, { select: [...] })',
  selectSingle: 'db.findOne(table, { filters: [...] }) or db.findById(table, id)',
  count: 'db.count(table, { filters: [...] })',

  // Mutation operations
  insert: 'db.insert(table, data) or db.insertMany(table, dataArray)',
  update: 'db.update(table, data, { filters: [...] }) or db.updateById(table, id, data)',
  delete: 'db.delete(table, { filters: [...] }) or db.deleteById(table, id)',

  // Storage operations
  upload: 'db.uploadFile(bucket, path, file)',
  download: 'db.downloadFile(bucket, path)',
  getPublicUrl: 'db.getFileUrl(bucket, path)',

  // Realtime subscriptions
  subscribe: 'db.subscribe(table, callback, { filters: [...] })',

  // Auth
  getUser: 'db.getCurrentUserId()',
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * EXAMPLE USAGE:
 *
 * // Find all active users
 * const { data: users, error } = await db.find('users', {
 *   filters: [
 *     { column: 'active', operator: '=', value: true }
 *   ],
 *   orderBy: { column: 'created_at', ascending: false },
 *   limit: 10
 * })
 *
 * // Find user by ID
 * const { data: user, error } = await db.findById('users', userId)
 *
 * // Insert new user
 * const { data: newUser, error } = await db.insert('users', {
 *   email: 'user@example.com',
 *   name: 'John Doe'
 * })
 *
 * // Update user
 * const { data: updatedUser, error } = await db.updateById('users', userId, {
 *   name: 'Jane Doe'
 * })
 *
 * // Delete user
 * const { data: success, error } = await db.deleteById('users', userId)
 *
 * // Count records
 * const { data: count, error } = await db.count('users', {
 *   filters: [{ column: 'active', operator: '=', value: true }]
 * })
 *
 * // Upload file
 * const { data: url, error } = await db.uploadFile(
 *   'avatars',
 *   `${userId}/profile.jpg`,
 *   fileBlob,
 *   { contentType: 'image/jpeg' }
 * )
 *
 * // Subscribe to changes
 * const unsubscribe = await db.subscribe('users', (event, record) => {
 *   console.log(`User ${event}:`, record)
 * })
 */
