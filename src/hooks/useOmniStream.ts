/**
 * useOmniStream Hook - Hybrid Client for Zero-Flicker UX
 *
 * Implements the "Fetch-Then-Subscribe" pattern:
 * 1. Fetch: Load existing events from database (eternal)
 * 2. Subscribe: Listen for new events via Realtime (ephemeral)
 * 3. Merge: Deduplicate by ID, sort by sequence_id
 *
 * Why both? Realtime is ephemeral (can miss events on reconnect).
 * Database is eternal (source of truth). You need both.
 *
 * Author: APEX CTO
 * Date: 2026-01-25
 * Architecture: Event Sourcing with Realtime Sync
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AgentEvent } from '@/lib/types/omniverse';

interface UseOmniStreamOptions {
  /** Enable auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Maximum events to keep in memory (default: 100) */
  maxEvents?: number;
}

interface UseOmniStreamReturn {
  /** Current events, sorted by sequence_id */
  events: AgentEvent[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Manually refetch events */
  refetch: () => Promise<void>;
  /** Clear all events */
  clear: () => void;
  /** Connection status */
  isConnected: boolean;
}

/**
 * Hook for streaming agent events with fetch-then-subscribe pattern.
 *
 * @param sessionId - The session ID to subscribe to
 * @param options - Configuration options
 * @returns Event stream state and controls
 */
export function useOmniStream(
  sessionId: string | null,
  options: UseOmniStreamOptions = {}
): UseOmniStreamReturn {
  const { autoFetch = true, maxEvents = 100 } = options;

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const eventMapRef = useRef<Map<string, AgentEvent>>(new Map());

  /**
   * Merge a new event into the state, deduplicating by ID.
   * Maintains sorted order by sequence_id.
   */
  const mergeEvent = useCallback(
    (newEvent: AgentEvent) => {
      eventMapRef.current.set(newEvent.id, newEvent);

      // Convert map to sorted array
      const sortedEvents = Array.from(eventMapRef.current.values())
        .sort((a, b) => a.sequence_id - b.sequence_id)
        .slice(-maxEvents); // Keep only last N events

      setEvents(sortedEvents);
    },
    [maxEvents]
  );

  /**
   * Merge multiple events (batch operation).
   */
  const mergeEvents = useCallback(
    (newEvents: AgentEvent[]) => {
      for (const event of newEvents) {
        eventMapRef.current.set(event.id, event);
      }

      const sortedEvents = Array.from(eventMapRef.current.values())
        .sort((a, b) => a.sequence_id - b.sequence_id)
        .slice(-maxEvents);

      setEvents(sortedEvents);
    },
    [maxEvents]
  );

  /**
   * Fetch existing events from the database.
   * Step A of the Fetch-Then-Subscribe pattern.
   */
  const fetchEvents = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        // Type assertion for dynamic table access
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('agent_events' as any)
        .select('*')
        .eq('session_id', sessionId)
        .order('sequence_id', { ascending: true })
        .limit(maxEvents);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (data && Array.isArray(data)) {
        mergeEvents(data as AgentEvent[]);
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to fetch events');
      setError(error);
      console.error('[useOmniStream] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, maxEvents, mergeEvents]);

  /**
   * Subscribe to realtime changes.
   * Step B of the Fetch-Then-Subscribe pattern.
   */
  const subscribe = useCallback(() => {
    if (!sessionId) return;

    // Unsubscribe from any existing channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`agent_events_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_events',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newEvent = payload.new as AgentEvent;
          mergeEvent(newEvent);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_events',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const updatedEvent = payload.new as AgentEvent;
          mergeEvent(updatedEvent);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          console.error('[useOmniStream] Channel error');
          setError(new Error('Realtime connection failed'));
        }
      });

    channelRef.current = channel;
  }, [sessionId, mergeEvent]);

  /**
   * Clear all events and reset state.
   */
  const clear = useCallback(() => {
    eventMapRef.current.clear();
    setEvents([]);
    setError(null);
  }, []);

  /**
   * Effect: Initialize on session change.
   * Implements the full Fetch-Then-Subscribe sequence.
   */
  useEffect(() => {
    if (!sessionId) {
      clear();
      return;
    }

    // Step A: Fetch existing events
    if (autoFetch) {
      fetchEvents();
    }

    // Step B: Subscribe to new events
    subscribe();

    // Cleanup on unmount or session change
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId, autoFetch, fetchEvents, subscribe, clear]);

  return {
    events,
    loading,
    error,
    refetch: fetchEvents,
    clear,
    isConnected,
  };
}

export default useOmniStream;
