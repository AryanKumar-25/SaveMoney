import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, userId } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const effectiveUserId = userId || 'local-user';

    await StorageService.savePushSubscription(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      effectiveUserId
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error saving push subscription:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, userId } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    const effectiveUserId = userId || 'local-user';
    await StorageService.deletePushSubscription(endpoint, effectiveUserId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting push subscription:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
