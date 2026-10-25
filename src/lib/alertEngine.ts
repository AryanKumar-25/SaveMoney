import {
  AlertItem,
  AlertType,
  AlertSeverity,
  UserAlertSettings,
  Expense,
  PushSubscriptionItem,
} from './types';
import { formatINR, getDaysRemainingInMonth, getCurrentMonthKey } from './formatters';
import { calculateSpendableBudget, calculateMonthEndProjection } from './calculations';
import { getSupabaseServerClient } from './supabase/server';
import { isSupabaseConfigured } from './supabase/client';
import { StorageService } from './storage';
import { sendWebPushNotification } from './pushNotifier';

export const DEFAULT_ALERT_SETTINGS: UserAlertSettings = {
  overDaily: true,
  underDaily: true,
  budgetThresholds: true,
  thresholds: [50, 80, 100],
  projectionWarning: true,
  savingsAtRisk: true,
  pushNotifications: true,
  dailyCheckInEnabled: true,
  dailyCheckInTime: '21:00',
  weeklyReconciliationReminder: true,
};

export interface EvaluateAlertsOptions {
  triggerExpense?: {
    amount: number;
    merchant?: string;
    category?: string;
    note?: string;
    date?: string;
  } | null;
  lastExpense?: {
    amount: number;
    merchant?: string;
    category?: string;
    note?: string;
    date?: string;
  } | null;
  referenceDate?: Date;
  accessToken?: string;
  sendPush?: boolean;
}

export interface EvaluateAlertsResult {
  success: boolean;
  newAlerts: AlertItem[];
  numbers: {
    spendableBudget: number;
    baseSpendableBudget: number;
    spentSoFar: number;
    spentToday: number;
    dailyAllowance: number;
    safeToSpendToday: number;
    daysRemaining: number;
    percentUsed: number;
    projectedSpend: number;
    isProjectedOverBudget: boolean;
  };
  rulesEvaluated: {
    rule: string;
    enabled: boolean;
    fired: boolean;
    reason: string;
  }[];
}

/**
 * THE SINGLE ALERT ENGINE
 * 
 * Server-side evaluation function that:
 * 1. Loads user's budget (including extra-money transfers and balance adjustments), settings, and expenses
 * 2. Determines which alerts should exist based on enabled rules
 * 3. Enforces strict deduplication (threshold alerts fire once per month per level)
 * 4. Persists new alerts to Supabase (with unique dedupe_key constraint)
 * 5. Sends push notifications for warning / danger alerts if push enabled
 * 6. Never swallows errors
 */
export async function evaluateAlerts(
  userId: string,
  month: string,
  options: EvaluateAlertsOptions = {}
): Promise<EvaluateAlertsResult> {
  const effectiveLastExpense = options.triggerExpense || options.lastExpense || null;
  const {
    referenceDate = new Date(),
    accessToken,
  } = options;

  if (!userId) {
    throw new Error('evaluateAlerts: userId is required');
  }
  if (!month) {
    throw new Error('evaluateAlerts: month (YYYY-MM) is required');
  }

  const useRemote = isSupabaseConfigured();
  const supabase = useRemote ? getSupabaseServerClient(accessToken) : (null as any);

  // 1. Fetch budget, fixed commitments, transfers, adjustments, expenses, settings, and existing alerts
  let income = 0;
  let savingsTarget = 0;
  let fixedExpensesTotal = 0;
  let transfersTotal = 0;
  let adjustmentsTotal = 0;
  let monthExpenses: Expense[] = [];
  let userSettings: UserAlertSettings = { ...DEFAULT_ALERT_SETTINGS };
  let existingDedupeKeys = new Set<string>();
  let pushSubs: PushSubscriptionItem[] = [];

  if (useRemote) {
    // --- 1a. Remote Supabase Fetch ---
    const [
      budgetRes,
      fixedRes,
      transfersRes,
      adjustmentsRes,
      expensesRes,
      settingsRes,
      alertsRes,
      pushSubsRes,
    ] = await Promise.all([
      supabase.from('monthly_budgets').select('income, savings_target').eq('user_id', userId).eq('month', month).maybeSingle(),
      supabase.from('fixed_expenses').select('amount').eq('user_id', userId).eq('month', month),
      supabase.from('extra_money_transfers').select('amount').eq('user_id', userId).eq('month', month),
      supabase.from('balance_adjustments').select('amount').eq('user_id', userId).eq('month', month),
      supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('user_alert_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('alerts').select('dedupe_key').eq('user_id', userId).eq('month', month).not('dedupe_key', 'is', null),
      supabase.from('push_subscriptions').select('*').eq('user_id', userId),
    ]);

    if (budgetRes.data) {
      income = Number(budgetRes.data.income) || 0;
      savingsTarget = Number(budgetRes.data.savings_target) || 0;
    }

    if (fixedRes.data) {
      fixedExpensesTotal = (fixedRes.data as { amount: number | string }[]).reduce(
        (sum: number, f) => sum + (Number(f.amount) || 0),
        0
      );
    }

    if (transfersRes.data) {
      transfersTotal = (transfersRes.data as { amount: number | string }[]).reduce(
        (sum: number, t) => sum + (Number(t.amount) || 0),
        0
      );
    }

    if (adjustmentsRes.data) {
      adjustmentsTotal = (adjustmentsRes.data as { amount: number | string }[]).reduce(
        (sum: number, a) => sum + (Number(a.amount) || 0),
        0
      );
    }

    if (expensesRes.data) {
      // Filter expenses belonging to this month
      monthExpenses = (expensesRes.data as any[])
        .filter((e) => e.date && e.date.startsWith(month))
        .map((e) => ({
          id: e.id,
          user_id: e.user_id,
          account_id: e.account_id,
          amount: Number(e.amount),
          category: e.category,
          merchant: e.merchant,
          note: e.note,
          date: e.date,
          created_at: e.created_at,
        }));
    }

    if (settingsRes.data) {
      userSettings = {
        overDaily: settingsRes.data.over_daily ?? DEFAULT_ALERT_SETTINGS.overDaily,
        underDaily: settingsRes.data.under_daily ?? DEFAULT_ALERT_SETTINGS.underDaily,
        budgetThresholds: settingsRes.data.budget_thresholds ?? DEFAULT_ALERT_SETTINGS.budgetThresholds,
        thresholds: Array.isArray(settingsRes.data.thresholds) ? settingsRes.data.thresholds : DEFAULT_ALERT_SETTINGS.thresholds,
        projectionWarning: settingsRes.data.projection_warning ?? DEFAULT_ALERT_SETTINGS.projectionWarning,
        savingsAtRisk: settingsRes.data.savings_at_risk ?? DEFAULT_ALERT_SETTINGS.savingsAtRisk,
        pushNotifications: settingsRes.data.push_notifications ?? DEFAULT_ALERT_SETTINGS.pushNotifications,
      };
    }

    if (alertsRes.data) {
      for (const a of alertsRes.data) {
        if (a.dedupe_key) {
          existingDedupeKeys.add(a.dedupe_key);
        }
      }
    }

    if (pushSubsRes.data) {
      pushSubs = pushSubsRes.data;
    }
  } else {
    // --- 1b. Local / In-memory Fallback (for Unit Tests or Offline Demo) ---
    const [
      budgetRes,
      fixedList,
      transfersList,
      adjustmentsList,
      allExps,
      settingsObj,
      alertsList,
      subsList,
    ] = await Promise.all([
      StorageService.getMonthlyBudget(month, userId),
      StorageService.getFixedExpenses(month, userId),
      StorageService.getMonthExtraMoneyTransfers(month, userId),
      StorageService.getBalanceAdjustments(month, userId),
      StorageService.getAllExpenses(userId),
      StorageService.getAlertSettings(userId),
      StorageService.getAlerts(userId),
      StorageService.getPushSubscriptions(userId),
    ]);

    income = budgetRes.budget?.income || 0;
    savingsTarget = budgetRes.budget?.savings_target || 0;
    fixedExpensesTotal = fixedList.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    transfersTotal = transfersList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    adjustmentsTotal = adjustmentsList.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    monthExpenses = allExps.filter((e) => e.date && e.date.startsWith(month));
    userSettings = { ...DEFAULT_ALERT_SETTINGS, ...settingsObj };
    for (const a of alertsList) {
      if (a.month === month && a.dedupe_key) {
        existingDedupeKeys.add(a.dedupe_key);
      }
    }
    pushSubs = subsList;
  }

  // 2. Core Financial Calculations
  const calculation = calculateSpendableBudget(
    income,
    fixedExpensesTotal,
    savingsTarget,
    transfersTotal,
    adjustmentsTotal
  );

  const spendableBudget = calculation.spendableBudget;
  let spentSoFar = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Today's spending
  const todayStr = referenceDate.toISOString().slice(0, 10);
  let spentToday = monthExpenses
    .filter((e) => e.date && e.date.startsWith(todayStr))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  if (effectiveLastExpense && monthExpenses.length === 0) {
    spentSoFar += effectiveLastExpense.amount;
    spentToday += effectiveLastExpense.amount;
  }

  const { daysLeft } = getDaysRemainingInMonth(referenceDate);
  const daysRemaining = Math.max(1, daysLeft);

  // Daily Allowance Calculation:
  // (spendable budget - spent before today) / days remaining in month
  const spentBeforeToday = Math.max(0, spentSoFar - spentToday);
  const remainingAtStartOfToday = spendableBudget - spentBeforeToday;
  const dailyAllowance =
    remainingAtStartOfToday > 0 && daysRemaining > 0
      ? Math.round(remainingAtStartOfToday / daysRemaining)
      : 0;

  const safeToSpendToday = Math.max(0, dailyAllowance - spentToday);
  const percentUsed = spendableBudget > 0 ? (spentSoFar / spendableBudget) * 100 : 0;
  const projection = calculateMonthEndProjection(spentSoFar, spendableBudget, referenceDate);

  const rulesEvaluated: {
    rule: string;
    enabled: boolean;
    fired: boolean;
    reason: string;
  }[] = [];

  const candidateAlerts: Omit<AlertItem, 'id'>[] = [];
  const nowIso = referenceDate.toISOString();

  // ============================================================================
  // RULE 1: OVER TODAY'S LIMIT
  // ============================================================================
  const isOverDaily = spendableBudget > 0 && spentToday > dailyAllowance;
  const overBy = spentToday - dailyAllowance;

  if (userSettings.overDaily) {
    if (isOverDaily) {
      const merchantText = effectiveLastExpense?.merchant ? ` at ${effectiveLastExpense.merchant}` : '';
      const amountText = effectiveLastExpense ? `${formatINR(effectiveLastExpense.amount)} spent${merchantText}. ` : '';
      const severity: AlertSeverity = spentSoFar > spendableBudget ? 'danger' : 'warning';

      candidateAlerts.push({
        user_id: userId,
        type: 'over_daily',
        severity,
        title: "Over Today's Limit",
        message: `${amountText}You are ${formatINR(overBy)} over today's safe limit of ${formatINR(dailyAllowance)}.`,
        is_read: false,
        month,
        dedupe_key: null, // Transaction-level / daily alert
        created_at: nowIso,
      });

      rulesEvaluated.push({
        rule: "Over Today's Limit",
        enabled: true,
        fired: true,
        reason: `Spent ${formatINR(spentToday)} today exceeds daily allowance of ${formatINR(dailyAllowance)} by ${formatINR(overBy)}.`,
      });
    } else {
      rulesEvaluated.push({
        rule: "Over Today's Limit",
        enabled: true,
        fired: false,
        reason: `Spent ${formatINR(spentToday)} today is within daily allowance of ${formatINR(dailyAllowance)}.`,
      });
    }
  } else {
    rulesEvaluated.push({
      rule: "Over Today's Limit",
      enabled: false,
      fired: false,
      reason: 'Rule disabled in settings.',
    });
  }

  // ============================================================================
  // RULE 2: AMOUNT LEFT TODAY AFTER EACH EXPENSE
  // ============================================================================
  const isUnderDaily = spendableBudget > 0 && spentToday <= dailyAllowance && Boolean(effectiveLastExpense);

  if (userSettings.underDaily) {
    if (isUnderDaily && effectiveLastExpense) {
      const merchantText = effectiveLastExpense.merchant ? ` at ${effectiveLastExpense.merchant}` : '';
      const leftToday = dailyAllowance - spentToday;

      candidateAlerts.push({
        user_id: userId,
        type: 'under_daily',
        severity: 'info',
        title: 'Within Daily Limit',
        message: `${formatINR(effectiveLastExpense.amount)} spent${merchantText}. ${formatINR(leftToday)} remaining for today.`,
        is_read: false,
        month,
        dedupe_key: null,
        created_at: nowIso,
      });

      rulesEvaluated.push({
        rule: 'Amount Left Today After Expense',
        enabled: true,
        fired: true,
        reason: `Expense of ${formatINR(effectiveLastExpense.amount)} recorded. ${formatINR(leftToday)} left today.`,
      });
    } else {
      rulesEvaluated.push({
        rule: 'Amount Left Today After Expense',
        enabled: true,
        fired: false,
        reason: !effectiveLastExpense ? 'No new expense in this evaluation cycle.' : 'Today spending is already over daily limit.',
      });
    }
  } else {
    rulesEvaluated.push({
      rule: 'Amount Left Today After Expense',
      enabled: false,
      fired: false,
      reason: 'Rule disabled in settings.',
    });
  }

  // ============================================================================
  // RULE 3: MONTHLY BUDGET THRESHOLDS (50%, 80%, 100%) - DEDUPED ONCE PER MONTH
  // ============================================================================
  if (userSettings.budgetThresholds && spendableBudget > 0) {
    const sortedThresholds = [...(userSettings.thresholds || [50, 80, 100])].sort((a, b) => b - a);

    for (const thresh of sortedThresholds) {
      const dedupeKey = `${userId}_${month}_threshold_${thresh}`;
      const hasCrossed = percentUsed >= thresh;
      const alreadyFired = existingDedupeKeys.has(dedupeKey);

      if (hasCrossed && !alreadyFired) {
        let severity: AlertSeverity = 'info';
        let title = `${thresh}% Monthly Budget Reached`;
        let msg = `You have used ${thresh}% of your ${formatINR(spendableBudget)} monthly budget with ${daysRemaining} days left.`;

        if (thresh >= 100) {
          severity = 'danger';
          title = '100% Budget Reached';
          const overBudgetAmt = Math.max(0, spentSoFar - spendableBudget);
          msg = overBudgetAmt > 0
            ? `100% budget reached! You have exceeded your monthly budget by ${formatINR(overBudgetAmt)}.`
            : `100% of your monthly budget of ${formatINR(spendableBudget)} has been spent with ${daysRemaining} days left.`;
        } else if (thresh >= 80) {
          severity = 'warning';
          title = `${thresh}% Budget Warning`;
          msg = `Caution: You have used ${thresh}% of your monthly budget (${formatINR(spentSoFar)} of ${formatINR(spendableBudget)}).`;
        }

        candidateAlerts.push({
          user_id: userId,
          type: `threshold_${thresh}` as AlertType,
          severity,
          title,
          message: msg,
          is_read: false,
          month,
          dedupe_key: dedupeKey,
          created_at: nowIso,
        });

        // Add to in-memory set to prevent double evaluation in same cycle
        existingDedupeKeys.add(dedupeKey);

        rulesEvaluated.push({
          rule: `Monthly Threshold ${thresh}%`,
          enabled: true,
          fired: true,
          reason: `Current spending ${formatINR(spentSoFar)} is ${percentUsed.toFixed(1)}% of ${formatINR(spendableBudget)}.`,
        });
      } else {
        rulesEvaluated.push({
          rule: `Monthly Threshold ${thresh}%`,
          enabled: true,
          fired: false,
          reason: alreadyFired
            ? `Already fired for ${month} (dedupe key: ${dedupeKey}).`
            : `Current spending ${percentUsed.toFixed(1)}% has not reached ${thresh}%.`,
        });
      }
    }
  } else {
    rulesEvaluated.push({
      rule: 'Monthly Budget Thresholds',
      enabled: userSettings.budgetThresholds,
      fired: false,
      reason: spendableBudget <= 0 ? 'Spendable budget is ₹0 or not configured.' : 'Rule disabled in settings.',
    });
  }

  // ============================================================================
  // RULE 4: PROJECTION OVER BUDGET - DEDUPED ONCE PER MONTH
  // ============================================================================
  const projectionDedupeKey = `${userId}_${month}_projection_warning`;
  const isProjectionFired = existingDedupeKeys.has(projectionDedupeKey);

  if (userSettings.projectionWarning && spendableBudget > 0 && spentSoFar > 0) {
    if (projection.isProjectedOverBudget && !isProjectionFired) {
      candidateAlerts.push({
        user_id: userId,
        type: 'projection_warning',
        severity: 'warning',
        title: 'Spending Pace Warning',
        message: `At your current pace of ${formatINR(projection.averageDailySpend)}/day, you are projected to exceed your budget by ${formatINR(Math.abs(projection.projectedSurplusOrDeficit))} this month.`,
        is_read: false,
        month,
        dedupe_key: projectionDedupeKey,
        created_at: nowIso,
      });

      existingDedupeKeys.add(projectionDedupeKey);

      rulesEvaluated.push({
        rule: 'Month-End Projection Warning',
        enabled: true,
        fired: true,
        reason: `Projected spend of ${formatINR(projection.projectedMonthEndSpend)} exceeds budget of ${formatINR(spendableBudget)}.`,
      });
    } else {
      rulesEvaluated.push({
        rule: 'Month-End Projection Warning',
        enabled: true,
        fired: false,
        reason: isProjectionFired
          ? `Already fired for ${month}.`
          : `Projected spend ${formatINR(projection.projectedMonthEndSpend)} is within budget ${formatINR(spendableBudget)}.`,
      });
    }
  } else {
    rulesEvaluated.push({
      rule: 'Month-End Projection Warning',
      enabled: userSettings.projectionWarning,
      fired: false,
      reason: spendableBudget <= 0 ? 'No spendable budget.' : spentSoFar === 0 ? 'No spending recorded yet.' : 'Rule disabled.',
    });
  }

  // ============================================================================
  // RULE 5: SAVINGS AT RISK - DEDUPED ONCE PER MONTH
  // ============================================================================
  const savingsDedupeKey = `${userId}_${month}_savings_risk`;
  const isSavingsRiskFired = existingDedupeKeys.has(savingsDedupeKey);
  const isSavingsDeficit = spendableBudget > 0 && spentSoFar > spendableBudget;

  if (userSettings.savingsAtRisk && spendableBudget > 0) {
    if (isSavingsDeficit && !isSavingsRiskFired) {
      const deficitAmt = spentSoFar - spendableBudget;
      candidateAlerts.push({
        user_id: userId,
        type: 'savings_risk',
        severity: 'danger',
        title: 'Savings Target at Risk',
        message: `Savings at risk: spending has exceeded your discretionary budget by ${formatINR(deficitAmt)}, directly impacting your monthly savings target.`,
        is_read: false,
        month,
        dedupe_key: savingsDedupeKey,
        created_at: nowIso,
      });

      existingDedupeKeys.add(savingsDedupeKey);

      rulesEvaluated.push({
        rule: 'Savings at Risk',
        enabled: true,
        fired: true,
        reason: `Total spent ${formatINR(spentSoFar)} exceeds spendable budget ${formatINR(spendableBudget)} by ${formatINR(deficitAmt)}.`,
      });
    } else {
      rulesEvaluated.push({
        rule: 'Savings at Risk',
        enabled: true,
        fired: false,
        reason: isSavingsRiskFired
          ? `Already fired for ${month}.`
          : `Savings intact: ${formatINR(Math.max(0, spendableBudget - spentSoFar))} spendable budget remains.`,
      });
    }
  } else {
    rulesEvaluated.push({
      rule: 'Savings at Risk',
      enabled: userSettings.savingsAtRisk,
      fired: false,
      reason: spendableBudget <= 0 ? 'No spendable budget configured.' : 'Rule disabled in settings.',
    });
  }

  // ============================================================================
  // 3. PERSIST CANDIDATE ALERTS & SEND PUSH NOTIFICATIONS
  // ============================================================================
  const savedAlerts: AlertItem[] = [];

  for (const alertData of candidateAlerts) {
    let savedItem: AlertItem | null = null;

    if (useRemote) {
      try {
        // Insert into Supabase alerts table
        const insertPayload: Record<string, unknown> = {
          user_id: alertData.user_id,
          type: alertData.type,
          severity: alertData.severity,
          title: alertData.title || '',
          message: alertData.message,
          month: alertData.month,
          dedupe_key: alertData.dedupe_key || null,
          is_read: false,
          created_at: alertData.created_at || nowIso,
        };

        const { data, error } = await supabase
          .from('alerts')
          .insert(insertPayload)
          .select()
          .maybeSingle();

        if (error) {
          // If error is unique constraint violation on dedupe_key, ignore duplicate gracefully
          if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('idx_alerts_user_dedupe')) {
            console.log(`[AlertEngine] Duplicate alert suppressed by DB unique constraint: ${alertData.dedupe_key}`);
            continue;
          }
          console.error('[AlertEngine] Supabase insert error on alerts:', error);
          throw error;
        }

        if (data) {
          savedItem = {
            id: data.id,
            user_id: data.user_id,
            type: data.type,
            severity: data.severity,
            title: data.title,
            message: data.message,
            month: data.month,
            dedupe_key: data.dedupe_key,
            is_read: data.is_read,
            push_sent_at: data.push_sent_at,
            push_error: data.push_error,
            created_at: data.created_at,
          };
        }
      } catch (err: unknown) {
        console.error('[AlertEngine] Failed to save alert to Supabase:', err);
        throw err;
      }
    } else {
      // In-memory / LocalStorage fallback
      savedItem = await StorageService.saveAlert(alertData, userId);
    }

    if (savedItem) {
      savedAlerts.push(savedItem);

      // ========================================================================
      // 4. WEB PUSH NOTIFICATION (Warning & Danger alerts)
      // ========================================================================
      if (
        userSettings.pushNotifications &&
        pushSubs.length > 0 &&
        (savedItem.severity === 'warning' || savedItem.severity === 'danger')
      ) {
        try {
          const pushTitle = savedItem.title || (savedItem.severity === 'danger' ? '⚠️ SaveMoney Alert' : '🔔 SaveMoney Notice');
          const pushRes = await sendWebPushNotification(pushSubs, {
            title: pushTitle,
            message: savedItem.message,
            url: '/alerts',
            tag: savedItem.type,
          });

          // Record push status on the alert row
          const pushSentAt = pushRes.sent > 0 ? new Date().toISOString() : null;
          const pushError = pushRes.failed > 0 ? `${pushRes.failed} delivery failure(s)` : null;

          if (useRemote && (pushSentAt || pushError)) {
            await supabase
              .from('alerts')
              .update({
                push_sent_at: pushSentAt,
                push_error: pushError,
              })
              .eq('id', savedItem.id);
          }

          savedItem.push_sent_at = pushSentAt;
          savedItem.push_error = pushError;
        } catch (pushErr: unknown) {
          // Push failure must never block saving the alert
          console.warn('[AlertEngine] Push notification dispatch failed (non-blocking):', pushErr);
          if (useRemote) {
            await supabase
              .from('alerts')
              .update({
                push_error: pushErr instanceof Error ? pushErr.message : String(pushErr),
              })
              .eq('id', savedItem.id)
              .catch(() => {});
          }
        }
      }
    }
  }

  return {
    success: true,
    newAlerts: savedAlerts,
    numbers: {
      spendableBudget,
      baseSpendableBudget: calculation.baseSpendableBudget,
      spentSoFar,
      spentToday,
      dailyAllowance,
      safeToSpendToday,
      daysRemaining,
      percentUsed: Math.round(percentUsed * 10) / 10,
      projectedSpend: projection.projectedMonthEndSpend,
      isProjectedOverBudget: projection.isProjectedOverBudget,
    },
    rulesEvaluated,
  };
}

/**
 * Diagnostic inspector for Alert Diagnostics page (Settings > Alert Diagnostics)
 */
export async function getAlertDiagnostics(userId: string, month: string = getCurrentMonthKey()) {
  const result = await evaluateAlerts(userId, month);
  const useRemote = isSupabaseConfigured();
  const supabase = useRemote ? getSupabaseServerClient() : (null as any);

  let recentAlerts: AlertItem[] = [];
  let pushSubsCount = 0;
  let lastPushError: string | null = null;

  if (useRemote) {
    const [alertsRes, subsRes] = await Promise.all([
      supabase.from('alerts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('push_subscriptions').select('id').eq('user_id', userId),
    ]);
    recentAlerts = alertsRes.data || [];
    pushSubsCount = subsRes.data?.length || 0;
    const errorAlert = recentAlerts.find((a) => a.push_error);
    lastPushError = errorAlert?.push_error || null;
  } else {
    recentAlerts = (await StorageService.getAlerts(userId)).slice(0, 20);
    pushSubsCount = (await StorageService.getPushSubscriptions(userId)).length;
  }

  const envChecks = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder')),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 20),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.length > 20),
    VAPID_PRIVATE_KEY: Boolean(process.env.VAPID_PRIVATE_KEY && process.env.VAPID_PRIVATE_KEY.length > 10),
    VAPID_SUBJECT: Boolean(process.env.VAPID_SUBJECT && process.env.VAPID_SUBJECT.includes('@')),
  };

  return {
    numbers: result.numbers,
    rulesEvaluated: result.rulesEvaluated,
    recentAlerts,
    pushSubscriptionsCount: pushSubsCount,
    lastPushError,
    envChecks,
  };
}
