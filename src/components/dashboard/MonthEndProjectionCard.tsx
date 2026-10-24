'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { MonthEndProjectionResult } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface MonthEndProjectionCardProps {
  projection: MonthEndProjectionResult;
  monthName?: string;
  className?: string;
}

export function MonthEndProjectionCard({
  projection,
  monthName = 'This Month',
  className = '',
}: MonthEndProjectionCardProps) {
  const {
    spentSoFar,
    daysPassed,
    totalDaysInMonth,
    averageDailySpend,
    projectedMonthEndSpend,
    spendableBudget,
    isProjectedOverBudget,
    projectedSurplusOrDeficit,
  } = projection;

  const hasBudget = spendableBudget > 0;
  const pacePercentage = hasBudget
    ? Math.min(150, Math.round((projectedMonthEndSpend / spendableBudget) * 100))
    : 0;

  return (
    <Card className={`overflow-hidden relative ${className}`}>
      {/* Background soft glow */}
      <div
        className={`absolute -right-10 -bottom-10 w-36 h-36 rounded-full blur-2xl pointer-events-none opacity-40 ${
          isProjectedOverBudget ? 'bg-rose-500/10' : 'bg-emerald-500/10'
        }`}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isProjectedOverBudget
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
            }`}
          >
            {isProjectedOverBudget ? (
              <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <TrendingUp className="w-4 h-4 stroke-[2.2]" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 tracking-tight">
              Month-End Projection
            </h3>
            <p className="text-[11px] text-slate-400">
              Based on {daysPassed} of {totalDaysInMonth} days in {monthName}
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
            isProjectedOverBudget
              ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-900 dark:text-emerald-300'
          }`}
        >
          {isProjectedOverBudget ? 'Over Budget Pace' : 'On Track'}
        </span>
      </div>

      {/* Grid of Key Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Daily Pace
          </span>
          <span className="text-base sm:text-lg font-black text-navy-900 dark:text-white">
            {formatINR(averageDailySpend)}
            <span className="text-xs font-normal text-slate-400"> /day</span>
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Projected Total
          </span>
          <span
            className={`text-base sm:text-lg font-black ${
              isProjectedOverBudget ? 'text-rose-600' : 'text-navy-900 dark:text-white'
            }`}
          >
            {formatINR(projectedMonthEndSpend)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            {isProjectedOverBudget ? 'Projected Over' : 'Projected Savings'}
          </span>
          <span
            className={`text-base sm:text-lg font-black ${
              isProjectedOverBudget ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {formatINR(projectedSurplusOrDeficit)}
          </span>
        </div>
      </div>

      {/* Visual Pace Bar */}
      {hasBudget && (
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Projected vs Spendable Budget ({formatINR(spendableBudget)})</span>
            <span className={isProjectedOverBudget ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
              {pacePercentage}% of budget
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isProjectedOverBudget
                  ? 'bg-rose-500'
                  : pacePercentage > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, pacePercentage)}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary Message */}
      <div
        className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
          isProjectedOverBudget
            ? 'bg-rose-50/70 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-300'
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-300'
        }`}
      >
        {isProjectedOverBudget ? (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
        )}
        <p className="leading-relaxed">
          {spentSoFar === 0 ? (
            'Zero variable expenses logged this month. Safe to spend as scheduled!'
          ) : isProjectedOverBudget ? (
            <>
              At your current pace of <strong>{formatINR(averageDailySpend)}/day</strong>, you are projected to exceed your spendable budget by <strong>{formatINR(projectedSurplusOrDeficit)}</strong>. Try to limit spending today.
            </>
          ) : (
            <>
              At your current pace of <strong>{formatINR(averageDailySpend)}/day</strong>, you are on track to stay within budget with a projected extra cushion of <strong>{formatINR(projectedSurplusOrDeficit)}</strong> at month end.
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
