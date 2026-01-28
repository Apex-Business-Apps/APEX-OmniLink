/**
 * PWA Analytics - Track Progressive Web App installation and usage metrics
 * Privacy-first: No PII, minimal telemetry, user control
 */

import { logAnalyticsEvent } from './monitoring';

// BeforeInstallPromptEvent interface (not in standard TypeScript lib)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PWAInstallMetrics {
  timestamp: string;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  standalone: boolean;
  displayMode: 'standalone' | 'browser' | 'fullscreen' | 'minimal-ui';
  installSource: 'prompt' | 'manual' | 'unknown';
  userAgent: string;
}

export interface PWAUsageMetrics {
  sessionStart: string;
  sessionDuration: number;
  pagesViewed: number;
  featuresUsed: string[];
  offlineTime: number;
  onlineTime: number;
}

/**
 * Detect platform from user agent
 */
function detectPlatform(): PWAInstallMetrics['platform'] {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/windows|mac|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

/**
 * Get current display mode
 */
function getDisplayMode(): PWAInstallMetrics['displayMode'] {
  if (globalThis.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  if (globalThis.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  if (globalThis.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui';
  }
  return 'browser';
}

/**
 * Track PWA installation via beforeinstallprompt event
 */
export function trackPWAInstallPrompt() {
  globalThis.addEventListener('beforeinstallprompt', (e) => {
    void logAnalyticsEvent('pwa.install.prompt_shown', {
      platform: detectPlatform(),
      timestamp: new Date().toISOString(),
    });

    // Track user response to prompt
    const promptEvent = e as BeforeInstallPromptEvent;
    void promptEvent.userChoice.then((choiceResult) => {
      void logAnalyticsEvent('pwa.install.prompt_response', {
        outcome: choiceResult.outcome, // 'accepted' or 'dismissed'
        platform: detectPlatform(),
        timestamp: new Date().toISOString(),
      });
    });
  });
}

/**
 * Track PWA installation completion
 */
export function trackPWAInstalled() {
  globalThis.addEventListener('appinstalled', () => {
    const metrics: PWAInstallMetrics = {
      timestamp: new Date().toISOString(),
      platform: detectPlatform(),
      standalone: getDisplayMode() === 'standalone',
      displayMode: getDisplayMode(),
      installSource: 'prompt',
      userAgent: navigator.userAgent,
    };

    void logAnalyticsEvent('pwa.install.completed', metrics);

    // Store install date for future analytics
    try {
      localStorage.setItem('omnilink_pwa_installed', new Date().toISOString());
    } catch (err) {
      console.warn('Failed to store PWA install date:', err);
    }
  });
}

/**
 * Track PWA launch (when opened from home screen)
 */
export function trackPWALaunch() {
  const isStandalone = getDisplayMode() === 'standalone';
  const isPWASource = globalThis.location.search.includes('source=pwa');

  if (isStandalone || isPWASource) {
    void logAnalyticsEvent('pwa.launch', {
      standalone: isStandalone,
      platform: detectPlatform(),
      displayMode: getDisplayMode(),
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Track service worker lifecycle events
 */
export function trackServiceWorkerEvents() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      void logAnalyticsEvent('pwa.sw.controller_changed', {
        timestamp: new Date().toISOString(),
      });
    });

    // Track service worker updates
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              void logAnalyticsEvent('pwa.sw.update_available', {
                timestamp: new Date().toISOString(),
              });
            }
          });
        }
      });
    });
  }
}

/**
 * Track offline/online transitions
 */
export function trackNetworkStatus() {
  let offlineStart: number | null = null;
  let onlineStart: number = Date.now();

  globalThis.addEventListener('offline', () => {
    offlineStart = Date.now();
    void logAnalyticsEvent('pwa.network.offline', {
      timestamp: new Date().toISOString(),
      onlineDuration: Date.now() - onlineStart,
    });
  });

  globalThis.addEventListener('online', () => {
    if (offlineStart) {
      const offlineDuration = Date.now() - offlineStart;
      void logAnalyticsEvent('pwa.network.online', {
        timestamp: new Date().toISOString(),
        offlineDuration,
      });
      offlineStart = null;
      onlineStart = Date.now();
    }
  });
}

/**
 * Track PWA feature usage (voice, translation, dark mode, etc.)
 */
export function trackFeatureUsage(feature: string, metadata?: Record<string, unknown>) {
  void logAnalyticsEvent(`pwa.feature.${feature}`, {
    timestamp: new Date().toISOString(),
    platform: detectPlatform(),
    standalone: getDisplayMode() === 'standalone',
    ...metadata,
  });
}

/**
 * Track PWA uninstall (via service worker unregister)
 */
export function trackPWAUninstall() {
  // Note: There's no reliable way to detect PWA uninstall on all platforms
  // This tracks service worker unregistration as a proxy
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        const originalUnregister = registration.unregister.bind(registration);
        registration.unregister = async () => {
          void logAnalyticsEvent('pwa.uninstall.sw_unregistered', {
            timestamp: new Date().toISOString(),
            platform: detectPlatform(),
          });
          return originalUnregister();
        };
      });
    });
  }
}

/**
 * Initialize all PWA analytics tracking
 * Call this once on app startup
 */
export function initializePWAAnalytics() {
  // Only track if user hasn't opted out
  const hasOptedOut = localStorage.getItem('omnilink_analytics_optout') === 'true';
  if (hasOptedOut) {
    console.log('[PWA Analytics] User opted out, skipping initialization');
    return;
  }

  trackPWAInstallPrompt();
  trackPWAInstalled();
  trackPWALaunch();
  trackServiceWorkerEvents();
  trackNetworkStatus();

  // Track session metrics
  const sessionStart = Date.now();
  const featuresUsed = new Set<string>();

  // Track page views
  let pagesViewed = 1; // Initial page
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    pagesViewed++;
    return originalPushState.apply(history, args);
  };

  // Track session end
  globalThis.addEventListener('beforeunload', () => {
    const sessionDuration = Date.now() - sessionStart;
    void logAnalyticsEvent('pwa.session.end', {
      duration: sessionDuration,
      pagesViewed,
      featuresUsed: Array.from(featuresUsed),
      timestamp: new Date().toISOString(),
    });
  });

  console.log('[PWA Analytics] Initialized successfully');
}

/**
 * Opt user out of analytics
 */
export function optOutOfAnalytics() {
  localStorage.setItem('omnilink_analytics_optout', 'true');
  console.log('[PWA Analytics] User opted out');
}

/**
 * Opt user back into analytics
 */
export function optInToAnalytics() {
  localStorage.removeItem('omnilink_analytics_optout');
  console.log('[PWA Analytics] User opted in');
}

/**
 * Check if user has opted out
 */
export function hasOptedOutOfAnalytics(): boolean {
  return localStorage.getItem('omnilink_analytics_optout') === 'true';
}
