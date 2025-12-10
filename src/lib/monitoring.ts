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
  
  // TODO: Integrate with your monitoring service
  // Example: Sentry.captureException(error, { extra: context });
  
  // Store in local storage for debugging (production)
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
  
  // TODO: Integrate with your monitoring service
  // Example: analytics.track('performance', event);
}

/**
 * Log analytics event
 */
export function logAnalyticsEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  console.log('📈 Analytics:', eventName, properties);
  
  // TODO: Integrate with your analytics service
  // Example: analytics.track(eventName, properties);
}

/**
 * Log security event
 */
export function logSecurityEvent(
  eventType: 'auth_failed' | 'rate_limit' | 'suspicious_activity' | 'csrf_attempt',
  details?: Record<string, any>
): void {
  console.warn('🔒 Security Event:', eventType, details);
  
  // TODO: Integrate with your security monitoring
  // Example: securityMonitor.log(eventType, details);
  
  // Store critical security events
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
