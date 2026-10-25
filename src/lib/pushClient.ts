export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Detailed push support diagnostics with actionable human-readable explanations.
 */
export function getPushSupportDetails(): { supported: boolean; reason?: string } {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'Checking client environment...' };
  }

  // Protocol check
  const isSecure =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (!isSecure) {
    return {
      supported: false,
      reason: 'Web push requires a secure HTTPS connection.',
    };
  }

  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;

  if (hasServiceWorker && hasPushManager && hasNotification) {
    return { supported: true };
  }

  // Detect iOS Safari
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    const isStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (!isStandalone) {
      return {
        supported: false,
        reason:
          'On iPhone / iPad, push notifications require adding SaveMoney to your Home Screen first (Tap Share → "Add to Home Screen").',
      };
    }
  }

  if (!hasServiceWorker) {
    return { supported: false, reason: 'Service workers are disabled or not supported in this browser.' };
  }
  if (!hasPushManager) {
    return { supported: false, reason: 'PushManager is not supported by this browser.' };
  }
  if (!hasNotification) {
    return { supported: false, reason: 'Web Notifications API is not supported in this browser.' };
  }

  return { supported: false, reason: 'Browser does not support Web Push notifications.' };
}

/**
 * Pure capability check.
 */
export function isPushNotificationSupported(): boolean {
  return getPushSupportDetails().supported;
}

/**
 * Explicitly registers /sw.js on the client with detailed logging.
 */
export async function ensureServiceWorkerRegistered(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      return existing;
    }

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[SaveMoney Push] ServiceWorker registration failed:', err);
    return null;
  }
}

/**
 * Gets active registration safely with timeout to avoid hanging indefinitely.
 */
export async function getActiveRegistrationWithTimeout(
  timeoutMs = 3000
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const reg = await ensureServiceWorkerRegistered();
    if (reg?.active) return reg;

    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const result = await Promise.race([readyPromise, timeoutPromise]);
    return result || reg || null;
  } catch (err) {
    console.warn('[SaveMoney Push] getActiveRegistration error:', err);
    return null;
  }
}

export type PushBadgeStatus =
  | 'checking'
  | 'available'
  | 'enabled'
  | 'blocked'
  | 'not_supported';

export interface PushClientState {
  status: PushBadgeStatus;
  supported: boolean;
  permission: NotificationPermission | 'not_supported';
  isSubscribed: boolean;
  unsupportedReason?: string;
  error?: string;
}

/**
 * Inspects push subscription state on the client without blocking.
 */
export async function getPushSubscriptionState(): Promise<PushClientState> {
  const support = getPushSupportDetails();

  if (!support.supported) {
    return {
      status: 'not_supported',
      supported: false,
      permission: 'not_supported',
      isSubscribed: false,
      unsupportedReason: support.reason,
    };
  }

  const permission = Notification.permission;
  if (permission === 'denied') {
    return {
      status: 'blocked',
      supported: true,
      permission: 'denied',
      isSubscribed: false,
    };
  }

  try {
    const reg = await getActiveRegistrationWithTimeout(3000);
    if (!reg) {
      return {
        status: 'available',
        supported: true,
        permission,
        isSubscribed: false,
      };
    }

    const sub = await reg.pushManager.getSubscription();
    const isSubscribed = !!sub;

    return {
      status: isSubscribed && permission === 'granted' ? 'enabled' : 'available',
      supported: true,
      permission,
      isSubscribed,
    };
  } catch (err) {
    console.warn('[SaveMoney Push] getPushSubscriptionState error:', err);
    return {
      status: 'available',
      supported: true,
      permission,
      isSubscribed: false,
    };
  }
}

export async function registerPushSubscription(userId?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const support = getPushSupportDetails();
  if (!support.supported) {
    return {
      success: false,
      error: support.reason || 'Push notifications are not supported on this browser.',
    };
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return {
      success: false,
      error: 'VAPID public key not configured in environment variables (NEXT_PUBLIC_VAPID_PUBLIC_KEY).',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error:
          'Notification permission was not granted. Please allow notifications in your browser address bar/settings.',
      };
    }

    const reg = await getActiveRegistrationWithTimeout(4000);
    if (!reg) {
      throw new Error('Could not establish active service worker registration for push.');
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    // Save subscription to server
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        userId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to save push subscription on server');
    }

    return { success: true };
  } catch (err: unknown) {
    console.error('[SaveMoney Push] Error registering push subscription:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during push registration',
    };
  }
}

export async function unregisterPushSubscription(userId?: string): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  try {
    const reg = await getActiveRegistrationWithTimeout(3000);
    if (!reg) return false;

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, userId }),
      });
    }
    return true;
  } catch (err) {
    console.warn('[SaveMoney Push] Error unregistering push subscription:', err);
    return false;
  }
}
