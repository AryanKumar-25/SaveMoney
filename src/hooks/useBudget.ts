'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MonthlyBudget,
  FixedExpense,
  BudgetCalculationResult,
  Expense,
  Category,
  MonthEndProjectionResult,
  TimeTabTotals,
  ExtraMoneyTransfer,
  BalanceAdjustment,
  ExtraMoneyPool,
} from '@/lib/types';
import { StorageService, MonthSpendingSummary } from '@/lib/storage';
import {
  calculateSpendableBudget,
  calculateSafeToSpendToday,
  calculateMonthEndProjection,
  calculateTimeTabTotals,
} from '@/lib/calculations';
import { getCurrentMonthKey } from '@/lib/formatters';
import { useAuth } from './useAuth';

export function useBudget(initialMonth: string = getCurrentMonthKey()) {
  const { user } = useAuth();
  const userId = user?.id;

  const [currentMonth, setCurrentMonth] = useState<string>(initialMonth);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [extraTransfers, setExtraTransfers] = useState<ExtraMoneyTransfer[]>([]);
  const [balanceAdjustments, setBalanceAdjustments] = useState<BalanceAdjustment[]>([]);
  const [extraMoneyPool, setExtraMoneyPool] = useState<ExtraMoneyPool>({
    totalReceived: 0,
    totalTransferred: 0,
    availableExtraMoney: 0,
  });

  const [spending, setSpending] = useState<MonthSpendingSummary>({
    expenses: [],
    spentSoFarThisMonth: 0,
    spentToday: 0,
    spentThisWeek: 0,
    dailySpending: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load budget, fixed expenses, real spending, extra transfers, balance adjustments, and extra money pool
  const loadData = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const [
        budgetRes,
        fixedRes,
        spendingRes,
        allExpRes,
        catsRes,
        transfersRes,
        adjustmentsRes,
        poolRes,
      ] = await Promise.all([
        StorageService.getMonthlyBudget(month, userId),
        StorageService.getFixedExpenses(month, userId),
        StorageService.getMonthSpendingSummary(month, userId),
        StorageService.getAllExpenses(userId),
        StorageService.getCategories(userId),
        StorageService.getMonthExtraMoneyTransfers(month, userId),
        StorageService.getBalanceAdjustments(month, userId),
        StorageService.getExtraMoneyPool(userId),
      ]);

      setBudget(budgetRes.budget);
      setFixedExpenses(fixedRes);
      setSpending(spendingRes);
      setAllExpenses(allExpRes);
      setCategories(catsRes);
      setExtraTransfers(transfersRes);
      setBalanceAdjustments(adjustmentsRes);
      setExtraMoneyPool(poolRes);
    } catch (err: unknown) {
      console.error('Error loading budget data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData(currentMonth);

    const handleUpdate = () => {
      loadData(currentMonth);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-expense-updated', handleUpdate);
      window.addEventListener('savemoney-categories-updated', handleUpdate);
      window.addEventListener('savemoney-budget-updated', handleUpdate);
      window.addEventListener('savemoney-extra-money-updated', handleUpdate);
      window.addEventListener('savemoney-adjustments-updated', handleUpdate);
      return () => {
        window.removeEventListener('savemoney-expense-updated', handleUpdate);
        window.removeEventListener('savemoney-categories-updated', handleUpdate);
        window.removeEventListener('savemoney-budget-updated', handleUpdate);
        window.removeEventListener('savemoney-extra-money-updated', handleUpdate);
        window.removeEventListener('savemoney-adjustments-updated', handleUpdate);
      };
    }
  }, [currentMonth, loadData]);

  // Totals for transfers and adjustments in the current month
  const extraTransfersTotal = useMemo(() => {
    return extraTransfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [extraTransfers]);

  const balanceAdjustmentsTotal = useMemo(() => {
    return balanceAdjustments.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  }, [balanceAdjustments]);

  // Real-time calculation of spendable budget using the one shared calculation
  const calculation: BudgetCalculationResult = useMemo(() => {
    const income = budget?.income || 0;
    const savingsTarget = budget?.savings_target || 0;
    return calculateSpendableBudget(
      income,
      fixedExpenses,
      savingsTarget,
      extraTransfersTotal,
      balanceAdjustmentsTotal
    );
  }, [budget?.income, budget?.savings_target, fixedExpenses, extraTransfersTotal, balanceAdjustmentsTotal]);

  // Real-time safe to spend today calculation based on real spending (and spent today)
  const safeToSpend = useMemo(() => {
    return calculateSafeToSpendToday(
      calculation.spendableBudget,
      spending.spentSoFarThisMonth,
      spending.spentToday
    );
  }, [calculation.spendableBudget, spending.spentSoFarThisMonth, spending.spentToday]);

  // Real-time month-end projection based on daily spend pace
  const projection: MonthEndProjectionResult = useMemo(() => {
    return calculateMonthEndProjection(
      spending.spentSoFarThisMonth,
      calculation.spendableBudget
    );
  }, [spending.spentSoFarThisMonth, calculation.spendableBudget]);

  // Real-time totals for Time Tabs (Today, This week, This month, This year)
  const timeTabTotals: TimeTabTotals = useMemo(() => {
    return calculateTimeTabTotals(allExpenses);
  }, [allExpenses]);

  // Update Income and Savings Target
  const updateMonthlyBudget = async (income: number, savingsTarget: number) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await StorageService.saveMonthlyBudget(
        currentMonth,
        income,
        savingsTarget,
        userId
      );
      setBudget(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-budget-updated'));
      }
      return updated;
    } catch (err: unknown) {
      console.error('Error saving monthly budget:', err);
      setError(err instanceof Error ? err.message : 'Failed to save budget');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Add or edit a Fixed Expense
  const saveFixedExpense = async (
    expense: Omit<FixedExpense, 'id' | 'month'> & { id?: string }
  ) => {
    setSaving(true);
    setError(null);
    try {
      const saved = await StorageService.upsertFixedExpense(
        {
          ...expense,
          month: currentMonth,
        },
        userId
      );

      setFixedExpenses((prev) => {
        const idx = prev.findIndex((item) => item.id === saved.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [saved, ...prev];
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-budget-updated'));
      }
      return saved;
    } catch (err: unknown) {
      console.error('Error saving fixed expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to save fixed expense');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Delete a Fixed Expense
  const removeFixedExpense = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await StorageService.deleteFixedExpense(id, currentMonth, userId);
      setFixedExpenses((prev) => prev.filter((item) => item.id !== id));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-budget-updated'));
      }
    } catch (err: unknown) {
      console.error('Error deleting fixed expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete fixed expense');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const refreshBudget = useCallback(() => {
    loadData(currentMonth);
  }, [loadData, currentMonth]);

  return {
    currentMonth,
    setCurrentMonth,
    budget,
    fixedExpenses,
    allExpenses,
    categories,
    extraTransfers,
    extraTransfersTotal,
    balanceAdjustments,
    balanceAdjustmentsTotal,
    extraMoneyPool,
    spending,
    calculation,
    safeToSpend,
    projection,
    timeTabTotals,
    loading,
    saving,
    error,
    updateMonthlyBudget,
    saveFixedExpense,
    removeFixedExpense,
    refreshBudget,
  };
}
