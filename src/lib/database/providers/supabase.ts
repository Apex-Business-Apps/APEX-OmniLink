/**
 * SUPABASE DATABASE PROVIDER
 *
 * Implementation of IDatabase interface for Supabase
 * Wraps Supabase client with generic database interface
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import type {
  IDatabase,
  QueryFilter,
  QueryOptions,
  DatabaseResult,
  DatabaseListResult,
} from '../interface'

// ============================================================================
// SUPABASE PROVIDER
// ============================================================================

export class SupabaseDatabase implements IDatabase {
  private client: SupabaseClient<Database>
  private userContext: string | null = null
  private debug: boolean

  constructor(options: {
    url: string
    apiKey: string
    serviceRoleKey?: string
    debug?: boolean
  }) {
    const key = options.serviceRoleKey || options.apiKey

    this.client = createClient<Database>(options.url, key, {
      auth: {
        storage: typeof window !== 'undefined' ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    })

    this.debug = options.debug || false

    if (this.debug) {
      console.log('[SupabaseDatabase] Initialized with URL:', options.url)
    }
  }

  // -------------------------------------------------------------------------
  // HELPER: Apply filters to query
  // -------------------------------------------------------------------------

  private applyFilters<_T = unknown>(query: unknown, filters?: QueryFilter[]) {
    if (!filters || filters.length === 0) return query

    let modifiedQuery = query

    for (const filter of filters) {
      switch (filter.operator) {
        case '=':
          modifiedQuery = modifiedQuery.eq(filter.column, filter.value)
          break
        case '!=':
          modifiedQuery = modifiedQuery.neq(filter.column, filter.value)
          break
        case '>':
          modifiedQuery = modifiedQuery.gt(filter.column, filter.value)
          break
        case '>=':
          modifiedQuery = modifiedQuery.gte(filter.column, filter.value)
          break
        case '<':
          modifiedQuery = modifiedQuery.lt(filter.column, filter.value)
          break
        case '<=':
          modifiedQuery = modifiedQuery.lte(filter.column, filter.value)
          break
        case 'in':
          modifiedQuery = modifiedQuery.in(
            filter.column,
            Array.isArray(filter.value) ? filter.value : [filter.value]
          )
          break
        case 'like':
          modifiedQuery = modifiedQuery.like(filter.column, filter.value as string)
          break
        case 'ilike':
          modifiedQuery = modifiedQuery.ilike(filter.column, filter.value as string)
          break
        default:
          console.warn(`[SupabaseDatabase] Unknown operator: ${filter.operator}`)
      }
    }

    return modifiedQuery
  }

  // -------------------------------------------------------------------------
  // HELPER: Apply query options
  // -------------------------------------------------------------------------

  private applyOptions<_T = unknown>(query: unknown, options?: QueryOptions) {
    let modifiedQuery = query

    // Apply filters
    if (options?.filters) {
      modifiedQuery = this.applyFilters(modifiedQuery, options.filters)
    }

    // Apply ordering
    if (options?.orderBy) {
      modifiedQuery = modifiedQuery.order(
        options.orderBy.column,
        { ascending: options.orderBy.ascending ?? true }
      )
    }

    // Apply select (specific columns)
    // Note: In Supabase, select should be applied first, so this is a limitation
    // For now, we'll document that select should be handled differently

    // Apply limit/offset
    if (options?.limit !== undefined) {
      const offset = options?.offset || 0
      modifiedQuery = modifiedQuery.range(offset, offset + options.limit - 1)
    } else if (options?.offset !== undefined) {
      // Offset without limit - use large limit as workaround
      modifiedQuery = modifiedQuery.range(options.offset, options.offset + 999)
    }

    return modifiedQuery
  }

  // -------------------------------------------------------------------------
  // HELPER: Format select columns
  // -------------------------------------------------------------------------

  private formatSelect(columns?: string[]): string {
    if (!columns || columns.length === 0) {
      return '*'
    }
    return columns.join(',')
  }

  // -------------------------------------------------------------------------
  // QUERY OPERATIONS
  // -------------------------------------------------------------------------

  async findById<T>(
    table: string,
    id: string,
    options?: { select?: string[] }
  ): Promise<DatabaseResult<T>> {
    try {
      const select = this.formatSelect(options?.select)
      const { data, error } = await this.client
        .from(table)
        .select(select)
        .eq('id', id)
        .single()

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data: data as T, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  async find<T>(
    table: string,
    options?: QueryOptions
  ): Promise<DatabaseListResult<T>> {
    try {
      const select = this.formatSelect(options?.select)
      let query = this.client.from(table).select(select, { count: 'exact' })

      query = this.applyOptions(query, options)

      const { data, error, count } = await query

      if (error) {
        return { data: null, error: new Error(error.message), count: null }
      }

      return { data: data as T[], error: null, count }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
        count: null,
      }
    }
  }

  async findOne<T>(
    table: string,
    options?: QueryOptions
  ): Promise<DatabaseResult<T>> {
    try {
      const select = this.formatSelect(options?.select)
      let query = this.client.from(table).select(select)

      query = this.applyOptions(query, options)

      const { data, error } = await query.limit(1).single()

      if (error) {
        // Handle "no rows" error gracefully
        if (error.code === 'PGRST116') {
          return { data: null, error: null }
        }
        return { data: null, error: new Error(error.message) }
      }

      return { data: data as T, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  async count(
    table: string,
    options?: { filters?: QueryFilter[] }
  ): Promise<DatabaseResult<number>> {
    try {
      let query = this.client
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (options?.filters) {
        query = this.applyFilters(query, options.filters)
      }

      const { count, error } = await query

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data: count || 0, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  // -------------------------------------------------------------------------
  // MUTATION OPERATIONS
  // -------------------------------------------------------------------------

  async insert<T>(
    table: string,
    data: Partial<T>
  ): Promise<DatabaseResult<T>> {
    try {
      const { data: result, error } = await this.client
        .from(table)
        .insert(data as unknown)
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data: result as T, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  async insertMany<T>(
    table: string,
    data: Partial<T>[]
  ): Promise<DatabaseListResult<T>> {
    try {
      const { data: result, error } = await this.client
        .from(table)
        .insert(data as unknown[])
        .select()

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data: result as T[], error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  async update<T>(
    table: string,
    data: Partial<T>,
    options?: { filters?: QueryFilter[] }
  ): Promise<DatabaseListResult<T>> {
    try {
      let query = this.client.from(table).update(data as unknown)

      if (options?.filters) {
        query = this.applyFilters(query, options.filters)
      }

      const { data: result, error } = await query.select()

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data: result as T[], error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  async updateById<T>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<DatabaseResult<T>> {
    try {
      const { data: result, error } = await this.client
        .from(table)
        .update(data as unknown)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data: result as T, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  async delete(
    table: string,
    options?: { filters?: QueryFilter[] }
  ): Promise<DatabaseResult<boolean>> {
    try {
      let query = this.client.from(table).delete()

      if (options?.filters) {
        query = this.applyFilters(query, options.filters)
      } else {
        // Safety: Don't allow deleting all rows without filters
        return {
          data: null,
          error: new Error('Delete operation requires filters to prevent accidental data loss'),
        }
      }

      const { error } = await query

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data: true, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  async deleteById(
    table: string,
    id: string
  ): Promise<DatabaseResult<boolean>> {
    try {
      const { error } = await this.client
        .from(table)
        .delete()
        .eq('id', id)

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data: true, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  // -------------------------------------------------------------------------
  // RAW SQL
  // -------------------------------------------------------------------------

  async raw<T>(
    query: string,
    params?: unknown[]
  ): Promise<DatabaseListResult<T>> {
    try {
      // Supabase doesn't have direct raw SQL API in client library
      // Use RPC function as workaround
      const { data, error } = await this.client.rpc('execute_sql' as unknown, {
        query_text: query,
        query_params: params || [],
      })

      if (error) {
        return {
          data: null,
          error: new Error(`Raw SQL execution failed: ${error.message}`),
        }
      }

      return { data: data as T[], error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  // -------------------------------------------------------------------------
  // TRANSACTIONS
  // -------------------------------------------------------------------------

  async transaction<T>(
    callback: (db: IDatabase) => Promise<T>
  ): Promise<DatabaseResult<T>> {
    try {
      // Supabase doesn't support transactions in client library
      // This is a limitation - would need to use PostgreSQL directly
      // For now, execute callback without transaction isolation
      console.warn(
        '[SupabaseDatabase] Transactions not supported in Supabase client library. Executing without transaction isolation.'
      )

      const result = await callback(this)
      return { data: result, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  // -------------------------------------------------------------------------
  // AUTH INTEGRATION
  // -------------------------------------------------------------------------

  async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user }, error } = await this.client.auth.getUser()

      if (error || !user) {
        return null
      }

      return user.id
    } catch (err) {
      console.error('[SupabaseDatabase] Error getting current user:', err)
      return null
    }
  }

  setUserContext(userId: string): void {
    this.userContext = userId
    // In Supabase, RLS is handled automatically via JWT
    // This method is for compatibility with other providers
  }

  // -------------------------------------------------------------------------
  // STORAGE OPERATIONS
  // -------------------------------------------------------------------------

  async uploadFile(
    bucket: string,
    path: string,
    file: File | Blob,
    options?: { contentType?: string; cacheControl?: string }
  ): Promise<DatabaseResult<string>> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(path, file, {
          contentType: options?.contentType,
          cacheControl: options?.cacheControl || '3600',
          upsert: false,
        })

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      // Get public URL
      const { data: { publicUrl } } = this.client.storage
        .from(bucket)
        .getPublicUrl(data.path)

      return { data: publicUrl, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  async downloadFile(
    bucket: string,
    path: string
  ): Promise<DatabaseResult<Blob>> {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .download(path)

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  async deleteFile(
    bucket: string,
    path: string
  ): Promise<DatabaseResult<boolean>> {
    try {
      const { error } = await this.client.storage
        .from(bucket)
        .remove([path])

      if (error) {
        return { data: null, error: new Error(error.message) }
      }

      return { data: true, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  getFileUrl(bucket: string, path: string): string {
    const { data: { publicUrl } } = this.client.storage
      .from(bucket)
      .getPublicUrl(path)

    return publicUrl
  }

  // -------------------------------------------------------------------------
  // REALTIME SUBSCRIPTIONS
  // -------------------------------------------------------------------------

  async subscribe<T>(
    table: string,
    callback: (event: 'INSERT' | 'UPDATE' | 'DELETE', record: T) => void,
    options?: { filters?: QueryFilter[] }
  ): Promise<() => void> {
    try {
      const channel = this.client
        .channel(`${table}_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          (payload) => {
            const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
            const record = payload.new || payload.old

            // Apply filters client-side (limitation of Supabase realtime)
            if (options?.filters && options.filters.length > 0) {
              const matches = options.filters.every(filter => {
                const value = (record as unknown)[filter.column]
                switch (filter.operator) {
                  case '=':
                    return value === filter.value
                  case '!=':
                    return value !== filter.value
                  case '>':
                    return value > filter.value
                  case '>=':
                    return value >= filter.value
                  case '<':
                    return value < filter.value
                  case '<=':
                    return value <= filter.value
                  case 'in':
                    return Array.isArray(filter.value)
                      ? filter.value.includes(value)
                      : value === filter.value
                  default:
                    return true
                }
              })

              if (!matches) {
                return
              }
            }

            callback(eventType, record as T)
          }
        )
        .subscribe()

      // Return unsubscribe function
      return () => {
        this.client.removeChannel(channel)
      }
    } catch (err) {
      console.error('[SupabaseDatabase] Error subscribing to changes:', err)
      // Return no-op unsubscribe function
      return () => {}
    }
  }

  // -------------------------------------------------------------------------
  // HEALTH CHECK
  // -------------------------------------------------------------------------

  async ping(): Promise<boolean> {
    try {
      // Simple query to check database connectivity
      const { error } = await this.client
        .from('health_checks')
        .select('id')
        .limit(1)

      return !error
    } catch (err) {
      console.error('[SupabaseDatabase] Ping failed:', err)
      return false
    }
  }
}
