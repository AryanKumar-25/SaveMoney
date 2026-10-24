import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/storage';
import { calculateSpendableBudget } from '@/lib/calculations';
import { evaluateAlertRules } from '@/lib/alertsEngine';
import { sendWebPushNotification } from '@/lib/pushNotifier';
import { getDaysRemainingInMonth } from '@/lib/formatters';
import { AlertItem } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { month, lastExpense, userId } = body;

    if (!month) {
      return NextResponse.json({ error: 'Month is required' }, { status: 400 });
    }

    const effectiveUserId = userId || 'local-user';

    // 1. Fetch budget & spending details
    const [
      budgetRes,
      fixedExpenses,
      spendingSummary,
      alertSettings,
      existingAlerts,
      pushSubs,
      transfers,
      adjustments,
    ] = await Promise.all([
      StorageService.getMonthlyBudget(month, effectiveUserId),
      StorageService.getFixedExpenses(month, effectiveUserId),
      StorageService.getMonthSpendingSummary(month, effectiveUserId),
      StorageService.getAlertSettings(effectiveUserId),
      StorageService.getAlerts(effectiveUserId),
      StorageService.getPushSubscriptions(effectiveUserId),
      StorageService.getMonthExtraMoneyTransfers(month, effectiveUserId),
      StorageService.getBalanceAdjustments(month, effectiveUserId),
    ]);

    const income = budgetRes.budget?.income || 0;
    const savingsTarget = budgetRes.budget?.savings_target || 0;
    const transfersTotal = transfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const adjustmentsTotal = adjustments.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const calculation = calculateSpendableBudget(
      income,
      fixedExpenses,
      savingsTarget,
      transfersTotal,
      adjustmentsTotal
    );

    const { daysLeft } = getDaysRemainingInMonth(new Date());

    // 2. Collect existing dedupe keys for this month
    const existingFiredKeys = new Set<string>();
    for (const a of existingAlerts) {
      if (a.month === month && a.dedupe_key) {
        existingFiredKeys.add(a.dedupe_key);
      }
    }

    // 3. Evaluate alert rules
    const newAlerts = evaluateAlertRules({
      currentMonth: month,
      spendableBudget: calculation.spendableBudget,
      spentSoFar: spendingSummary.spentSoFarThisMonth,
      spentToday: spendingSummary.spentToday,
      daysRemaining: daysLeft,
      lastExpense,
      existingFiredKeys,
      settings: alertSettings,
      userId: effectiveUserId,
    });

    // 4. Save newly triggered alerts
    const savedAlerts: AlertItem[] = [];
    for (const alert of newAlerts) {
      const saved = await StorageService.saveAlert(alert, effectiveUserId);
      savedAlerts.push(saved);
    }

    // 5. Send push notifications for warning / danger alerts if push enabled
    if (alertSettings.pushNotifications && pushSubs.length > 0) {
      const urgentAlerts = savedAlerts.filter(
        (a) => a.severity === 'warning' || a.severity === 'danger'
      );

      for (const alert of urgentAlerts) {
        const title =
          alert.severity === 'danger' ? '⚠️ SaveMoney Alert: Action Needed' : '🔔 SaveMoney Notice';
        await sendWebPushNotification(pushSubs, {
          title,
          message: alert.message,
          url: '/alerts',
          tag: alert.type,
        });
      }
    }

    return NextResponse.json({
      success: true,
      newAlerts: savedAlerts,
    });
  } catch (err: unknown) {
    console.error('Error evaluating alerts:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
