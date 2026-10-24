import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPreviousMonthKey,
  shouldPromptMonthRollover,
  executeMonthRollover,
} from '../lib/monthRollover';
import { MonthlyBudget, FixedExpense } from '../lib/types';
import { StorageService } from '../lib/storage';

describe('Month Rollover Logic', () => {
  describe('getPreviousMonthKey', () => {
    it('returns the preceding month for mid-year months', () => {
      expect(getPreviousMonthKey('2026-10')).toBe('2026-09');
      expect(getPreviousMonthKey('2026-05')).toBe('2026-04');
      expect(getPreviousMonthKey('2026-02')).toBe('2026-01');
    });

    it('correctly wraps around the year boundary for January', () => {
      expect(getPreviousMonthKey('2026-01')).toBe('2025-12');
      expect(getPreviousMonthKey('2030-01')).toBe('2029-12');
    });
  });

  describe('shouldPromptMonthRollover', () => {
    const prevBudget: MonthlyBudget = {
      id: 'b-sept',
      user_id: 'u-1',
      month: '2026-09',
      income: 100000,
      savings_target: 25000,
    };

    const prevFixed: FixedExpense[] = [
      {
        id: 'fe-1',
        month: '2026-09',
        title: 'Rent',
        amount: 25000,
        category: 'Rent',
        is_paid: true,
      },
    ];

    it('prompts rollover when new month is empty and previous month was configured', () => {
      const shouldPrompt = shouldPromptMonthRollover({
        currentMonth: '2026-10',
        currentBudget: null,
        currentFixedExpenses: [],
        previousBudget: prevBudget,
        previousFixedExpenses: prevFixed,
        isDismissedOrConfirmed: false,
      });

      expect(shouldPrompt).toBe(true);
    });

    it('does NOT prompt if current month is already configured', () => {
      const currentBudget: MonthlyBudget = {
        id: 'b-oct',
        user_id: 'u-1',
        month: '2026-10',
        income: 100000,
        savings_target: 25000,
      };

      const shouldPrompt = shouldPromptMonthRollover({
        currentMonth: '2026-10',
        currentBudget,
        currentFixedExpenses: [],
        previousBudget: prevBudget,
        previousFixedExpenses: prevFixed,
      });

      expect(shouldPrompt).toBe(false);
    });

    it('does NOT prompt if current month already has fixed expenses', () => {
      const shouldPrompt = shouldPromptMonthRollover({
        currentMonth: '2026-10',
        currentBudget: null,
        currentFixedExpenses: prevFixed,
        previousBudget: prevBudget,
      });

      expect(shouldPrompt).toBe(false);
    });

    it('does NOT prompt if previous month was never configured', () => {
      const shouldPrompt = shouldPromptMonthRollover({
        currentMonth: '2026-10',
        currentBudget: null,
        currentFixedExpenses: [],
        previousBudget: null,
        previousFixedExpenses: [],
      });

      expect(shouldPrompt).toBe(false);
    });

    it('does NOT prompt if already dismissed or confirmed by the user', () => {
      const shouldPrompt = shouldPromptMonthRollover({
        currentMonth: '2026-10',
        currentBudget: null,
        currentFixedExpenses: [],
        previousBudget: prevBudget,
        previousFixedExpenses: prevFixed,
        isDismissedOrConfirmed: true,
      });

      expect(shouldPrompt).toBe(false);
    });
  });

  describe('executeMonthRollover', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('creates a new budget for target month pre-filled from source, and duplicates fixed expenses with is_paid reset to false', async () => {
      const sourceBudget: MonthlyBudget = {
        id: 'b-prev',
        user_id: 'u-1',
        month: '2026-09',
        income: 120000,
        savings_target: 35000,
      };

      const sourceFixed: FixedExpense[] = [
        {
          id: 'fe-old-1',
          month: '2026-09',
          title: 'Apartment Rent',
          amount: 30000,
          category: 'Rent',
          due_day: 5,
          is_paid: true,
        },
        {
          id: 'fe-old-2',
          month: '2026-09',
          title: 'Car Loan EMI',
          amount: 15000,
          category: 'EMI',
          due_day: 10,
          is_paid: true,
        },
      ];

      vi.spyOn(StorageService, 'saveMonthlyBudget').mockResolvedValue({
        id: 'b-new',
        user_id: 'u-1',
        month: '2026-10',
        income: 120000,
        savings_target: 35000,
      });

      vi.spyOn(StorageService, 'upsertFixedExpense').mockImplementation(async (exp) => {
        return {
          id: `new-${Math.random()}`,
          month: exp.month,
          title: exp.title,
          amount: exp.amount,
          category: exp.category,
          due_day: exp.due_day,
          is_paid: exp.is_paid || false,
        };
      });

      const result = await executeMonthRollover({
        userId: 'u-1',
        targetMonth: '2026-10',
        sourceBudget,
        sourceFixedExpenses: sourceFixed,
        copyFixedExpenses: true,
      });

      expect(StorageService.saveMonthlyBudget).toHaveBeenCalledWith(
        '2026-10',
        120000,
        35000,
        'u-1'
      );

      expect(result.budget.month).toBe('2026-10');
      expect(result.budget.income).toBe(120000);
      expect(result.budget.savings_target).toBe(35000);

      expect(result.fixedExpenses).toHaveLength(2);
      expect(result.fixedExpenses[0].title).toBe('Apartment Rent');
      expect(result.fixedExpenses[0].month).toBe('2026-10');
      expect(result.fixedExpenses[0].is_paid).toBe(false); // Clean reset for new month
      expect(result.fixedExpenses[1].title).toBe('Car Loan EMI');
      expect(result.fixedExpenses[1].is_paid).toBe(false);
    });
  });
});
