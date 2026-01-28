/**
 * Production monitoring and observability utilities
 * Integrates with Sentry dynamically (no hard dependency) when DSN is provided.
 * Includes OmniSentry for client-side self-healing monitoring.
 */

import { appConfig, getEnvironment } from './config';
import { createDebugLogger } from './debug-logger';
import { initializeOmniSentry } from './omni-sentry';

// Re-export OmniSentry for external access
export { getHealthStatus, reportError as reportOmniError, withResilience } from './omni-sentry';

let sentry: unknown = null;
let sentryInitialized = false;

export interface ErrorContext {
  userId?: string;
  route?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceEvent {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

async function ensureSentry() {
  if (sentryInitialized || sentry) return sentry;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return null;

  try {
    // Dynamic import from CDN - TypeScript can't resolve these at compile time
     
    sentry = await import('https://esm.sh/@sentry/browser@7.120.1');
     
    const { BrowserTracing } = await import('https://esm.sh/@sentry/tracing@7.120.1');

     
    sentry.init({
      dsn,
      environment: getEnvironment(),
      release: `${appConfig.name}@${appConfig.version}`,
       
      integrations: [new BrowserTracing()],
      tracesSampleRate: 0.2,
    });
    sentryInitialized = true;
    if (import.meta.env.DEV) {
      console.log('✅ Sentry monitoring initialized');
    }
  } catch (error) {
    console.warn('Sentry initialization failed; continuing without Sentry', error);
  }

  return sentry;
}

function persistLog(key: string, entry: unknown, max: number) {
  try {
    const logs = JSON.parse(localStorage.getItem(key) || '[]');
    logs.push(entry);
    if (logs.length > max) logs.shift();
    localStorage.setItem(key, JSON.stringify(logs));
  } catch {
    // non-fatal
  }
}

/**
 * Log error to monitoring service
 */
export async function logError(error: Error, context?: ErrorContext): Promise<void> {
  if (import.meta.env.DEV) {
    console.error('🚨 Error:', error.message, context);
  }

  const entry = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  };
  persistLog('error_logs', entry, 50);

  const s = await ensureSentry();
  if (s?.captureException) {
    s.captureException(error, { extra: context });
  }
}

/**
 * Log performance event
 */
export function logPerformance(event: PerformanceEvent): void {
  if (import.meta.env.DEV) {
    console.log('📊 Performance:', event);
  }
  persistLog('perf_logs', event, 100);
}

/**
 * Log analytics event
 */
export async function logAnalyticsEvent(
  eventName: string,
  properties?: Record<string, unknown>
): Promise<void> {
  if (import.meta.env.DEV) {
    console.log('📈 Analytics:', eventName, properties);
  }

  const s = await ensureSentry();
  if (s?.addBreadcrumb) {
    s.addBreadcrumb({
      category: 'analytics',
      message: eventName,
      data: properties,
      level: 'info',
    });
  }
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  eventType: 'auth_failed' | 'rate_limit' | 'suspicious_activity' | 'csrf_attempt',
  details?: Record<string, unknown>
): Promise<void> {
  if (import.meta.env.DEV) {
    console.warn('🔒 Security Event:', eventType, details);
  }

  const entry = {
    type: eventType,
    details,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  };
  persistLog('security_logs', entry, 100);

  const s = await ensureSentry();
  if (s?.addBreadcrumb) {
    s.addBreadcrumb({
      category: 'security',
      message: eventType,
      data: details,
      level: 'warning',
    });
  }
}

/**
 * Track user action
 */
export function trackUserAction(
  action: string,
  metadata?: Record<string, unknown>
): void {
  void logAnalyticsEvent('user_action', { action, ...metadata });
}

/**
 * Initialize monitoring on app start
 */
export function initializeMonitoring(): void {
  const log = createDebugLogger('monitoring.ts', 'A');
  
  // #region agent log
  log('initializeMonitoring entry');
  // #endregion
  
  try {
    // Initialize OmniSentry (self-healing, always-on, non-intrusive)
    initializeOmniSentry();
    
    void ensureSentry();

    // #region agent log
    log('Before error handlers');
    // #endregion

    // Set up global error handler
    globalThis.addEventListener('error', (event) => {
      // #region agent log
      log('Global error caught', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
      });
      // #endregion
      logError(new Error(event.message), {
        route: globalThis.location.pathname,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Set up unhandled promise rejection handler
    globalThis.addEventListener('unhandledrejection', (event) => {
      // #region agent log
      log('Unhandled promise rejection', {
        reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
      });
      // #endregion
      const errorMessage = event.reason instanceof Error ? event.reason.message : String(event.reason);
      logError(new Error(errorMessage), {
        route: globalThis.location.pathname,
        metadata: { type: 'unhandled_promise' },
      });
    });

    // #region agent log
    log('Monitoring initialized successfully');
    // #endregion
    if (import.meta.env.DEV) {
      console.log('✅ Monitoring initialized');
    }
  } catch (error) {
    // #region agent log
    log('Monitoring initialization error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    // #endregion
    console.error('Failed to initialize monitoring:', error);
  }
}

/**
 * Get all error logs (for debugging)
 */
export function getErrorLogs(): unknown[] {
  try {
    return JSON.parse(localStorage.getItem('error_logs') || '[]');
  } catch {
    return [];
  }
}

/**
 * Get all security logs (for debugging)
 */
export function getSecurityLogs(): unknown[] {
  try {
    return JSON.parse(localStorage.getItem('security_logs') || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  localStorage.removeItem('error_logs');
  localStorage.removeItem('security_logs');
  localStorage.removeItem('perf_logs');
  if (import.meta.env.DEV) {
    console.log('🗑️ Logs cleared');
  }
}
