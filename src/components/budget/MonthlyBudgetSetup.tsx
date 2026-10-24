'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { FixedExpenseList } from './FixedExpenseList';
import { BudgetOverviewCard } from './BudgetOverviewCard';
import { BalanceAdjustmentModal } from './BalanceAdjustmentModal';
import { BalanceHistoryModal } from './BalanceHistoryModal';
import { useBudget } from '@/hooks/useBudget';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { BalanceAdjustment } from '@/lib/types';
import { formatINR, formatMonthName, getCurrentMonthKey } from '@/lib/formatters';
import {
  IndianRupee,
  PiggyBank,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Info,
  Calendar,
  SlidersHorizontal,
  History,
  Coins,
} from 'lucide-react';

const INCOME_PRESETS = [50000, 75000, 100000, 150000, 200000];
const SAVINGS_PERCENT_PRESETS = [15, 20, 25, 30, 40];

export function MonthlyBudgetSetup() {
  const { user } = useAuth();
  const userId = user?.id;

  const {
    currentMonth,
    setCurrentMonth,
    budget,
    fixedExpenses,
    calculation,
    spending,
    extraTransfers,
    balanceAdjustments,
    loading,
    saving,
    updateMonthlyBudget,
    saveFixedExpense,
    removeFixedExpense,
    refreshBudget,
  } = useBudget();

  // Local form state for income and savings target (empty initially until user enters or loads their real budget)
  const [incomeInput, setIncomeInput] = useState<string>('');
  const [savingsInput, setSavingsInput] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // Modals for balance adjustments and history
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentToEdit, setAdjustmentToEdit] = useState<BalanceAdjustment | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Sync inputs with loaded budget
  useEffect(() => {
    if (budget) {
      setIncomeInput(budget.income ? String(budget.income) : '');
      setSavingsInput(budget.savings_target ? String(budget.savings_target) : '');
    } else {
      setIncomeInput('');
      setSavingsInput('');
    }
  }, [budget]);

  // Handle month switching
  const handleShiftMonth = (offset: number) => {
    const [yearStr, monthStr] = currentMonth.split('-');
    const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1 + offset, 1);
    const newMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newMonthKey);
  };

  // Quick preset handlers
  const handleIncomePreset = (val: number) => {
    setIncomeInput(String(val));
    // Auto adjust savings to 25% by default if untouched
    const currentInc = val;
    const currentSav = parseFloat(savingsInput) || 0;
    if (currentSav === 0 || currentSav === 25000) {
      setSavingsInput(String(Math.round(currentInc * 0.25)));
    }
  };

  const handleSavingsPercent = (percent: number) => {
    const inc = parseFloat(incomeInput) || 0;
    const computedSavings = Math.round((inc * percent) / 100);
    setSavingsInput(String(computedSavings));
  };

  // Submit changes
  const handleSaveBudget = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError('');

    const inc = parseFloat(incomeInput);
    if (isNaN(inc) || inc <= 0) {
      setFormError('Monthly income is required and must be greater than ₹0');
      return;
    }

    const sav = savingsInput.trim() === '' ? 0 : parseFloat(savingsInput);
    if (isNaN(sav) || sav < 0) {
      setFormError('Savings target cannot be negative');
      return;
    }

    try {
      await updateMonthlyBudget(inc, sav);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setFormError('Failed to save monthly budget. Please check connection.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Month Navigation and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            Monthly Budget Setup
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure your monthly cashflow: income, fixed commitments, and savings goal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Month Selector Pill */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => handleShiftMonth(-1)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-3">
              <Calendar className="w-3.5 h-3.5 text-brand-primary" />
              <span className="text-xs sm:text-sm font-bold text-navy-900 dark:text-white">
                {formatMonthName(currentMonth)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleShiftMonth(1)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={<SlidersHorizontal className="w-3.5 h-3.5 text-brand-primary" />}
            onClick={() => {
              setAdjustmentToEdit(null);
              setAdjustmentModalOpen(true);
            }}
          >
            Adjust Balance
          </Button>

          {(balanceAdjustments.length > 0 || extraTransfers.length > 0) && (
            <Button
              size="sm"
              variant="ghost"
              icon={<History className="w-3.5 h-3.5" />}
              onClick={() => setHistoryModalOpen(true)}
              className="text-xs text-slate-500 hover:text-navy-900 dark:hover:text-white"
            >
              History ({balanceAdjustments.length + extraTransfers.length})
            </Button>
          )}
        </div>
      </div>

      {/* Top Banner: Spendable Overview Card */}
      <BudgetOverviewCard
        calculation={calculation}
        monthName={formatMonthName(currentMonth)}
      />

      {/* Two Column Layout: Income & Savings Target on Left, Fixed Expenses on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Income & Savings Settings */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader
              title="1. Monthly Income"
              subtitle="Your take-home salary or expected monthly earnings"
            />

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <Input
                label="Monthly In-Hand Income"
                type="number"
                prefix="₹"
                placeholder="100000"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                hint="e.g. ₹1,00,000 after PF and taxes"
                required
              />

              {/* Quick Income Chips */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Quick Select
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INCOME_PRESETS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleIncomePreset(val)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors border ${
                        parseFloat(incomeInput) === val
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-primary'
                      }`}
                    >
                      {formatINR(val)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <CardHeader
                  title="2. Savings Target"
                  subtitle="How much you want to tuck away this month before spending"
                />

                <Input
                  label="Monthly Target"
                  type="number"
                  prefix="₹"
                  placeholder="25000"
                  value={savingsInput}
                  onChange={(e) => setSavingsInput(e.target.value)}
                  hint={`Currently ${calculation.savingsRatePercent}% of monthly income`}
                  required
                />

                {/* Percentage Presets */}
                <div className="mt-3">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Target % of Income
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SAVINGS_PERCENT_PRESETS.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleSavingsPercent(pct)}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                      >
                        {pct}% ({formatINR(Math.round(((parseFloat(incomeInput) || 0) * pct) / 100))})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Calculation Summary Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Income</span>
                  <span className="font-semibold text-navy-900 dark:text-slate-100">
                    +{formatINR(calculation.income)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Fixed Expenses ({fixedExpenses.length} items)</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    -{formatINR(calculation.totalFixedExpenses)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Savings Target</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    -{formatINR(calculation.savingsTarget)}
                  </span>
                </div>

                {calculation.extraTransfers > 0 && (
                  <div className="flex justify-between text-slate-500 pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                      <Coins className="w-3 h-3 text-amber-500" />
                      Extra Money Moved
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      +{formatINR(calculation.extraTransfers)}
                    </span>
                  </div>
                )}

                {calculation.balanceAdjustments !== 0 && (
                  <div className="flex justify-between text-slate-500 pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                      <SlidersHorizontal className="w-3 h-3 text-brand-primary" />
                      Balance Adjustments ({balanceAdjustments.length})
                    </span>
                    <span
                      className={`font-semibold ${
                        calculation.balanceAdjustments > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {calculation.balanceAdjustments > 0 ? '+' : ''}
                      {formatINR(calculation.balanceAdjustments)}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-sm">
                  <span className="text-navy-900 dark:text-white">Spendable Budget</span>
                  <span
                    className={
                      calculation.isDeficit
                        ? 'text-rose-600'
                        : 'text-brand-primary'
                    }
                  >
                    {formatINR(calculation.spendableBudget)}
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 font-bold">
                  {formError}
                </div>
              )}

              {/* Save Button */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  size="md"
                  loading={saving}
                  className="w-full"
                  icon={saveSuccess ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                >
                  {saveSuccess ? 'Budget Saved!' : 'Save Monthly Budget'}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right Column (7 Cols): Fixed Expenses Manager */}
        <div className="lg:col-span-7">
          <FixedExpenseList
            expenses={fixedExpenses}
            onAdd={saveFixedExpense}
            onDelete={removeFixedExpense}
            saving={saving}
          />
        </div>
      </div>

      {/* Balance Adjustment & History Modals */}
      <BalanceAdjustmentModal
        isOpen={adjustmentModalOpen}
        onClose={() => {
          setAdjustmentModalOpen(false);
          setAdjustmentToEdit(null);
        }}
        currentSpendableBudget={calculation.spendableBudget}
        spentSoFarThisMonth={spending.spentSoFarThisMonth}
        spentToday={spending.spentToday}
        targetMonth={currentMonth}
        adjustmentToEdit={adjustmentToEdit}
        onSaved={refreshBudget}
      />

      <BalanceHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        month={currentMonth}
        adjustments={balanceAdjustments}
        transfers={extraTransfers}
        onEditAdjustment={(adj) => {
          setAdjustmentToEdit(adj);
          setAdjustmentModalOpen(true);
          setHistoryModalOpen(false);
        }}
        onDeleteAdjustment={async (id) => {
          await StorageService.deleteBalanceAdjustment(id, userId);
          refreshBudget();
        }}
        onUndoTransfer={async (id) => {
          await StorageService.undoExtraMoneyTransfer(id, userId);
          refreshBudget();
        }}
      />
    </div>
  );
}
