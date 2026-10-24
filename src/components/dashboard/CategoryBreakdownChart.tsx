'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { CategorySpendingBreakdown, Category } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import { CategoryIcon } from '@/components/expense/CategoryIcon';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Tag, PieChart as PieIcon, Layers } from 'lucide-react';

interface CategoryBreakdownChartProps {
  breakdown: CategorySpendingBreakdown[];
  totalSpent: number;
  rangeLabel?: string;
  className?: string;
}

const FALLBACK_COLORS = [
  '#F7931A',
  '#3B82F6',
  '#10B981',
  '#EC4899',
  '#8B5CF6',
  '#EAB308',
  '#06B6D4',
  '#64748B',
];

export function CategoryBreakdownChart({
  breakdown,
  totalSpent,
  rangeLabel = 'Selected Period',
  className = '',
}: CategoryBreakdownChartProps) {
  const hasData = breakdown.length > 0 && totalSpent > 0;

  const chartData = breakdown.map((item, idx) => ({
    name: item.category,
    value: item.amount,
    percentage: item.percentage,
    color: item.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
  }));

  return (
    <Card className={`flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-primary flex items-center justify-center">
            <PieIcon className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 tracking-tight">
              Category Breakdown
            </h3>
            <p className="text-[11px] text-slate-400">
              {rangeLabel} • {breakdown.length} active categories
            </p>
          </div>
        </div>

        <span className="text-xs font-bold text-navy-900 dark:text-slate-100">
          {formatINR(totalSpent)}
        </span>
      </div>

      {!hasData ? (
        <div className="py-12 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Tag className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-xs font-bold text-navy-900 dark:text-slate-200">
            No spending by category yet
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Categories will populate automatically as transactions are added.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Multi-colored Distribution Bar */}
          <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            {chartData.map((item) => (
              <div
                key={item.name}
                style={{
                  width: `${Math.max(2, item.percentage)}%`,
                  backgroundColor: item.color,
                }}
                className="h-full transition-all duration-300"
                title={`${item.name}: ${item.percentage}%`}
              />
            ))}
          </div>

          {/* Ranked List of Categories */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto pr-1">
            {breakdown.map((item, idx) => {
              const color = item.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

              return (
                <div
                  key={item.category}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg px-1.5 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: color }}
                    >
                      <CategoryIcon name={item.category} icon={item.icon} className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-navy-900 dark:text-slate-100 truncate">
                        {item.category}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {item.count} transaction{item.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-navy-900 dark:text-slate-100 block">
                      {formatINR(item.amount)}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
