'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { MonthlyReportResult } from '@/lib/reportCalculations';
import { formatINR, formatMonthName } from '@/lib/formatters';
import { CategoryIcon } from '../expense/CategoryIcon';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Receipt,
  Store,
  Tag,
  Calendar,
  AlertTriangle,
  Award,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Coins,
  SlidersHorizontal,
  Info,
} from 'lucide-react';

interface MonthlyReportCardProps {
  report: MonthlyReportResult;
  className?: string;
}

export function MonthlyReportCard({ report, className = '' }: MonthlyReportCardProps) {
  const {
    month,
    totalSpent,
    spendableBudget,
    baseSpendableBudget = 0,
    extraTransfersTotal = 0,
    balanceAdjustmentsTotal = 0,
    extraMoneyReceivedTotal = 0,
    budgetUsedPercent,
    isOverBudget,
    overBudgetAmount,
    remainingBudget,
    lastMonthSpent,
    monthOverMonthDifference,
    monthOverMonthPercentChange,
    isIncreaseVsLastMonth,
    top5Categories,
    top5Merchants,
    biggestExpense,
    dailyAverage,
    daysConsidered,
    transactionCount,
  } = report;

  const monthTitle = formatMonthName(month);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Spent */}
        <Card className="p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
              Total Spent
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {transactionCount} txns
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            {formatINR(totalSpent)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Across {daysConsidered} days in {monthTitle}
          </p>
        </Card>

        {/* Card 2: Vs Budget */}
        <Card className="p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
              Vs Spendable Budget
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                spendableBudget === 0
                  ? 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                  : isOverBudget
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
              }`}
            >
              {spendableBudget === 0
                ? 'No Budget'
                : isOverBudget
                ? 'Over Budget'
                : `${budgetUsedPercent}% Used`}
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            {spendableBudget > 0 ? formatINR(spendableBudget) : '₹0'}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {spendableBudget === 0
              ? 'Configure your budget in Budget Setup'
              : isOverBudget
              ? `Exceeded by ${formatINR(overBudgetAmount)}`
              : `${formatINR(remainingBudget)} remaining buffer`}
          </p>
        </Card>

        {/* Card 3: Vs Last Month */}
        <Card className="p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
              Vs Last Month
            </span>
            <span
              className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                lastMonthSpent === 0
                  ? 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                  : isIncreaseVsLastMonth
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
              }`}
            >
              {lastMonthSpent === 0 ? (
                'First Month'
              ) : isIncreaseVsLastMonth ? (
                <>
                  <ArrowUpRight className="w-3 h-3" />
                  +{monthOverMonthPercentChange}%
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-3 h-3" />
                  -{Math.abs(monthOverMonthPercentChange)}%
                </>
              )}
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            {lastMonthSpent > 0 ? formatINR(lastMonthSpent) : '₹0'}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {lastMonthSpent === 0
              ? 'No spending recorded last month'
              : isIncreaseVsLastMonth
              ? `Spent ₹${formatINR(Math.abs(monthOverMonthDifference))} more than last month`
              : `Saved ₹${formatINR(Math.abs(monthOverMonthDifference))} compared to last month`}
          </p>
        </Card>

        {/* Card 4: Daily Average */}
        <Card className="p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
              Daily Average
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              Pacing
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            {formatINR(dailyAverage)}
            <span className="text-xs font-normal text-slate-400"> /day</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calculated over {daysConsidered} active day{daysConsidered !== 1 ? 's' : ''}
          </p>
        </Card>
      </div>

      {/* Biggest Single Expense Banner */}
      {biggestExpense ? (
        <Card className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-brand-primary/5 to-transparent border-brand-200/60 dark:border-brand-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-primary text-white flex items-center justify-center shadow-glow shrink-0">
                <Award className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-primary">
                  Biggest Single Expense in {monthTitle}
                </span>
                <h4 className="text-base font-bold text-navy-900 dark:text-white">
                  {biggestExpense.merchant || biggestExpense.note || biggestExpense.category}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>{biggestExpense.category}</span>
                  {biggestExpense.note && <span>• &ldquo;{biggestExpense.note}&rdquo;</span>}
                  <span>•</span>
                  <span>{new Date(biggestExpense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-2xl font-black text-brand-primary">
                {formatINR(biggestExpense.amount)}
              </span>
              <span className="text-[11px] text-slate-400 block font-semibold">
                {totalSpent > 0 ? `${Math.round((Number(biggestExpense.amount) / totalSpent) * 100)}% of month's spend` : ''}
              </span>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Extra Money & Balance Adjustments Breakdown (Reported Separately to protect spending trends) */}
      <Card className="p-5 border-amber-200/50 dark:border-amber-900/40 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Coins className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy-900 dark:text-white tracking-tight">
                Extra Money & Adjustments
              </h3>
              <p className="text-xs text-slate-400">
                Tracked separately to prevent distorting your baseline salary and spending trends
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full font-medium self-start sm:self-auto">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Isolated from salary trend</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tile 1: Extra Money Received */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Extra Received This Month
            </span>
            <span className="text-lg font-black text-navy-900 dark:text-white block mt-0.5">
              {formatINR(extraMoneyReceivedTotal)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Gifts, freelance, refunds
            </span>
          </div>

          {/* Tile 2: Moved to Balance */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Moved to Spendable
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5">
              +{formatINR(extraTransfersTotal)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Added to this month&apos;s budget
            </span>
          </div>

          {/* Tile 3: Direct Adjustments */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Balance Adjustments
            </span>
            <span
              className={`text-lg font-black block mt-0.5 ${
                balanceAdjustmentsTotal > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : balanceAdjustmentsTotal < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-navy-900 dark:text-white'
              }`}
            >
              {balanceAdjustmentsTotal > 0 ? '+' : ''}
              {formatINR(balanceAdjustmentsTotal)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Cash found, forgotten bills, etc.
            </span>
          </div>

          {/* Tile 4: Adjusted Spendable Budget */}
          <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block">
              Effective Spendable Budget
            </span>
            <span className="text-lg font-black text-navy-900 dark:text-white block mt-0.5">
              {formatINR(spendableBudget)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Base: {formatINR(baseSpendableBudget)}
            </span>
          </div>
        </div>
      </Card>

      {/* Top 5 Categories & Top 5 Merchants Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Categories */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-primary flex items-center justify-center">
                <Tag className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-navy-900 dark:text-white tracking-tight">
                Top 5 Categories
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">
              By total expenditure
            </span>
          </div>

          {top5Categories.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No categories recorded for this month
            </div>
          ) : (
            <div className="space-y-3">
              {top5Categories.map((cat, idx) => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-navy-900 dark:text-white">
                        {cat.category}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        ({cat.count} txn{cat.count !== 1 ? 's' : ''})
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-extrabold text-navy-900 dark:text-white mr-2">
                        {formatINR(cat.amount)}
                      </span>
                      <span className="font-bold text-slate-400 text-[11px]">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Distribution bar */}
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(2, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top 5 Merchants */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
                <Store className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-navy-900 dark:text-white tracking-tight">
                Top 5 Merchants
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">
              Where your money went
            </span>
          </div>

          {top5Merchants.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No merchants recorded for this month
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {top5Merchants.map((m, idx) => (
                <div
                  key={m.merchant}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-navy-900 dark:text-white truncate">
                        {m.merchant}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {m.count} transaction{m.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-extrabold text-navy-900 dark:text-white block">
                      {formatINR(m.amount)}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {m.percentage}% of total
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
