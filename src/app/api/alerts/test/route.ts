import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { StorageService } from '@/lib/storage';
import { sendWebPushNotification, ensureVapidConfig } from '@/lib/pushNotifier';
import { getCurrentMonthKey } from '@/lib/formatters';
import { AlertItem } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;
    const mode = body.mode || 'both'; // 'in-app' | 'push' | 'both'
    const month = body.month || getCurrentMonthKey();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const supabase = getSupabaseServerClient(accessToken);
    const useRemote = isSupabaseConfigured();

    let savedAlert: AlertItem | null = null;
    let pushResult = { sent: 0, failed: 0, errors: [] as string[] };

    // 1. Create In-App Alert if requested
    if (mode === 'in-app' || mode === 'both') {
      const alertData: Omit<AlertItem, 'id'> = {
        user_id: userId,
        type: 'test',
        severity: 'info',
        title: '🔔 Test In-App Alert',
        message: 'Your in-app alert notification pipeline is operating smoothly!',
        is_read: false,
        month,
        dedupe_key: null,
        created_at: new Date().toISOString(),
      };

      if (useRemote) {
        const { data, error } = await supabase
          .from('alerts')
          .insert(alertData)
          .select()
          .single();

        if (error) {
          console.error('[API /api/alerts/test] Error inserting test alert:', error);
          throw error;
        }
        savedAlert = data;
      } else {
        savedAlert = await StorageService.saveAlert(alertData, userId);
      }
    }

    // 2. Send Push Notification if requested
    if (mode === 'push' || mode === 'both') {
      if (!ensureVapidConfig()) {
        pushResult.errors.push('VAPID credentials not configured in environment (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).');
      } else {
        let subs: any[] = [];
        if (useRemote) {
          const { data, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId);
          if (!error && data) subs = data;
        } else {
          subs = await StorageService.getPushSubscriptions(userId);
        }

        if (subs.length === 0) {
          pushResult.errors.push('No push subscriptions registered for this user. Enable notifications in Settings on this device.');
        } else {
          pushResult = await sendWebPushNotification(subs, {
            title: '🔔 SaveMoney Test Push Notification',
            message: 'Web push notifications are verified and active on this device!',
            url: '/alerts',
            tag: 'test-push',
          });

          // If we also created an alert, update its push_sent_at / push_error
          if (savedAlert && useRemote) {
            await supabase
              .from('alerts')
              .update({
                push_sent_at: pushResult.sent > 0 ? new Date().toISOString() : null,
                push_error: pushResult.errors.length > 0 ? pushResult.errors.join('; ') : null,
              })
              .eq('id', savedAlert.id);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      alert: savedAlert,
      pushResult,
    });
  } catch (err: unknown) {
    console.error('[API /api/alerts/test] Test error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
