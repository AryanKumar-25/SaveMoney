'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { MonthlyBudget, FixedExpense } from '@/lib/types';
import { formatINR, formatMonthName, getCurrentMonthKey } from '@/lib/formatters';
import {
  getPreviousMonthKey,
  shouldPromptMonthRollover,
  executeMonthRollover,
} from '@/lib/monthRollover';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Sparkles,
  Calendar,
  Check,
  X,
  ArrowRight,
  TrendingUp,
  Receipt,
  PiggyBank,
  CheckCircle2,
} from 'lucide-react';

export function MonthRolloverModal() {
  const { user } = useAuth();
  const userId = user?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [currentMonth, setCurrentMonth] = useState('');
  const [prevMonth, setPrevMonth] = useState('');

  const [prevBudget, setPrevBudget] = useState<MonthlyBudget | null>(null);
  const [prevFixedExpenses, setPrevFixedExpenses] = useState<FixedExpense[]>([]);

  // Editable fields pre-filled from last month
  const [income, setIncome] = useState<string>('');
  const [savingsTarget, setSavingsTarget] = useState<string>('');
  const [copyFixedExpenses, setCopyFixedExpenses] = useState<boolean>(true);

  useEffect(() => {
    async function checkRollover() {
      if (typeof window === 'undefined') return;

      const thisMonth = getCurrentMonthKey();
      const lastMonth = getPreviousMonthKey(thisMonth);

      setCurrentMonth(thisMonth);
      setPrevMonth(lastMonth);

      const dismissedKey = `savemoney_rollover_handled_${thisMonth}`;
      const isHandled = localStorage.getItem(dismissedKey) === 'true';

      if (isHandled) {
        setLoading(false);
        return;
      }

      try {
        const [
          { budget: curBudget },
          curFixed,
          { budget: lastBudget },
          lastFixed,
        ] = await Promise.all([
          StorageService.getMonthlyBudget(thisMonth, userId),
          StorageService.getFixedExpenses(thisMonth, userId),
          StorageService.getMonthlyBudget(lastMonth, userId),
          StorageService.getFixedExpenses(lastMonth, userId),
        ]);

        const shouldPrompt = shouldPromptMonthRollover({
          currentMonth: thisMonth,
          currentBudget: curBudget,
          currentFixedExpenses: curFixed,
          previousBudget: lastBudget,
          previousFixedExpenses: lastFixed,
          isDismissedOrConfirmed: isHandled,
        });

        if (shouldPrompt && lastBudget) {
          setPrevBudget(lastBudget);
          setPrevFixedExpenses(lastFixed);
          setIncome(String(lastBudget.income || ''));
          setSavingsTarget(String(lastBudget.savings_target || ''));
          setIsOpen(true);
        }
      } catch (err) {
        console.warn('Failed to check month rollover:', err);
      } finally {
        setLoading(false);
      }
    }

    checkRollover();
  }, [userId]);

  if (!isOpen || !prevBudget) return null;

  const totalFixedAmount = prevFixedExpenses.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

  const parsedIncome = parseFloat(income) || 0;
  const parsedSavings = parseFloat(savingsTarget) || 0;
  const effectiveFixed = copyFixedExpenses ? totalFixedAmount : 0;
  const spendablePreview = Math.max(0, parsedIncome - effectiveFixed - parsedSavings);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`savemoney_rollover_handled_${currentMonth}`, 'true');
    }
    setIsOpen(false);
  };

  const handleConfirmRollover = async () => {
    setSubmitting(true);
    try {
      // Create custom target budget from the form inputs
      const customSourceBudget: MonthlyBudget = {
        ...prevBudget,
        income: parsedIncome,
        savings_target: parsedSavings,
      };

      await executeMonthRollover({
        userId,
        targetMonth: currentMonth,
        sourceBudget: customSourceBudget,
        sourceFixedExpenses: prevFixedExpenses,
        copyFixedExpenses,
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(`savemoney_rollover_handled_${currentMonth}`, 'true');
        window.dispatchEvent(new Event('savemoney-budget-updated'));
        window.dispatchEvent(
          new CustomEvent('savemoney-show-toast', {
            detail: {
              message: `✨ ${formatMonthName(currentMonth)} budget successfully initialized!`,
              severity: 'info',
            },
          })
        );
      }

      setIsOpen(false);
    } catch (err) {
      alert('Failed to roll over budget. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <Card className="max-w-lg w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-primary flex items-center justify-center shadow-xs shrink-0">
              <Calendar className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-primary">
                New Month Detected
              </span>
              <h2 className="text-xl font-black text-navy-900 dark:text-white leading-tight">
                Welcome to {formatMonthName(currentMonth)}!
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Roll over your monthly income, savings goal, and fixed bills from{' '}
          <strong className="text-navy-900 dark:text-slate-200">{formatMonthName(prevMonth)}</strong>{' '}
          with one tap. Your past months remain safe and unchanged.
        </p>

        {/* Pre-filled form */}
        <div className="space-y-3.5 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Monthly Income (₹)"
              type="number"
              prefix="₹"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              required
            />
            <Input
              label="Savings Target (₹)"
              type="number"
              prefix="₹"
              value={savingsTarget}
              onChange={(e) => setSavingsTarget(e.target.value)}
              required
            />
          </div>

          {/* Fixed expenses summary check */}
          {prevFixedExpenses.length > 0 && (
            <label className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={copyFixedExpenses}
                onChange={(e) => setCopyFixedExpenses(e.target.checked)}
                className="w-4 h-4 rounded text-brand-primary focus:ring-brand-500 accent-brand-primary"
              />
              <div className="text-xs flex-1">
                <span className="font-bold text-navy-900 dark:text-white block">
                  Copy {prevFixedExpenses.length} Fixed Commitments ({formatINR(totalFixedAmount)})
                </span>
                <span className="text-[11px] text-slate-400">
                  Rent, subscriptions, and EMIs reset to unpaid for the new month.
                </span>
              </div>
            </label>
          )}

          {/* Spendable preview */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-500">
              Calculated Spendable Pool:
            </span>
            <span className="text-sm font-black text-brand-primary">
              {formatINR(spendablePreview)}
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={submitting}
            className="w-full sm:flex-1"
            icon={<Sparkles className="w-4 h-4" />}
            onClick={handleConfirmRollover}
          >
            Confirm & Roll Over Budget
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="md"
            className="w-full sm:w-auto text-slate-500"
            onClick={handleDismiss}
          >
            I&apos;ll setup manually
          </Button>
        </div>
      </Card>
    </div>
  );
}
