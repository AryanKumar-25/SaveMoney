import { describe, it, expect } from 'vitest';
import {
  calculateSpendableBudget,
  calculateSafeToSpendToday,
  calculateMonthEndProjection,
  calculateTimeTabTotals,
  calculateCategoryBreakdown,
  calculateChartDataForRange,
} from '../lib/calculations';
import { FixedExpense, Expense } from '../lib/types';

describe('calculateSpendableBudget', () => {
  it('correctly calculates spendable budget with income, fixed expenses list, and savings target', () => {
    const fixedExpenses: FixedExpense[] = [
      { id: '1', title: 'Rent', amount: 25000, category: 'Rent', month: '2026-10' },
      { id: '2', title: 'Netflix', amount: 650, category: 'Subscription', month: '2026-10' },
      { id: '3', title: 'Car EMI', amount: 12000, category: 'EMI', month: '2026-10' },
      { id: '4', title: 'Broadband', amount: 999, category: 'Bills', month: '2026-10' },
    ]; // Total = 38,649

    const income = 100000;
    const savingsTarget = 20000;

    const result = calculateSpendableBudget(income, fixedExpenses, savingsTarget);

    expect(result.income).toBe(100000);
    expect(result.totalFixedExpenses).toBe(38649);
    expect(result.savingsTarget).toBe(20000);
    // 100,000 - 38,649 - 20,000 = 41,351
    expect(result.spendableBudget).toBe(41351);
    expect(result.isDeficit).toBe(false);
    expect(result.savingsRatePercent).toBe(20);
    expect(result.fixedExpensesPercent).toBe(38.6);
    expect(result.spendablePercent).toBe(41.4);
  });

  it('handles negative / deficit scenario when expenses exceed income', () => {
    const result = calculateSpendableBudget(50000, 45000, 15000);
    // 50,000 - 45,000 - 15,000 = -10,000
    expect(result.spendableBudget).toBe(-10000);
    expect(result.isDeficit).toBe(true);
  });

  it('handles 0 values gracefully without NaN', () => {
    const result = calculateSpendableBudget(0, 0, 0);
    expect(result.spendableBudget).toBe(0);
    expect(result.savingsRatePercent).toBe(0);
    expect(result.isDeficit).toBe(false);
  });
});

describe('calculateSafeToSpendToday', () => {
  it('correctly divides remaining budget by remaining days in the month including today', () => {
    // Oct 15 in a 31-day month: 31 - 15 + 1 = 17 days
    const mockDate = new Date(2026, 9, 15);
    const spendableBudget = 34000;
    const spentSoFar = 17000;

    const result = calculateSafeToSpendToday(spendableBudget, spentSoFar, mockDate);

    expect(result.remainingBudget).toBe(17000);
    expect(result.daysLeftInMonth).toBe(17);
    expect(result.safeToSpendToday).toBe(1000);
    expect(result.isOverBudget).toBe(false);
  });

  it('handles the first day of the month (all days remaining)', () => {
    // Oct 1 in a 31-day month: 31 days left
    const mockDate = new Date(2026, 9, 1);
    const result = calculateSafeToSpendToday(31000, 0, 0, mockDate);

    expect(result.daysLeftInMonth).toBe(31);
    expect(result.dailyAllowanceForToday).toBe(1000);
    expect(result.safeToSpendRemainingToday).toBe(1000);
    expect(result.isOverToday).toBe(false);
    expect(result.isOverBudget).toBe(false);
  });

  it('handles the last day of the month (1 day left)', () => {
    // Oct 31 in a 31-day month: 31 - 31 + 1 = 1 day
    const mockDate = new Date(2026, 9, 31);
    const result = calculateSafeToSpendToday(30000, 25000, mockDate);

    expect(result.daysLeftInMonth).toBe(1);
    expect(result.remainingBudget).toBe(5000);
    expect(result.safeToSpendToday).toBe(5000);
    expect(result.isOverBudget).toBe(false);
  });

  it('reports overToday when spent today exceeds daily allowance', () => {
    // Oct 23 in 31-day month: 9 days remaining
    const mockDate = new Date(2026, 9, 23);
    const spendableBudget = 9000;
    // Spent total 1500, of which 1500 was spent today (spentBeforeToday = 0)
    // Daily allowance at start of today = 9000 / 9 = 1000
    // Spent today = 1500 -> over by 500
    const result = calculateSafeToSpendToday(spendableBudget, 1500, 1500, mockDate);

    expect(result.dailyAllowanceForToday).toBe(1000);
    expect(result.spentToday).toBe(1500);
    expect(result.isOverToday).toBe(true);
    expect(result.overTodayBy).toBe(500);
    expect(result.safeToSpendRemainingToday).toBe(0);
    expect(result.isOverBudget).toBe(false);
  });

  it('reports overBudget when total spend exceeds monthly spendable budget', () => {
    const mockDate = new Date(2026, 9, 20);
    const result = calculateSafeToSpendToday(20000, 22000, 500, mockDate);

    expect(result.remainingBudget).toBe(-2000);
    expect(result.isOverBudget).toBe(true);
    expect(result.overBudgetBy).toBe(2000);
    expect(result.safeToSpendToday).toBe(0);
  });

  it('correctly calculates safe to spend today on Oct 23 with zero spending (~287 for 2580 budget)', () => {
    // Oct 23 in a 31-day month: 31 - 23 + 1 = 9 days left
    const mockDate = new Date(2026, 9, 23);
    const spendableBudget = 2580;
    const spentSoFar = 0;

    const result = calculateSafeToSpendToday(spendableBudget, spentSoFar, mockDate);

    expect(result.daysLeftInMonth).toBe(9);
    expect(result.remainingBudget).toBe(2580);
    // 2580 / 9 = 286.67 -> rounds to 287
    expect(result.safeToSpendToday).toBe(287);
    expect(result.isOverBudget).toBe(false);
  });
});

describe('calculateMonthEndProjection', () => {
  it('correctly projects month end spending on track', () => {
    // Day 20 of 31-day month (October). Spent 10,000 so far.
    // Average daily = 10,000 / 20 = 500/day
    // Projected = 500 * 31 = 15,500
    const mockDate = new Date(2026, 9, 20);
    const result = calculateMonthEndProjection(10000, 20000, mockDate);

    expect(result.daysPassed).toBe(20);
    expect(result.totalDaysInMonth).toBe(31);
    expect(result.averageDailySpend).toBe(500);
    expect(result.projectedMonthEndSpend).toBe(15500);
    expect(result.isProjectedOverBudget).toBe(false);
    expect(result.projectedDifference).toBe(4500); // 20,000 - 15,500 = surplus 4500
  });

  it('correctly projects month end spending when pacing over budget', () => {
    // Day 10 of 31-day month. Spent 10,000 so far. Budget = 25,000.
    // Average daily = 1,000/day
    // Projected = 1,000 * 31 = 31,000
    const mockDate = new Date(2026, 9, 10);
    const result = calculateMonthEndProjection(10000, 25000, mockDate);

    expect(result.averageDailySpend).toBe(1000);
    expect(result.projectedMonthEndSpend).toBe(31000);
    expect(result.isProjectedOverBudget).toBe(true);
    expect(result.projectedSurplusOrDeficit).toBe(6000); // 31,000 - 25,000
  });

  it('handles zero spend gracefully', () => {
    const mockDate = new Date(2026, 9, 10);
    const result = calculateMonthEndProjection(0, 30000, mockDate);

    expect(result.averageDailySpend).toBe(0);
    expect(result.projectedMonthEndSpend).toBe(0);
    expect(result.isProjectedOverBudget).toBe(false);
  });

  it('matches actual spend on the last day of the month', () => {
    // Day 31 of 31-day month
    const mockDate = new Date(2026, 9, 31);
    const result = calculateMonthEndProjection(24000, 25000, mockDate);

    expect(result.projectedMonthEndSpend).toBe(24000);
    expect(result.isProjectedOverBudget).toBe(false);
  });
});

describe('calculateTimeTabTotals', () => {
  it('correctly aggregates Today, This Week, This Month, and This Year', () => {
    // Reference date: Thursday, 23 Oct 2026
    const refDate = new Date(2026, 9, 23, 14, 0, 0);

    const expenses: Expense[] = [
      // Today
      { id: '1', amount: 500, category: 'Food', date: '2026-10-23T10:00:00.000Z' },
      // Earlier this week (e.g. Tuesday 21 Oct)
      { id: '2', amount: 1200, category: 'Travel', date: '2026-10-21T12:00:00.000Z' },
      // Earlier this month (e.g. 5 Oct)
      { id: '3', amount: 3000, category: 'Shopping', date: '2026-10-05T08:00:00.000Z' },
      // Earlier this year (e.g. March 2026)
      { id: '4', amount: 10000, category: 'Bills', date: '2026-03-15T10:00:00.000Z' },
      // Previous year (2025) - should NOT count towards this year
      { id: '5', amount: 5000, category: 'Other', date: '2025-11-20T10:00:00.000Z' },
    ];

    const totals = calculateTimeTabTotals(expenses, refDate);

    expect(totals.today).toBe(500);
    expect(totals.thisWeek).toBe(1700); // 500 + 1200
    expect(totals.thisMonth).toBe(4700); // 500 + 1200 + 3000
    expect(totals.thisYear).toBe(14700); // 4700 + 10000
  });
});

describe('calculateCategoryBreakdown', () => {
  it('groups spending by category and calculates percentages sorted descending', () => {
    const expenses: Expense[] = [
      { id: '1', amount: 600, category: 'Food', date: '2026-10-23' },
      { id: '2', amount: 400, category: 'Food', date: '2026-10-22' },
      { id: '3', amount: 500, category: 'Travel', date: '2026-10-21' },
      { id: '4', amount: 500, category: 'Shopping', date: '2026-10-20' },
    ]; // Total = 2000. Food = 1000 (50%), Travel = 500 (25%), Shopping = 500 (25%)

    const breakdown = calculateCategoryBreakdown(expenses);

    expect(breakdown).toHaveLength(3);
    expect(breakdown[0].category).toBe('Food');
    expect(breakdown[0].amount).toBe(1000);
    expect(breakdown[0].percentage).toBe(50);
    expect(breakdown[0].count).toBe(2);

    expect(breakdown[1].amount).toBe(500);
    expect(breakdown[1].percentage).toBe(25);
  });
});

describe('calculateChartDataForRange', () => {
  it('generates 7 data points for 7D range including safeLimit line', () => {
    const refDate = new Date(2026, 9, 23);
    const expenses: Expense[] = [
      { id: '1', amount: 450, category: 'Food', date: '2026-10-23T12:00:00' },
      { id: '2', amount: 800, category: 'Travel', date: '2026-10-20T10:00:00' },
    ];

    const { points, totalSpent } = calculateChartDataForRange(expenses, '7D', 1000, refDate);

    expect(points).toHaveLength(7);
    expect(totalSpent).toBe(1250);
    // Last point should be Today
    expect(points[points.length - 1].date).toBe('Today');
    expect(points[points.length - 1].amount).toBe(450);
    expect(points[points.length - 1].safeLimit).toBe(1000);
  });
});
