import { describe, it, expect } from 'vitest';
import { calculateMonthlyReport, calculateYearlyReport } from '../lib/reportCalculations';
import { Expense, MonthlyBudget } from '../lib/types';

describe('Report Calculations', () => {
  describe('calculateMonthlyReport', () => {
    const mockExpenses: Expense[] = [
      {
        id: '1',
        amount: 500,
        category: 'Food',
        merchant: 'Swiggy',
        note: 'Dinner',
        date: '2026-10-02T19:00:00Z',
      },
      {
        id: '2',
        amount: 1500,
        category: 'Food',
        merchant: 'Zomato',
        note: 'Party',
        date: '2026-10-05T20:00:00Z',
      },
      {
        id: '3',
        amount: 2000,
        category: 'Travel',
        merchant: 'Uber',
        note: 'Airport cab',
        date: '2026-10-10T08:00:00Z',
      },
      {
        id: '4',
        amount: 5000,
        category: 'Shopping',
        merchant: 'Amazon',
        note: 'Headphones',
        date: '2026-10-15T14:00:00Z',
      },
      {
        id: '5',
        amount: 1000,
        category: 'Entertainment',
        merchant: 'BookMyShow',
        note: 'Movie tickets',
        date: '2026-10-20T18:00:00Z',
      },
      {
        id: '6',
        amount: 800,
        category: 'Food',
        merchant: 'Swiggy',
        note: 'Lunch',
        date: '2026-10-22T13:00:00Z',
      },
    ];

    const mockLastMonthExpenses: Expense[] = [
      {
        id: '10',
        amount: 8000,
        category: 'Food',
        merchant: 'Groceries',
        date: '2026-09-10T12:00:00Z',
      },
    ];

    const mockBudget: MonthlyBudget = {
      id: 'b-1',
      user_id: 'user-1',
      month: '2026-10',
      income: 80000,
      savings_target: 20000,
    };

    it('calculates total spent, budget comparison, and daily average accurately', () => {
      const fixedExpensesTotal = 30000;
      // Spendable budget = 80000 - 30000 - 20000 = 30000
      // Total spent = 500 + 1500 + 2000 + 5000 + 1000 + 800 = 10800
      const report = calculateMonthlyReport({
        month: '2026-10',
        expenses: mockExpenses,
        lastMonthExpenses: mockLastMonthExpenses,
        budget: mockBudget,
        fixedExpensesTotal,
        daysPassed: 24,
        totalDaysInMonth: 31,
      });

      expect(report.totalSpent).toBe(10800);
      expect(report.spendableBudget).toBe(30000);
      expect(report.isOverBudget).toBe(false);
      expect(report.remainingBudget).toBe(19200);
      expect(report.budgetUsedPercent).toBe(36); // (10800 / 30000) * 100 = 36%
      expect(report.dailyAverage).toBe(450); // 10800 / 24 = 450
      expect(report.transactionCount).toBe(6);
    });

    it('calculates month-over-month differences correctly', () => {
      const report = calculateMonthlyReport({
        month: '2026-10',
        expenses: mockExpenses,
        lastMonthExpenses: mockLastMonthExpenses,
        budget: mockBudget,
        fixedExpensesTotal: 30000,
      });

      // Total current: 10800, Last month: 8000
      expect(report.lastMonthSpent).toBe(8000);
      expect(report.monthOverMonthDifference).toBe(2800);
      expect(report.isIncreaseVsLastMonth).toBe(true);
      expect(report.monthOverMonthPercentChange).toBe(35); // 2800 / 8000 * 100 = 35%
    });

    it('correctly aggregates top 5 categories and top 5 merchants', () => {
      const report = calculateMonthlyReport({
        month: '2026-10',
        expenses: mockExpenses,
        lastMonthExpenses: [],
        budget: mockBudget,
      });

      // Food total = 500 + 1500 + 800 = 2800 (count: 3)
      // Shopping total = 5000 (count: 1)
      // Travel total = 2000 (count: 1)
      // Entertainment total = 1000 (count: 1)
      expect(report.top5Categories[0].category).toBe('Shopping');
      expect(report.top5Categories[0].amount).toBe(5000);
      expect(report.top5Categories[1].category).toBe('Food');
      expect(report.top5Categories[1].amount).toBe(2800);
      expect(report.top5Categories[1].count).toBe(3);

      // Merchants: Amazon (5000), Uber (2000), Zomato (1500), Swiggy (1300), BookMyShow (1000)
      expect(report.top5Merchants[0].merchant).toBe('Amazon');
      expect(report.top5Merchants[0].amount).toBe(5000);
      expect(report.top5Merchants[1].merchant).toBe('Uber');
      expect(report.top5Merchants[1].amount).toBe(2000);
      expect(report.top5Merchants[3].merchant).toBe('Swiggy');
      expect(report.top5Merchants[3].amount).toBe(1300);
      expect(report.top5Merchants[3].count).toBe(2);
    });

    it('finds the biggest single expense', () => {
      const report = calculateMonthlyReport({
        month: '2026-10',
        expenses: mockExpenses,
        lastMonthExpenses: [],
        budget: mockBudget,
      });

      expect(report.biggestExpense).not.toBeNull();
      expect(report.biggestExpense?.merchant).toBe('Amazon');
      expect(report.biggestExpense?.amount).toBe(5000);
    });

    it('handles zero expenses gracefully', () => {
      const report = calculateMonthlyReport({
        month: '2026-10',
        expenses: [],
        lastMonthExpenses: [],
        budget: null,
      });

      expect(report.totalSpent).toBe(0);
      expect(report.spendableBudget).toBe(0);
      expect(report.top5Categories).toHaveLength(0);
      expect(report.top5Merchants).toHaveLength(0);
      expect(report.biggestExpense).toBeNull();
      expect(report.dailyAverage).toBe(0);
    });
  });

  describe('calculateYearlyReport', () => {
    it('aggregates 12 months with savings target hit or missed status', () => {
      const allExpenses: Expense[] = [
        { id: '1', amount: 20000, category: 'Food', date: '2026-01-15T00:00:00Z' },
        { id: '2', amount: 45000, category: 'Shopping', date: '2026-02-10T00:00:00Z' },
        { id: '3', amount: 25000, category: 'Travel', date: '2026-03-05T00:00:00Z' },
      ];

      const monthlyBudgets: MonthlyBudget[] = [
        { id: 'b1', user_id: 'u1', month: '2026-01', income: 100000, savings_target: 30000 },
        { id: 'b2', user_id: 'u1', month: '2026-02', income: 100000, savings_target: 30000 },
        { id: 'b3', user_id: 'u1', month: '2026-03', income: 100000, savings_target: 30000 },
      ];

      const fixedExpensesByMonth = {
        '2026-01': 40000, // Spendable = 100000 - 40000 - 30000 = 30000. Spent: 20000. Actual savings = 100000 - 20000 - 40000 = 40000 >= 30000 (HIT)
        '2026-02': 40000, // Spendable = 30000. Spent: 45000. Actual savings = 100000 - 45000 - 40000 = 15000 < 30000 (MISSED)
        '2026-03': 40000, // Spendable = 30000. Spent: 25000. Actual savings = 35000 >= 30000 (HIT)
      };

      const yearly = calculateYearlyReport({
        year: 2026,
        allExpenses,
        monthlyBudgets,
        fixedExpensesByMonth,
      });

      expect(yearly.year).toBe(2026);
      expect(yearly.monthsData).toHaveLength(12);
      expect(yearly.totalSpentYear).toBe(90000);

      // January checks
      expect(yearly.monthsData[0].monthLabel).toBe('Jan');
      expect(yearly.monthsData[0].totalSpent).toBe(20000);
      expect(yearly.monthsData[0].savingsTargetHit).toBe(true);
      expect(yearly.monthsData[0].actualSavings).toBe(40000);

      // February checks (over spent, missed target)
      expect(yearly.monthsData[1].monthLabel).toBe('Feb');
      expect(yearly.monthsData[1].totalSpent).toBe(45000);
      expect(yearly.monthsData[1].savingsTargetHit).toBe(false);
      expect(yearly.monthsData[1].savingsDeficit).toBe(15000);

      // March checks
      expect(yearly.monthsData[2].monthLabel).toBe('Mar');
      expect(yearly.monthsData[2].totalSpent).toBe(25000);
      expect(yearly.monthsData[2].savingsTargetHit).toBe(true);

      // Total months hit
      expect(yearly.monthsTargetHitCount).toBe(2);
    });
  });
});
