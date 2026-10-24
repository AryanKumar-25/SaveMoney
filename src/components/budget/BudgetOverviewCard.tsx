'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { formatINR } from '@/lib/formatters';
import { BudgetCalculationResult } from '@/lib/types';
import {
  Wallet,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  PiggyBank,
  CheckCircle2,
} from 'lucide-react';

interface BudgetOverviewCardProps {
  calculation: BudgetCalculationResult;
  spentSoFarThisMonth?: number;
  spentToday?: number;
  spentTodayChange?: number;
  monthName?: string;
  className?: string;
}

export function BudgetOverviewCard({
  calculation,
  spentSoFarThisMonth = 0,
  spentToday = 0,
  spentTodayChange = 0,
  monthName = 'This Month',
  className = '',
}: BudgetOverviewCardProps) {
  const {
    income,
    totalFixedExpenses,
    savingsTarget,
    spendableBudget,
    baseSpendableBudget = 0,
    extraTransfers = 0,
    balanceAdjustments = 0,
    fixedExpensesPercent,
    savingsRatePercent,
    spendablePercent,
    isDeficit,
  } = calculation;

  // Monthly progress calculations
  const hasSpendable = spendableBudget > 0;
  const monthlyUsedPercent = hasSpendable
    ? (spentSoFarThisMonth / spendableBudget) * 100
    : 0;

  // Color changes: orange at 80%, red at 100%
  const getProgressColor = () => {
    if (monthlyUsedPercent >= 100) return 'bg-rose-500';
    if (monthlyUsedPercent >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getProgressTextColor = () => {
    if (monthlyUsedPercent >= 100) return 'text-rose-600 dark:text-rose-400';
    if (monthlyUsedPercent >= 80) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  // Savings progress
  const untouchedSpendable = Math.max(0, spendableBudget - spentSoFarThisMonth);
  const isSavingsIntact = spentSoFarThisMonth <= spendableBudget;
  const savingsDeficit = Math.max(0, spentSoFarThisMonth - spendableBudget);

  return (
    <Card className={`relative overflow-hidden ${className}`}>
      {/* Background glow accent */}
      <div className="absolute -right-16 -top-16 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-primary flex items-center justify-center">
            <Wallet className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Spendable This Month
            </span>
            <span className="text-[11px] text-slate-400 ml-1.5 font-medium">({monthName})</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <span>₹ INR</span>
        </div>
      </div>

      {/* Big Balance Number */}
      <div className="mb-5">
        <div className="flex items-baseline gap-2">
          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight ${
              isDeficit ? 'text-rose-600' : 'text-navy-900 dark:text-white'
            }`}
          >
            {formatINR(spendableBudget)}
          </h2>
          {isDeficit && (
            <span className="flex items-center gap-1 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
              <AlertTriangle className="w-3.5 h-3.5" /> Deficit
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {isDeficit
            ? 'Commitments and savings target exceed your monthly income. Adjust fixed expenses or target.'
            : 'Available for daily groceries, food, travel, and personal expenses after fixed bills & savings.'}
        </p>

        {(extraTransfers > 0 || balanceAdjustments !== 0) && (
          <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Base: {formatINR(baseSpendableBudget)}
            </span>
            {extraTransfers > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40">
                +{formatINR(extraTransfers)} extra money
              </span>
            )}
            {balanceAdjustments !== 0 && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                balanceAdjustments > 0
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/60 dark:border-emerald-900/40'
                  : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200/60 dark:border-rose-900/40'
              }`}>
                {balanceAdjustments > 0 ? '+' : ''}{formatINR(balanceAdjustments)} balance adjustment
              </span>
            )}
          </div>
        )}
      </div>

      {/* Monthly Spendable Budget Progress Bar (Green -> Orange at 80% -> Red at 100%) */}
      {hasSpendable && (
        <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500">
              Budget Used: <strong>{formatINR(spentSoFarThisMonth)}</strong> of {formatINR(spendableBudget)}
            </span>
            <span className={`font-bold ${getProgressTextColor()}`}>
              {Math.round(monthlyUsedPercent)}%
            </span>
          </div>

          <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${Math.min(100, Math.max(0, monthlyUsedPercent))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {monthlyUsedPercent >= 100 ? (
                <span className="text-rose-500 font-bold">100% Limit Exceeded</span>
              ) : monthlyUsedPercent >= 80 ? (
                <span className="text-amber-500 font-bold">Warning: Over 80% Used</span>
              ) : (
                <span>On Track (&lt;80% used)</span>
              )}
            </span>
            <span className="font-semibold text-navy-900 dark:text-slate-200">
              {untouchedSpendable > 0 ? `${formatINR(untouchedSpendable)} remaining` : '₹0 remaining'}
            </span>
          </div>
        </div>
      )}

      {/* Savings Progress Card */}
      {savingsTarget > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
              <PiggyBank className="w-4 h-4 text-emerald-600" />
              <span>Savings Goal: {formatINR(savingsTarget)}</span>
            </div>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                isSavingsIntact
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
              }`}
            >
              {isSavingsIntact ? 'On Track' : 'Savings Impacted'}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            {isSavingsIntact ? (
              <>
                Target of <strong>{formatINR(savingsTarget)}</strong> is fully intact! You still have <strong>{formatINR(untouchedSpendable)}</strong> in untouched spending budget before touching savings.
              </>
            ) : (
              <>
                Spending exceeded your discretionary budget by <strong>{formatINR(savingsDeficit)}</strong>, reducing this month&apos;s net savings to <strong>{formatINR(Math.max(0, savingsTarget - savingsDeficit))}</strong>.
              </>
            )}
          </p>
        </div>
      )}

      {/* Thin Multi-colored Segmented Bar */}
      <div className="mb-4">
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${Math.max(0, Math.min(100, fixedExpensesPercent))}%` }}
            className="h-full bg-indigo-500 transition-all duration-300"
            title={`Fixed Bills: ${fixedExpensesPercent}%`}
          />
          <div
            style={{ width: `${Math.max(0, Math.min(100, savingsRatePercent))}%` }}
            className="h-full bg-emerald-500 transition-all duration-300"
            title={`Savings Target: ${savingsRatePercent}%`}
          />
          <div
            style={{ width: `${Math.max(0, Math.min(100, spendablePercent))}%` }}
            className="h-full bg-brand-primary transition-all duration-300"
            title={`Spendable: ${spendablePercent}%`}
          />
        </div>

        {/* Segment Legend with values */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
              <span className="font-semibold text-[11px] truncate">Fixed Bills</span>
            </div>
            <span className="font-bold text-navy-900 dark:text-slate-100 text-xs mt-0.5">
              {formatINR(totalFixedExpenses)}
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="font-semibold text-[11px] truncate">Savings Goal</span>
            </div>
            <span className="font-bold text-navy-900 dark:text-slate-100 text-xs mt-0.5">
              {formatINR(savingsTarget)}
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-brand-primary shrink-0"></span>
              <span className="font-semibold text-[11px] truncate">Spendable</span>
            </div>
            <span className="font-bold text-navy-900 dark:text-slate-100 text-xs mt-0.5">
              {formatINR(spendableBudget)}
            </span>
          </div>
        </div>
      </div>

      {/* Spent Today Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-slate-400 font-semibold block">Spent Today</span>
          <span className="text-base font-extrabold text-navy-900 dark:text-slate-100">
            {formatINR(spentToday)}
          </span>
        </div>

        <div>
          {spentToday === 0 ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              No expenses today
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Logged today</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
