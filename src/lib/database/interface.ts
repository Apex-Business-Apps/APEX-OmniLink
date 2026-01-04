/**
 * DATABASE ABSTRACTION LAYER - INTERFACE
 *
 * Purpose: Provider-agnostic database interface for OmniHub
 * Reduces lock-in risk by abstracting Supabase-specific APIs
 *
 * Supported providers:
 * - Supabase (current)
 * - PostgreSQL (Cloud SQL, RDS, Azure Database) (future)
 * - PlanetScale (future)
 *
 * Design principles:
 * 1. Generic interface (works with any SQL database)
 * 2. Type-safe operations
 * 3. Minimal surface area (only common operations)
 * 4. Easy to test (mockable)
 */

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface QueryFilter {
  column: string
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'like' | 'ilike'
  value: unknown
}

export interface QueryOptions {
  filters?: QueryFilter[]
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
  offset?: number
  select?: string[] // Specific columns to select (if not provided, select all)
}

export interface DatabaseResult<T> {
  data: T | null
  error: Error | null
}

export interface DatabaseListResult<T> {
  data: T[] | null
  error: Error | null
  count?: number | null // Total count (for pagination)
}

// ============================================================================
// DATABASE INTERFACE
// ============================================================================

/**
 * Generic database interface
 * All database providers must implement this interface
 */
export interface IDatabase {
  // -------------------------------------------------------------------------
  // QUERY OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Find a single record by ID
   */
  findById<T>(
    table: string,
    id: string,
    options?: { select?: string[] }
  ): Promise<DatabaseResult<T>>

  /**
   * Find records matching filters
   */
  find<T>(
    table: string,
    options?: QueryOptions
  ): Promise<DatabaseListResult<T>>

  /**
   * Find a single record matching filters
   */
  findOne<T>(
    table: string,
    options?: QueryOptions
  ): Promise<DatabaseResult<T>>

  /**
   * Count records matching filters
   */
  count(
    table: string,
    options?: { filters?: QueryFilter[] }
  ): Promise<DatabaseResult<number>>

  // -------------------------------------------------------------------------
  // MUTATION OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Insert a single record
   */
  insert<T>(
    table: string,
    data: Partial<T>
  ): Promise<DatabaseResult<T>>

  /**
   * Insert multiple records
   */
  insertMany<T>(
    table: string,
    data: Partial<T>[]
  ): Promise<DatabaseListResult<T>>

  /**
   * Update records matching filters
   */
  update<T>(
    table: string,
    data: Partial<T>,
    options?: { filters?: QueryFilter[] }
  ): Promise<DatabaseListResult<T>>

  /**
   * Update a single record by ID
   */
  updateById<T>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<DatabaseResult<T>>

  /**
   * Delete records matching filters
   */
  delete(
    table: string,
    options?: { filters?: QueryFilter[] }
  ): Promise<DatabaseResult<boolean>>

  /**
   * Delete a single record by ID
   */
  deleteById(
    table: string,
    id: string
  ): Promise<DatabaseResult<boolean>>

  // -------------------------------------------------------------------------
  // RAW SQL (Advanced)
  // -------------------------------------------------------------------------

  /**
   * Execute raw SQL query
   * Use sparingly - prefer typed operations above
   */
  raw<T>(query: string, params?: unknown[]): Promise<DatabaseListResult<T>>

  // -------------------------------------------------------------------------
  // TRANSACTIONS (Optional - not all providers may support)
  // -------------------------------------------------------------------------

  /**
   * Execute operations in a transaction
   * Returns result of callback
   */
  transaction<T>(
    callback: (db: IDatabase) => Promise<T>
  ): Promise<DatabaseResult<T>>

  // -------------------------------------------------------------------------
  // AUTH INTEGRATION (Optional - provider-specific)
  // -------------------------------------------------------------------------

  /**
   * Get current authenticated user ID
   * Returns null if not authenticated
   */
  getCurrentUserId(): Promise<string | null>

  /**
   * Set the user context for RLS (Row Level Security)
   * Only relevant for providers with RLS support (Supabase, PostgreSQL)
   */
  setUserContext(userId: string): void

  // -------------------------------------------------------------------------
  // HEALTH CHECK
  // -------------------------------------------------------------------------

  /**
   * Check if database connection is healthy
   */
  ping(): Promise<boolean>
}

// ============================================================================
// DATABASE PROVIDER TYPE
// ============================================================================

export type DatabaseProvider = 'supabase' | 'postgresql' | 'planetscale'

// ============================================================================
// DATABASE FACTORY OPTIONS
// ============================================================================

export interface DatabaseFactoryOptions {
  provider: DatabaseProvider

  // Connection options (provider-specific)
  connectionString?: string
  url?: string
  apiKey?: string

  // Optional: Service role key (for admin operations)
  serviceRoleKey?: string

  // Optional: Enable debug logging
  debug?: boolean
}
