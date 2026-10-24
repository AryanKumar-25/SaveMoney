'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { YearlyReportResult, MonthYearlySummary } from '@/lib/reportCalculations';
import { formatINR } from '@/lib/formatters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Calendar,
  PiggyBank,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  Info,
} from 'lucide-react';

interface YearlyReportCardProps {
  report: YearlyReportResult;
  selectedYear: number;
  onYearChange: (year: number) => void;
  className?: string;
}

export function YearlyReportCard({
  report,
  selectedYear,
  onYearChange,
  className = '',
}: YearlyReportCardProps) {
  const {
    year,
    totalSpentYear,
    averageMonthlySpent,
    monthsData,
    monthsTargetHitCount,
  } = report;

  // Chart data
  const chartData = monthsData.map((m) => ({
    name: m.monthLabel,
    monthKey: m.monthKey,
    amount: m.totalSpent,
    savingsTargetHit: m.savingsTargetHit,
    savingsTarget: m.savingsTarget,
    isConfigured: m.isConfigured,
  }));

  const availableYears = [selectedYear - 1, selectedYear, selectedYear + 1];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Yearly Summary Vitals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Spent in Year */}
        <Card className="p-4 sm:p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Spent in {year}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            {formatINR(totalSpentYear)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Full annual variable expenditure
          </p>
        </Card>

        {/* Average Monthly Spend */}
        <Card className="p-4 sm:p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Average Monthly Spend
          </span>
          <div className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            {formatINR(averageMonthlySpent)}
            <span className="text-xs font-normal text-slate-400"> /mo</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Across active months
          </p>
        </Card>

        {/* Savings Targets Hit */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Savings Goals Hit
            </span>
            <span className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <Award className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {monthsTargetHitCount} / 12
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Months savings target protected
          </p>
        </Card>
      </div>

      {/* Annual Bar Chart: Spending per month with hit/missed bars */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-navy-900 dark:text-white tracking-tight">
                Monthly Spending & Savings Performance ({year})
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Green bars denote savings target protected; orange/amber bars denote budget exceeded or missed target
            </p>
          </div>

          {/* Year selector pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => onYearChange(yr)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  yr === year
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="stroke-slate-200/80 dark:stroke-slate-800" />
              <XAxis
                dataKey="name"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${v >= 1000 ? `${v / 1000}k` : v}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as {
                      name: string;
                      amount: number;
                      savingsTargetHit: boolean;
                      savingsTarget: number;
                      isConfigured: boolean;
                    };

                    return (
                      <div className="bg-navy-900 dark:bg-slate-800 text-white px-3.5 py-2.5 rounded-xl shadow-xl text-xs border border-slate-700 space-y-1">
                        <p className="text-slate-400 text-[10px] uppercase font-bold">
                          {item.name} {year}
                        </p>
                        <p className="font-extrabold text-sm text-brand-primary">
                          Spent: {formatINR(item.amount)}
                        </p>
                        {item.isConfigured ? (
                          <div className="pt-1 border-t border-slate-700/80 flex items-center gap-1.5 text-[11px]">
                            {item.savingsTargetHit ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Target Hit
                              </span>
                            ) : (
                              <span className="text-rose-400 font-bold flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Target Missed
                              </span>
                            )}
                            <span className="text-slate-400">
                              (Goal: {formatINR(item.savingsTarget)})
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">No budget set</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => {
                  // Color according to savings target hit
                  let barColor = '#CBD5E1'; // default if 0
                  if (entry.amount > 0) {
                    if (entry.isConfigured) {
                      barColor = entry.savingsTargetHit ? '#10B981' : '#F7931A';
                    } else {
                      barColor = '#F7931A';
                    }
                  }
                  return <Cell key={`cell-${index}`} fill={barColor} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
            <span className="w-3 h-3 rounded-md bg-emerald-500" />
            <span>Savings Target Hit</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
            <span className="w-3 h-3 rounded-md bg-brand-primary" />
            <span>Budget Exceeded / Target Missed</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
            <span className="w-3 h-3 rounded-md bg-slate-300 dark:bg-slate-700" />
            <span>No Spend</span>
          </div>
        </div>
      </Card>

      {/* Month-by-Month Detailed Performance Grid */}
      <Card className="p-5 space-y-4">
        <h3 className="text-base font-bold text-navy-900 dark:text-white tracking-tight">
          Month-by-Month Breakdown ({year})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {monthsData.map((m) => (
            <div
              key={m.monthKey}
              className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-navy-900 dark:text-white text-sm">
                  {m.monthLabel}
                </span>

                {m.isConfigured ? (
                  m.savingsTargetHit ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50">
                      <CheckCircle2 className="w-3 h-3" /> Hit
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/50">
                      <XCircle className="w-3 h-3" /> Missed
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    No Budget
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Spent</span>
                  <span className="font-black text-sm sm:text-base text-navy-900 dark:text-white">
                    {formatINR(m.totalSpent)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    {m.savingsTargetHit ? 'Actual Saved' : 'Short By'}
                  </span>
                  <span
                    className={`font-bold text-xs ${
                      m.savingsTargetHit
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : m.savingsDeficit > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {m.isConfigured
                      ? m.savingsTargetHit
                        ? formatINR(m.actualSavings)
                        : formatINR(m.savingsDeficit)
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
