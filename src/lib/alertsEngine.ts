import {
  AlertItem,
  AlertType,
  AlertSeverity,
  UserAlertSettings,
} from './types';
import { formatINR, getDaysRemainingInMonth } from './formatters';
import { calculateMonthEndProjection } from './calculations';

export const DEFAULT_ALERT_SETTINGS: UserAlertSettings = {
  overDaily: true,
  underDaily: true,
  budgetThresholds: true,
  thresholds: [50, 80, 100],
  projectionWarning: true,
  savingsAtRisk: true,
  pushNotifications: true,
};

export interface EvaluateAlertsParams {
  currentMonth: string; // 'YYYY-MM'
  spendableBudget: number;
  spentSoFar: number;
  spentToday: number;
  daysRemaining: number;
  lastExpense?: {
    amount: number;
    merchant?: string;
    date: string;
  } | null;
  existingFiredKeys?: Set<string>;
  settings?: Partial<UserAlertSettings>;
  referenceDate?: Date;
  userId?: string;
}

/**
 * Pure evaluation engine for generating alerts when an expense is added, edited, or evaluated.
 * Enforces once-per-month threshold deduplication rules.
 */
export function evaluateAlertRules(params: EvaluateAlertsParams): AlertItem[] {
  const {
    currentMonth,
    spendableBudget,
    spentSoFar,
    spentToday,
    daysRemaining,
    lastExpense,
    existingFiredKeys = new Set<string>(),
    settings: userSettings = {},
    referenceDate = new Date(),
    userId = 'user',
  } = params;

  const settings: UserAlertSettings = {
    ...DEFAULT_ALERT_SETTINGS,
    ...userSettings,
  };

  const newAlerts: AlertItem[] = [];
  const now = referenceDate.toISOString();

  // 1. Transaction-level Daily Check (Over or Under today's limit)
  if (lastExpense && spendableBudget > 0) {
    const spentBeforeToday = Math.max(0, spentSoFar - spentToday);
    const remainingAtStartOfToday = spendableBudget - spentBeforeToday;
    const dailyAllowance =
      remainingAtStartOfToday > 0 && daysRemaining > 0
        ? Math.round(remainingAtStartOfToday / daysRemaining)
        : 0;

    const formattedMerchant = lastExpense.merchant ? ` at ${lastExpense.merchant}` : '';

    if (spentToday > dailyAllowance) {
      if (settings.overDaily) {
        const overBy = spentToday - dailyAllowance;
        newAlerts.push({
          id: `alert-over-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: userId,
          type: 'over_daily',
          severity: spentSoFar > spendableBudget ? 'danger' : 'warning',
          message: `${formatINR(lastExpense.amount)} spent${formattedMerchant}. You're ${formatINR(overBy)} over today's limit.`,
          is_read: false,
          month: currentMonth,
          dedupe_key: null,
          created_at: now,
        });
      }
    } else {
      if (settings.underDaily) {
        const leftToday = dailyAllowance - spentToday;
        newAlerts.push({
          id: `alert-under-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: userId,
          type: 'under_daily',
          severity: 'info',
          message: `${formatINR(lastExpense.amount)} spent${formattedMerchant}. ${formatINR(leftToday)} left for today.`,
          is_read: false,
          month: currentMonth,
          dedupe_key: null,
          created_at: now,
        });
      }
    }
  }

  // 2. Monthly Budget Threshold Alerts (50%, 80%, 100%) - Fires ONCE per month per level
  if (settings.budgetThresholds && spendableBudget > 0) {
    const percentUsed = (spentSoFar / spendableBudget) * 100;
    const thresholds = (settings.thresholds || [50, 80, 100]).slice().sort((a, b) => b - a);

    for (const thresh of thresholds) {
      if (percentUsed >= thresh) {
        const dedupeKey = `threshold_${thresh}_${currentMonth}`;
        if (!existingFiredKeys.has(dedupeKey)) {
          let severity: AlertSeverity = 'info';
          let msg = `You've used ${thresh}% of this month's budget with ${daysRemaining} days left.`;

          if (thresh >= 100) {
            severity = 'danger';
            const overAmt = Math.max(0, spentSoFar - spendableBudget);
            msg =
              overAmt > 0
                ? `You've used 100% of this month's budget! You are over budget by ${formatINR(overAmt)}.`
                : `You've used 100% of this month's budget with ${daysRemaining} days left.`;
          } else if (thresh >= 80) {
            severity = 'warning';
          }

          newAlerts.push({
            id: `alert-thresh-${thresh}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            user_id: userId,
            type: `threshold_${thresh}` as AlertType,
            severity,
            message: msg,
            is_read: false,
            month: currentMonth,
            dedupe_key: dedupeKey,
            created_at: now,
          });
        }
      }
    }
  }

  // 3. Projection Warning Alert - Fires ONCE per month
  if (settings.projectionWarning && spendableBudget > 0 && spentSoFar > 0) {
    const projection = calculateMonthEndProjection(spentSoFar, spendableBudget, referenceDate);
    if (projection.isProjectedOverBudget) {
      const dedupeKey = `projection_warning_${currentMonth}`;
      if (!existingFiredKeys.has(dedupeKey)) {
        newAlerts.push({
          id: `alert-proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: userId,
          type: 'projection_warning',
          severity: 'warning',
          message: `At this pace (${formatINR(projection.averageDailySpend)}/day), you'll overspend by ${formatINR(projection.projectedSurplusOrDeficit)} this month.`,
          is_read: false,
          month: currentMonth,
          dedupe_key: dedupeKey,
          created_at: now,
        });
      }
    }
  }

  // 4. Savings at Risk Alert - Fires ONCE per month
  if (settings.savingsAtRisk && spendableBudget > 0) {
    if (spentSoFar > spendableBudget) {
      const dedupeKey = `savings_risk_${currentMonth}`;
      if (!existingFiredKeys.has(dedupeKey)) {
        const deficit = spentSoFar - spendableBudget;
        newAlerts.push({
          id: `alert-savings-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: userId,
          type: 'savings_risk',
          severity: 'danger',
          message: `Savings at risk: spending has exceeded your spendable budget by ${formatINR(deficit)}, impacting your monthly savings goal.`,
          is_read: false,
          month: currentMonth,
          dedupe_key: dedupeKey,
          created_at: now,
        });
      }
    }
  }

  return newAlerts;
}
