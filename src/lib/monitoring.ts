/**
 * Production monitoring and observability utilities
 * Integrates with Sentry dynamically (no hard dependency) when DSN is provided.
 */

import { appConfig, getEnvironment } from './config';

let sentry: any | null = null;
let sentryInitialized = false;

export interface ErrorContext {
  userId?: string;
  route?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceEvent {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

async function ensureSentry() {
  if (sentryInitialized || sentry) return sentry;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return null;

  try {
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
    console.log('✅ Sentry monitoring initialized');
  } catch (error) {
    console.warn('Sentry initialization failed; continuing without Sentry', error);
  }

  return sentry;
}

function persistLog(key: string, entry: any, max: number) {
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
  console.error('🚨 Error:', error.message, context);

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
  console.log('📊 Performance:', event);
  persistLog('perf_logs', event, 100);
}

/**
 * Log analytics event
 */
export async function logAnalyticsEvent(
  eventName: string,
  properties?: Record<string, any>
): Promise<void> {
  console.log('📈 Analytics:', eventName, properties);

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
  details?: Record<string, any>
): Promise<void> {
  console.warn('🔒 Security Event:', eventType, details);

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
  metadata?: Record<string, any>
): void {
  void logAnalyticsEvent('user_action', { action, ...metadata });
}

/**
 * Initialize monitoring on app start
 */
export function initializeMonitoring(): void {
  void ensureSentry();

  // Set up global error handler
  window.addEventListener('error', (event) => {
    logError(new Error(event.message), {
      route: window.location.pathname,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Set up unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    logError(new Error(event.reason), {
      route: window.location.pathname,
      metadata: { type: 'unhandled_promise' },
    });
  });

  console.log('✅ Monitoring initialized');
}

/**
 * Get all error logs (for debugging)
 */
export function getErrorLogs(): any[] {
  try {
    return JSON.parse(localStorage.getItem('error_logs') || '[]');
  } catch {
    return [];
  }
}

/**
 * Get all security logs (for debugging)
 */
export function getSecurityLogs(): any[] {
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
  console.log('🗑️ Logs cleared');
}
