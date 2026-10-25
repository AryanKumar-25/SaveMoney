import { NextRequest, NextResponse } from 'next/server';
import { evaluateAlerts } from '@/lib/alertEngine';
import { getCurrentMonthKey } from '@/lib/formatters';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const month = body.month || getCurrentMonthKey();
    const userId = body.userId;
    const lastExpense = body.lastExpense || null;
    const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required for alert evaluation' }, { status: 400 });
    }

    // Extract Bearer token if present
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    // Evaluate all rules via the Single Alert Engine
    const result = await evaluateAlerts(userId, month, {
      lastExpense,
      referenceDate,
      accessToken,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[API /api/alerts/evaluate] Evaluation error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal Server Error during alert evaluation',
      },
      { status: 500 }
    );
  }
}
