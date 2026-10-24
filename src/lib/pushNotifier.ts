import webpush from 'web-push';
import { PushSubscriptionItem } from './types';

let vapidConfigured = false;

function ensureVapidConfig() {
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
    console.warn('Failed to configure web-push VAPID details:', err);
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
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapidConfig()) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const jsonPayload = JSON.stringify({
    title: payload.title,
    message: payload.message,
    body: payload.message,
    url: payload.url || '/alerts',
    tag: payload.tag || 'savemoney-alert',
  });

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
      console.warn('Failed to send web-push to endpoint:', err);
    }
  });

  await Promise.allSettled(promises);
  return { sent, failed };
}
