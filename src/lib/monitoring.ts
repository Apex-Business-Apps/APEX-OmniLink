/**
 * Production monitoring and observability utilities
 * Integrate with your monitoring service (Sentry, DataDog, etc.)
 */

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

/**
 * Log error to monitoring service
 */
export function logError(error: Error, context?: ErrorContext): void {
  console.error('🚨 Error:', error.message, context);

  // Integrate with Sentry if available
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    try {
      (window as any).Sentry.captureException(error, {
        extra: context,
        tags: {
          route: context?.route,
          action: context?.action,
        },
        user: context?.userId ? { id: context.userId } : undefined,
      });
    } catch (sentryError) {
      console.warn('Failed to send error to Sentry:', sentryError);
    }
  }

  // Store in local storage for debugging (fallback)
  try {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    };

    const logs = JSON.parse(localStorage.getItem('error_logs') || '[]');
    logs.push(errorLog);

    // Keep only last 50 errors
    if (logs.length > 50) logs.shift();

    localStorage.setItem('error_logs', JSON.stringify(logs));
  } catch (e) {
    // Fail silently
  }
}

/**
 * Log performance event
 */
export function logPerformance(event: PerformanceEvent): void {
  console.log('📊 Performance:', event);

  // Integrate with Sentry Performance Monitoring
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    try {
      const transaction = (window as any).Sentry.startTransaction({
        name: event.name,
        op: 'performance',
      });

      transaction.setMeasurement(event.name, event.duration, 'millisecond');
      transaction.setData('metadata', event.metadata);
      transaction.finish();
    } catch (sentryError) {
      console.warn('Failed to send performance data to Sentry:', sentryError);
    }
  }
}

/**
 * Log analytics event
 */
export function logAnalyticsEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  console.log('📈 Analytics:', eventName, properties);

  // Integrate with analytics service (PostHog, Mixpanel, etc.)
  // For now, use Sentry breadcrumbs for tracking
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    try {
      (window as any).Sentry.addBreadcrumb({
        category: 'analytics',
        message: eventName,
        level: 'info',
        data: properties,
      });
    } catch (sentryError) {
      console.warn('Failed to add Sentry breadcrumb:', sentryError);
    }
  }
}

/**
 * Log security event
 */
export function logSecurityEvent(
  eventType: 'auth_failed' | 'rate_limit' | 'suspicious_activity' | 'csrf_attempt',
  details?: Record<string, any>
): void {
  console.warn('🔒 Security Event:', eventType, details);

  // Integrate with Sentry for security monitoring
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    try {
      (window as any).Sentry.captureMessage(`Security Event: ${eventType}`, {
        level: 'warning',
        tags: {
          security_event: eventType,
        },
        extra: details,
        fingerprint: ['security-event', eventType],
      });
    } catch (sentryError) {
      console.warn('Failed to send security event to Sentry:', sentryError);
    }
  }

  // Store critical security events (fallback)
  try {
    const securityLog = {
      type: eventType,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    logs.push(securityLog);

    if (logs.length > 100) logs.shift();

    localStorage.setItem('security_logs', JSON.stringify(logs));
  } catch (e) {
    // Fail silently
  }
}

/**
 * Track user action
 */
export function trackUserAction(
  action: string,
  metadata?: Record<string, any>
): void {
  logAnalyticsEvent('user_action', { action, ...metadata });
}

/**
 * Initialize monitoring on app start
 */
export function initializeMonitoring(): void {
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
  console.log('🗑️ Logs cleared');
}
