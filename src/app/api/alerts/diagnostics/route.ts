import { NextRequest, NextResponse } from 'next/server';
import { getAlertDiagnostics } from '@/lib/alertEngine';
import { getCurrentMonthKey } from '@/lib/formatters';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/alerts/diagnostics
 * Returns real-time financial stats, rule firing statuses with reasons,
 * last 20 alert rows, push subscription count, and environment presence flags.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const { searchParams } = new URL(req.url);

    let userId = searchParams.get('userId');
    const month = searchParams.get('month') || getCurrentMonthKey();

    if (!userId && token) {
      const supabase = getSupabaseServerClient(token);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId or authorization' }, { status: 401 });
    }

    const diagnostics = await getAlertDiagnostics(userId, month);
    return NextResponse.json(diagnostics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error loading diagnostics';
    console.error('[Diagnostics API] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
