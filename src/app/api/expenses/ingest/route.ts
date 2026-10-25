import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { evaluateAlerts } from '@/lib/alertEngine';
import { detectDuplicateExpense } from '@/lib/safeguardCalculations';
import { Expense } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * POST /api/expenses/ingest
 * Ingests auto-captured expenses (e.g. from SMS/UPI phone automation webhook).
 * - Deduplicates against recent transactions (e.g. SMS + UPI notification of same payment)
 * - Inserts the expense into Supabase
 * - Awaits evaluateAlerts(userId, month) on the server so alerts & push fire reliably
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const supabase = getSupabaseServerClient(token);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Missing request body' }, { status: 400 });
    }

    let userId = body.userId || body.user_id;

    // If userId not provided in body, attempt to read from auth token
    if (!userId && token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId or authorization' }, { status: 401 });
    }

    const amount = Number(body.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const dateStr = body.date || new Date().toISOString();
    const dateObj = new Date(dateStr);
    const month = dateStr.slice(0, 7); // YYYY-MM
    const merchant = (body.merchant || body.payee || 'Unknown').trim();
    const category = (body.category || 'Other').trim();
    const note = (body.note || body.description || 'Auto-captured').trim();
    const source = (body.source || 'sms').trim();

    // Check for duplicate payment (e.g. SMS and UPI app notification arriving within 1 day)
    const { data: existingRows } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(50);

    const candidate = {
      amount,
      date: dateObj.toISOString(),
      merchant,
      note,
    };

    const dupResult = detectDuplicateExpense(candidate, (existingRows || []) as Expense[]);

    if (dupResult.isDuplicate) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: dupResult.reason || 'Duplicate detected (likely SMS + UPI multi-source)',
        matchedExpenseId: dupResult.matchedExpense?.id,
      });
    }

    // Insert expense
    const { data: inserted, error: insertError } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        amount,
        category,
        merchant,
        note,
        date: dateObj.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Ingest] Failed to insert expense:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Await alert evaluation on the server so notifications and push trigger
    const alertResult = await evaluateAlerts(userId, month, {
      triggerExpense: {
        amount,
        merchant,
        category,
      },
      sendPush: true,
    });

    return NextResponse.json({
      success: true,
      expense: inserted,
      alertsCreated: alertResult.newAlerts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown ingest error';
    console.error('[Ingest] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
