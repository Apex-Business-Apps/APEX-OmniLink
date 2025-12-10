/**
 * Sentry initialization for production error tracking and performance monitoring
 *
 * Setup Instructions:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new React project
 * 3. Add VITE_SENTRY_DSN to your .env file
 * 4. (Optional) Add VITE_SENTRY_ENVIRONMENT (e.g., 'production', 'staging')
 * 5. Deploy and monitor errors at sentry.io
 *
 * Free Tier: 5,000 errors/month, 10,000 performance transactions/month
 */

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export async function initializeSentry(): Promise<void> {
  const sentryDSN = import.meta.env.VITE_SENTRY_DSN;

  // Skip if DSN not configured
  if (!sentryDSN) {
    console.warn(
      '⚠️ Sentry DSN not configured. Add VITE_SENTRY_DSN to .env for production monitoring.'
    );
    return;
  }

  try {
    // Dynamically import Sentry to reduce initial bundle size
    const Sentry = await import('@sentry/react');

    const config: SentryConfig = {
      dsn: sentryDSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'production',
      release: import.meta.env.VITE_APP_VERSION,

      // Performance Monitoring
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in production, 100% in dev

      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    };

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,

      integrations: [
        // Browser Tracing for performance monitoring
        Sentry.browserTracingIntegration({
          // Track route changes
          enableInp: true,
        }),

        // Session Replay for debugging
        Sentry.replayIntegration({
          maskAllText: true, // Protect user privacy
          blockAllMedia: true, // Don't record media
        }),

        // Breadcrumbs for context
        Sentry.breadcrumbsIntegration({
          console: true,
          dom: true,
          fetch: true,
          history: true,
          sentry: true,
          xhr: true,
        }),
      ],

      // Performance Monitoring
      tracesSampleRate: config.tracesSampleRate,

      // Session Replay
      replaysSessionSampleRate: config.replaysSessionSampleRate,
      replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,

      // Filter out known non-critical errors
      beforeSend(event, hint) {
        const error = hint.originalException;

        // Ignore non-error exceptions
        if (!error) return event;

        // Ignore known browser extension errors
        if (
          error instanceof Error &&
          (error.message.includes('Extension context invalidated') ||
            error.message.includes('ResizeObserver loop') ||
            error.message.includes('Non-Error'))
        ) {
          return null;
        }

        return event;
      },

      // Ignore certain URLs from tracking
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'chrome-extension://',
        'moz-extension://',
        // Network errors
        'NetworkError',
        'Network request failed',
        // Random noise
        'ResizeObserver loop limit exceeded',
      ],
    });

    // Set up global error boundary
    window.Sentry = Sentry;

    console.log('✅ Sentry monitoring initialized');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Set user context for Sentry
 */
export function setSentryUser(userId: string, email?: string, username?: string): void {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.setUser({
      id: userId,
      email,
      username,
    });
  }
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearSentryUser(): void {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.setUser(null);
  }
}

/**
 * Add custom context to Sentry
 */
export function setSentryContext(key: string, value: any): void {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.setContext(key, value);
  }
}
