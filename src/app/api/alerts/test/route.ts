import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/storage';
import { sendWebPushNotification } from '@/lib/pushNotifier';
import { getCurrentMonthKey } from '@/lib/formatters';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || 'local-user';
    const month = getCurrentMonthKey();

    // 1. Create a test alert
    const testAlert = await StorageService.saveAlert(
      {
        user_id: userId,
        type: 'test',
        severity: 'info',
        message: '🔔 Test alert: Your notifications and spending vitals are operating smoothly!',
        is_read: false,
        month,
        dedupe_key: null,
        created_at: new Date().toISOString(),
      },
      userId
    );

    // 2. Send a test push notification if push is subscribed
    const pushSubs = await StorageService.getPushSubscriptions(userId);
    let pushResult = { sent: 0, failed: 0 };

    if (pushSubs.length > 0) {
      pushResult = await sendWebPushNotification(pushSubs, {
        title: '🔔 SaveMoney Test Alert',
        message: 'Push notifications are working perfectly on this device!',
        url: '/alerts',
        tag: 'test-alert',
      });
    }

    return NextResponse.json({
      success: true,
      alert: testAlert,
      pushResult,
    });
  } catch (err: unknown) {
    console.error('Error sending test alert:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
