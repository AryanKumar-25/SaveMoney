import { MonthlyBudget, FixedExpense } from './types';
import { StorageService } from './storage';

/**
 * Returns the previous month key given 'YYYY-MM'
 * e.g., '2026-10' -> '2026-09', '2026-01' -> '2025-12'
 */
export function getPreviousMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10) - 1;

  if (m === 0) {
    m = 12;
    y -= 1;
  }

  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Checks if the user should be prompted for month rollover.
 * Conditions:
 * 1. Current month has NO configured budget yet (budget is null or income == 0 and savingsTarget == 0).
 * 2. Previous month DOES have a valid configured budget (income > 0 or savingsTarget > 0 or fixed expenses > 0).
 * 3. The user has not already dismissed or confirmed rollover for this month in this session/browser.
 */
export function shouldPromptMonthRollover(params: {
  currentMonth: string;
  currentBudget: MonthlyBudget | null;
  currentFixedExpenses?: FixedExpense[];
  previousBudget: MonthlyBudget | null;
  previousFixedExpenses?: FixedExpense[];
  isDismissedOrConfirmed?: boolean;
}): boolean {
  const {
    currentBudget,
    currentFixedExpenses = [],
    previousBudget,
    previousFixedExpenses = [],
    isDismissedOrConfirmed = false,
  } = params;

  if (isDismissedOrConfirmed) {
    return false;
  }

  // If current month already has a configured budget or fixed expenses, no rollover needed
  const currentHasBudget =
    currentBudget &&
    ((Number(currentBudget.income) || 0) > 0 || (Number(currentBudget.savings_target) || 0) > 0);
  const currentHasFixed = currentFixedExpenses.length > 0;

  if (currentHasBudget || currentHasFixed) {
    return false;
  }

  // Previous month must have something worth rolling over
  const previousHasBudget =
    previousBudget &&
    ((Number(previousBudget.income) || 0) > 0 || (Number(previousBudget.savings_target) || 0) > 0);
  const previousHasFixed = previousFixedExpenses.length > 0;

  return Boolean(previousHasBudget || previousHasFixed);
}

/**
 * Executes month rollover by cloning the previous month's budget and fixed expenses
 * into the target month. Past months remain completely intact and unchanged.
 */
export async function executeMonthRollover(params: {
  userId?: string;
  targetMonth: string;
  sourceBudget: MonthlyBudget;
  sourceFixedExpenses: FixedExpense[];
  copyFixedExpenses?: boolean;
}): Promise<{
  budget: MonthlyBudget;
  fixedExpenses: FixedExpense[];
}> {
  const {
    userId,
    targetMonth,
    sourceBudget,
    sourceFixedExpenses,
    copyFixedExpenses = true,
  } = params;

  // 1. Save new budget for the target month pre-filled with source budget numbers
  const savedBudget = await StorageService.saveMonthlyBudget(
    targetMonth,
    Number(sourceBudget.income) || 0,
    Number(sourceBudget.savings_target) || 0,
    userId
  );

  // 2. Clone fixed expenses for the target month if requested
  const clonedExpenses: FixedExpense[] = [];

  if (copyFixedExpenses && sourceFixedExpenses.length > 0) {
    for (const item of sourceFixedExpenses) {
      const cloned = await StorageService.upsertFixedExpense(
        {
          month: targetMonth,
          title: item.title,
          amount: Number(item.amount) || 0,
          category: item.category,
          due_day: item.due_day,
          is_paid: false, // Reset paid status for new month!
        },
        userId
      );
      clonedExpenses.push(cloned);
    }
  }

  return {
    budget: savedBudget,
    fixedExpenses: clonedExpenses,
  };
}
