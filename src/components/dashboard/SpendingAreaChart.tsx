'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Card } from '../ui/Card';
import { RangePills, TimeRange } from '../common/RangePills';
import { formatINR } from '@/lib/formatters';
import { Expense } from '@/lib/types';
import { calculateChartDataForRange } from '@/lib/calculations';
import { Receipt, Info, Sparkles } from 'lucide-react';

interface SpendingChartProps {
  expenses?: Expense[];
  dailySafeLimit?: number;
  monthName?: string;
  selectedRange?: TimeRange;
  onRangeChange?: (range: TimeRange) => void;
  className?: string;
}

export function SpendingAreaChart({
  expenses = [],
  dailySafeLimit = 0,
  monthName = 'This Month',
  selectedRange: controlledRange,
  onRangeChange,
  className = '',
}: SpendingChartProps) {
  const [internalRange, setInternalRange] = useState<TimeRange>('1M');
  const [mounted, setMounted] = useState(false);

  const range = controlledRange || internalRange;
  const setRange = (newRange: TimeRange) => {
    if (onRangeChange) onRangeChange(newRange);
    else setInternalRange(newRange);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const { points, totalSpent } = useMemo(() => {
    return calculateChartDataForRange(expenses, range, dailySafeLimit);
  }, [expenses, range, dailySafeLimit]);

  const hasExpenses = totalSpent > 0 && points.some((p) => p.amount > 0);

  // Show dashed reference line on daily-level charts (1D, 7D, 1M)
  const showSafeLimitLine = dailySafeLimit > 0 && (range === '7D' || range === '1M' || range === '1D');

  if (!mounted) {
    return (
      <Card className={`h-80 flex items-center justify-center ${className}`}>
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          <span className="text-xs text-slate-400">Loading spending chart...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col ${className}`}>
      {/* Chart Header with Time Range Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-navy-900 dark:text-slate-100 tracking-tight">
              My Spending
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {range} View
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {hasExpenses
              ? `Total spend: ${formatINR(totalSpent)} across ${range}`
              : `No expenses recorded in this period (Total: ₹0)`}
          </p>
        </div>

        <RangePills selected={range} onChange={setRange} />
      </div>

      {/* Chart Content Area */}
      {!hasExpenses ? (
        <div className="h-64 w-full flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <Receipt className="w-6 h-6 stroke-[1.8]" />
          </div>
          <h4 className="text-sm font-bold text-navy-900 dark:text-slate-200">
            No expenses logged in this range ({range})
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            As you log variable expenses, exact daily spending will appear as clean bars here with a dashed line for your daily safe limit.
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <Info className="w-3.5 h-3.5 text-brand-primary shrink-0" />
            <span>Total spend: {formatINR(0)}</span>
          </div>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="stroke-slate-200/70 dark:stroke-slate-800" />
              <XAxis
                dataKey="date"
                stroke="#94A3B8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${v}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as { date: string; amount: number; fullDate: string };
                    return (
                      <div className="bg-navy-900 dark:bg-slate-800 text-white px-3.5 py-2 rounded-xl shadow-xl text-xs border border-slate-700">
                        <p className="text-slate-400 text-[10px] uppercase font-bold">{item.fullDate || item.date}</p>
                        <p className="font-extrabold text-sm text-brand-primary mt-0.5">
                          {formatINR(item.amount)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Dashed line for daily safe-to-spend limit */}
              {showSafeLimitLine && (
                <ReferenceLine
                  y={dailySafeLimit}
                  stroke="#F7931A"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Daily Limit: ₹${dailySafeLimit}`,
                    position: 'insideTopRight',
                    fill: '#F7931A',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
              )}

              <Bar
                dataKey="amount"
                fill="#F7931A"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
