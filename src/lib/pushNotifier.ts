import webpush from 'web-push';
import { PushSubscriptionItem } from './types';
import { getSupabaseServerClient } from './supabase/server';
import { isSupabaseConfigured } from './supabase/client';
import { StorageService } from './storage';

let vapidConfigured = false;

export function ensureVapidConfig(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@savemoney.app';

  if (!publicKey || !privateKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.warn('[PushNotifier] Failed to configure web-push VAPID details:', err);
    return false;
  }
}

export async function sendWebPushNotification(
  subscriptions: PushSubscriptionItem[],
  payload: {
    title: string;
    message: string;
    url?: string;
    tag?: string;
  }
): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!ensureVapidConfig()) {
    return {
      sent: 0,
      failed: subscriptions.length,
      errors: ['VAPID keys not configured in environment variables.'],
    };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  const jsonPayload = JSON.stringify({
    title: payload.title,
    message: payload.message,
    body: payload.message,
    url: payload.url || '/alerts',
    tag: payload.tag || 'savemoney-alert',
  });

  const supabase = getSupabaseServerClient();
  const useRemote = isSupabaseConfigured();

  const promises = subscriptions.map(async (sub) => {
    if (!sub.endpoint || !sub.p256dh || !sub.auth) return;

    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSub, jsonPayload, {
        TTL: 86400, // 1 day
      });
      sent++;
    } catch (err: unknown) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Endpoint error (${statusCode || 'unknown'}): ${errorMsg}`);
      console.warn(`[PushNotifier] Failed to send push to ${sub.endpoint.slice(0, 30)}...:`, errorMsg);

      // Handle failures: delete dead subscription on 404 (Not Found) or 410 (Gone / Unsubscribed)
      if (statusCode === 404 || statusCode === 410) {
        console.log(`[PushNotifier] Removing dead subscription (${statusCode}): ${sub.endpoint.slice(0, 30)}...`);
        try {
          if (useRemote) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
          } else {
            await StorageService.deletePushSubscription(sub.endpoint, sub.user_id);
          }
        } catch (cleanupErr) {
          console.warn('[PushNotifier] Error cleaning up dead subscription:', cleanupErr);
        }
      }
    }
  });

  await Promise.allSettled(promises);
  return { sent, failed, errors };
}
