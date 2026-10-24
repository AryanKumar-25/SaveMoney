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
 * Pure capability check. Checks ONLY serviceWorker, PushManager, and Notification.
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
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
      console.log('[SaveMoney Push] Active ServiceWorker found:', existing.scope);
      return existing;
    }

    console.log('[SaveMoney Push] Registering /sw.js...');
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[SaveMoney Push] ServiceWorker successfully registered with scope:', reg.scope);
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
  error?: string;
}

/**
 * Inspects push subscription state on the client without blocking.
 */
export async function getPushSubscriptionState(): Promise<PushClientState> {
  if (!isPushNotificationSupported()) {
    return {
      status: 'not_supported',
      supported: false,
      permission: 'not_supported',
      isSubscribed: false,
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
  if (!isPushNotificationSupported()) {
    return { success: false, error: 'Push notifications are not supported on this browser.' };
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
      return { success: false, error: 'Push notification permission was denied or dismissed.' };
    }

    const reg = await getActiveRegistrationWithTimeout(4000);
    if (!reg) {
      throw new Error('Could not establish service worker registration for push.');
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

    console.log('[SaveMoney Push] Subscription successfully registered & saved to server');
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
      console.log('[SaveMoney Push] Subscription unsubscribed');
    }
    return true;
  } catch (err) {
    console.warn('[SaveMoney Push] Error unregistering push subscription:', err);
    return false;
  }
}
