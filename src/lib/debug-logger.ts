/**
 * Debug logging utility for instrumentation
 * Centralizes logging logic to reduce code duplication
 */

const LOG_ENDPOINT = 'http://127.0.0.1:7245/ingest/42dac81a-117c-4f9f-9adc-d4ba4a181cf2';
const SESSION_ID = 'debug-session';
const RUN_ID = 'run2';

interface LogData {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
}

/**
 * Send a debug log entry
 * Silently fails if logging server is unavailable
 */
export function debugLog({ location, message, data, hypothesisId }: LogData): void {
  try {
    const payload = {
      location,
      message,
      data: { ...data, timestamp: Date.now() },
      timestamp: Date.now(),
      sessionId: SESSION_ID,
      runId: RUN_ID,
      hypothesisId: hypothesisId || 'A',
    };

    fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => {
      // Only log to console in development
      if (import.meta.env.DEV) {
        console.error('Log fetch failed:', err);
      }
    });
  } catch (e) {
    // Only log to console in development
    if (import.meta.env.DEV) {
      console.error('Log setup failed:', e);
    }
  }
}

/**
 * Create a debug log wrapper for a specific location
 * Useful for component-level logging
 */
export function createDebugLogger(location: string, hypothesisId?: string) {
  return (message: string, data?: Record<string, unknown>) => {
    debugLog({ location, message, data, hypothesisId });
  };
}

/**
 * Log an error via the debug logger
 * Provides a lightweight fallback when monitoring is unavailable
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const data =
    error instanceof Error
      ? { stack: error.stack, ...context }
      : { error, ...context };

  debugLog({ location: 'logError', message, data });

  if (import.meta.env.DEV) {
    console.error('Debug logError:', error, context);
  }
}
