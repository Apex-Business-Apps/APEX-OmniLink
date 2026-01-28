/**
 * Push Notifications - FCM/APNS support for OmniLink PWA
 * Supports: Web Push API, Firebase Cloud Messaging, Apple Push Notification Service
 */

import { logAnalyticsEvent } from './monitoring';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in globalThis)) {
    throw new Error('Notifications not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  void logAnalyticsEvent('push.permission.requested', {
    permission,
    timestamp: new Date().toISOString(),
  });

  return permission;
}

/**
 * Subscribe to push notifications
 * Returns subscription object to send to backend
 */
export async function subscribeToPushNotifications(vapidPublicKey: string): Promise<PushSubscriptionJSON | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in globalThis)) {
    throw new Error('Push notifications not supported');
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('[Push] Notification permission denied');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;

  // Check if already subscribed
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    // Create new subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    void logAnalyticsEvent('push.subscribed', {
      endpoint: subscription.endpoint,
      timestamp: new Date().toISOString(),
    });
  }

  return subscription.toJSON();
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in globalThis)) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const success = await subscription.unsubscribe();
    void logAnalyticsEvent('push.unsubscribed', {
      success,
      timestamp: new Date().toISOString(),
    });
    return success;
  }

  return false;
}

/**
 * Show a local notification (doesn't require push)
 */
export async function showLocalNotification(payload: NotificationPayload): Promise<void> {
  if (!('Notification' in globalThis)) {
    throw new Error('Notifications not supported');
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon || '/icons/pwa/icon-192.png',
    badge: payload.badge || '/icons/pwa/icon-96.png',
    image: payload.image,
    data: payload.data,
    actions: payload.actions,
    tag: payload.tag,
    requireInteraction: payload.requireInteraction || false,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  });

  void logAnalyticsEvent('push.notification.shown', {
    tag: payload.tag,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle notification click events
 * Add this to service worker
 */
export function setupNotificationClickHandler() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'notification-click') {
      const { action, data } = event.data;

      void logAnalyticsEvent('push.notification.clicked', {
        action,
        timestamp: new Date().toISOString(),
      });

      // Handle different actions
      switch (action) {
        case 'open-dash':
          globalThis.location.href = '/omnidash';
          break;
        case 'open-trace':
          globalThis.location.href = '/omnitrace';
          break;
        case 'open-integrations':
          globalThis.location.href = '/integrations';
          break;
        default:
          if (data?.url) {
            globalThis.location.href = data.url;
          }
      }
    }
  });
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll('-', '+').replaceAll('_', '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.codePointAt(i) || 0;
  }
  return outputArray;
}

/**
 * Get current push subscription status
 */
export async function getPushSubscriptionStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  subscription: PushSubscriptionJSON | null;
}> {
  const supported = 'Notification' in globalThis && 'serviceWorker' in navigator && 'PushManager' in globalThis;

  if (!supported) {
    return {
      supported: false,
      permission: 'default',
      subscribed: false,
      subscription: null,
    };
  }

  const permission = Notification.permission;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    supported: true,
    permission,
    subscribed: !!subscription,
    subscription: subscription?.toJSON() || null,
  };
}

/**
 * Send subscription to backend for storage
 * Backend should store this with user_id for targeted push
 */
export async function syncPushSubscriptionWithBackend(
  subscription: PushSubscriptionJSON,
  userId: string,
  apiUrl: string
): Promise<void> {
  const response = await fetch(`${apiUrl}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      subscription,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync push subscription: ${response.statusText}`);
  }

  void logAnalyticsEvent('push.subscription.synced', {
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Initialize push notifications system
 */
export async function initializePushNotifications(vapidPublicKey?: string): Promise<void> {
  if (!vapidPublicKey) {
    console.warn('[Push] No VAPID key provided, skipping push initialization');
    return;
  }

  const status = await getPushSubscriptionStatus();

  if (!status.supported) {
    console.warn('[Push] Push notifications not supported');
    return;
  }

  setupNotificationClickHandler();

  // If already subscribed, just log status
  if (status.subscribed) {
    console.log('[Push] Already subscribed to push notifications');
    return;
  }

  console.log('[Push] Push notifications initialized (not subscribed)');
}

/**
 * Request permission and subscribe in one step
 */
export async function enablePushNotifications(vapidPublicKey: string): Promise<boolean> {
  try {
    const subscription = await subscribeToPushNotifications(vapidPublicKey);
    return !!subscription;
  } catch (error) {
    console.error('[Push] Failed to enable push notifications:', error);
    return false;
  }
}

/**
 * Sample notification payloads for different use cases
 */
export const NOTIFICATION_TEMPLATES = {
  workflowComplete: (workflowName: string): NotificationPayload => ({
    title: 'Workflow Complete',
    body: `${workflowName} has finished successfully`,
    icon: '/icons/pwa/icon-192.png',
    tag: 'workflow-complete',
    data: { type: 'workflow', workflowName },
    actions: [
      { action: 'open-trace', title: 'View Trace' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }),

  integrationAlert: (integrationName: string, message: string): NotificationPayload => ({
    title: `${integrationName} Alert`,
    body: message,
    icon: '/icons/pwa/icon-192.png',
    tag: 'integration-alert',
    requireInteraction: true,
    data: { type: 'integration', integrationName },
    actions: [
      { action: 'open-integrations', title: 'View Integration' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }),

  policyViolation: (rule: string): NotificationPayload => ({
    title: 'Policy Violation Detected',
    body: `Rule violated: ${rule}`,
    icon: '/icons/pwa/icon-192.png',
    badge: '/icons/pwa/icon-96.png',
    tag: 'policy-violation',
    requireInteraction: true,
    data: { type: 'policy', rule },
    actions: [
      { action: 'open-dash', title: 'Review' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }),
};
