/**
 * MAESTRO Provider
 *
 * React context provider for browser-only compute system.
 * Provides memory, grounding, and execution capabilities.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { isMaestroEnabled, getMaestroConfig, type MaestroConfig } from '../config';
import { initMaestroDb, checkIndexedDbHealth } from '../stores/indexeddb';
import type { MaestroHealthResponse } from '../types';

/**
 * MAESTRO Context
 */
export interface MaestroContextValue {
  enabled: boolean;
  config: MaestroConfig;
  initialized: boolean;
  health: MaestroHealthResponse | null;
  error: Error | null;
}

const MaestroContext = createContext<MaestroContextValue | undefined>(undefined);

/**
 * MAESTRO Provider Props
 */
export interface MaestroProviderProps {
  children: React.ReactNode;
  config?: Partial<MaestroConfig>;
}

/**
 * MAESTRO Provider Component
 *
 * Wraps the app to provide MAESTRO capabilities.
 * If MAESTRO_ENABLED=false, this is a no-op wrapper.
 */
export function MaestroProvider({ children, config: configOverride }: MaestroProviderProps) {
  const enabled = isMaestroEnabled();
  const config = { ...getMaestroConfig(), ...configOverride };

  const [initialized, setInitialized] = useState(false);
  const [health, setHealth] = useState<MaestroHealthResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If MAESTRO is disabled, skip initialization
    if (!enabled) {
      setInitialized(true);
      return;
    }

    // Initialize MAESTRO
    async function initialize() {
      try {
        if (config.debug) {
          console.log('[MAESTRO] Initializing...');
        }

        // Initialize IndexedDB
        await initMaestroDb();

        // Check health
        const idbHealth = await checkIndexedDbHealth();

        // Set initial health status
        setHealth({
          enabled: true,
          status: idbHealth.status === 'ok' ? 'healthy' : 'degraded',
          checks: {
            indexeddb: idbHealth,
            webgpu: { status: 'ok' }, // Placeholder (Phase 2)
            wasm: { status: 'ok' }, // Placeholder (Phase 2)
            service_worker: { status: 'ok' }, // Placeholder (Phase 2)
            sync: { status: 'ok' }, // Placeholder (Phase 4)
          },
          queue_depth: 0,
          dlq_count: 0,
        });

        setInitialized(true);

        if (config.debug) {
          console.log('[MAESTRO] Initialized successfully');
        }
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Unknown initialization error');
        setError(errorObj);
        setInitialized(true); // Still mark as initialized (fail-open for read-only)

        if (config.debug) {
          console.error('[MAESTRO] Initialization failed:', errorObj);
        }
      }
    }

    initialize();
  }, [enabled, config.debug]);

  const contextValue: MaestroContextValue = {
    enabled,
    config,
    initialized,
    health,
    error,
  };

  return <MaestroContext.Provider value={contextValue}>{children}</MaestroContext.Provider>;
}

/**
 * Hook to access MAESTRO context
 *
 * @throws Error if used outside MaestroProvider
 */
export function useMaestroContext(): MaestroContextValue {
  const context = useContext(MaestroContext);

  if (context === undefined) {
    throw new Error('useMaestroContext must be used within MaestroProvider');
  }

  return context;
}
