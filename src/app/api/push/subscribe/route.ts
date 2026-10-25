import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { StorageService } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { subscription, userId, userAgent } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object. Must contain endpoint, p256dh, and auth.' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const supabase = getSupabaseServerClient(accessToken);
    const useRemote = isSupabaseConfigured();

    const clientUserAgent = userAgent || req.headers.get('user-agent') || 'Unknown Browser';

    if (useRemote) {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            user_agent: clientUserAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' }
        );

      if (error) {
        console.error('[API /api/push/subscribe] Error saving subscription to Supabase:', error);
        throw error;
      }
    } else {
      await StorageService.savePushSubscription(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: clientUserAgent,
        },
        userId
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[API /api/push/subscribe] Error saving push subscription:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { endpoint, userId } = body;

    if (!endpoint || !userId) {
      return NextResponse.json({ error: 'Endpoint and userId are required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const supabase = getSupabaseServerClient(accessToken);
    const useRemote = isSupabaseConfigured();

    if (useRemote) {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', userId);

      if (error) {
        console.error('[API /api/push/subscribe] Error deleting push subscription:', error);
        throw error;
      }
    } else {
      await StorageService.deletePushSubscription(endpoint, userId);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[API /api/push/subscribe] Error deleting push subscription:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
