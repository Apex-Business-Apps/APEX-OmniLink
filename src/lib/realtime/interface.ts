/**
 * REALTIME ABSTRACTION LAYER - INTERFACE
 *
 * Purpose: Provider-agnostic realtime subscription interface for OmniHub
 * Reduces lock-in risk by abstracting realtime/pubsub APIs
 *
 * Supported providers:
 * - Supabase Realtime (current)
 * - PostgreSQL + Debezium/Kafka (future)
 * - AWS AppSync (future)
 * - Pusher/Ably (future)
 *
 * Design principles:
 * 1. Simple subscribe/unsubscribe interface
 * 2. Type-safe event callbacks
 * 3. Provider-agnostic (no Supabase-specific patterns)
 * 4. Easy to test (mockable)
 *
 * ISP Compliance:
 * - Separated from IDatabase (data storage)
 * - Separated from IStorage (file storage)
 * - Single responsibility: realtime subscriptions only
 */

import type { QueryFilter } from '../database/interface'

// ============================================================================
// REALTIME TYPES
// ============================================================================

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface RealtimePayload<T> {
  /** Event type that triggered the callback */
  eventType: RealtimeEvent

  /** New record (for INSERT/UPDATE) */
  new: T | null

  /** Old record (for UPDATE/DELETE) */
  old: T | null

  /** Commit timestamp (if available) */
  commitTimestamp?: string

  /** Schema name (e.g., 'public') */
  schema?: string

  /** Table name */
  table: string
}

export interface SubscriptionOptions {
  /** Filter events by column values */
  filters?: QueryFilter[]

  /** Event types to subscribe to (default: all) */
  events?: RealtimeEvent[]

  /** Schema to subscribe to (default: 'public') */
  schema?: string
}

export interface SubscriptionHandle {
  /** Unique subscription ID */
  id: string

  /** Unsubscribe from this subscription */
  unsubscribe: () => Promise<void>

  /** Check if subscription is active */
  isActive: () => boolean
}

// ============================================================================
// REALTIME INTERFACE
// ============================================================================

/**
 * Generic realtime subscription interface
 * All realtime providers must implement this interface
 */
export interface IRealtime {
  // -------------------------------------------------------------------------
  // SUBSCRIPTION OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Subscribe to changes on a table
   * Returns subscription handle with unsubscribe function
   */
  subscribe<T>(
    table: string,
    callback: (payload: RealtimePayload<T>) => void,
    options?: SubscriptionOptions
  ): Promise<SubscriptionHandle>

  /**
   * Subscribe to multiple tables
   * Returns array of subscription handles
   */
  subscribeMany<T>(
    tables: string[],
    callback: (payload: RealtimePayload<T>) => void,
    options?: SubscriptionOptions
  ): Promise<SubscriptionHandle[]>

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): Promise<void>

  /**
   * Get count of active subscriptions
   */
  getActiveSubscriptionCount(): number

  // -------------------------------------------------------------------------
  // BROADCAST OPERATIONS (Optional - for custom channels)
  // -------------------------------------------------------------------------

  /**
   * Subscribe to a custom broadcast channel
   * Useful for non-database events (e.g., presence, typing indicators)
   */
  subscribeToBroadcast<T>(
    channel: string,
    callback: (payload: T) => void
  ): Promise<SubscriptionHandle>

  /**
   * Broadcast a message to a channel
   * All subscribers on the channel will receive the message
   */
  broadcast<T>(
    channel: string,
    event: string,
    payload: T
  ): Promise<void>

  // -------------------------------------------------------------------------
  // PRESENCE (Optional - for tracking online users)
  // -------------------------------------------------------------------------

  /**
   * Track user presence in a channel
   * Returns presence state and handle
   */
  trackPresence<T>(
    channel: string,
    userState: T
  ): Promise<{
    handle: SubscriptionHandle
    getPresenceState: () => T[]
  }>

  // -------------------------------------------------------------------------
  // CONNECTION MANAGEMENT
  // -------------------------------------------------------------------------

  /**
   * Connect to realtime server
   * Usually called automatically on first subscription
   */
  connect(): Promise<void>

  /**
   * Disconnect from realtime server
   * Unsubscribes from all channels
   */
  disconnect(): Promise<void>

  /**
   * Check if connected to realtime server
   */
  isConnected(): boolean

  /**
   * Check realtime connection health
   */
  ping(): Promise<boolean>
}

// ============================================================================
// REALTIME PROVIDER TYPE
// ============================================================================

export type RealtimeProvider =
  | 'supabase'
  | 'debezium'
  | 'appsync'
  | 'pusher'
  | 'ably'

// ============================================================================
// REALTIME FACTORY OPTIONS
// ============================================================================

export interface RealtimeFactoryOptions {
  provider: RealtimeProvider

  // Supabase-specific
  url?: string
  apiKey?: string

  // Debezium/Kafka-specific
  kafkaBrokers?: string[]
  kafkaGroupId?: string

  // Pusher-specific
  pusherKey?: string
  pusherCluster?: string

  // Ably-specific
  ablyApiKey?: string

  // Common options
  debug?: boolean
  autoReconnect?: boolean
  reconnectInterval?: number
}
