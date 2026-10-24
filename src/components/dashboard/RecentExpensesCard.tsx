'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '../ui/Card';
import { Expense, Category } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import { CategoryIcon } from '@/components/expense/CategoryIcon';
import { Receipt, Clock, ChevronRight, Plus } from 'lucide-react';
import { useExpenseModal } from '@/context/ExpenseModalContext';

interface RecentExpensesCardProps {
  expenses: Expense[];
  categories: Category[];
  className?: string;
}

export function RecentExpensesCard({
  expenses,
  categories,
  className = '',
}: RecentExpensesCardProps) {
  const { openQuickAdd } = useExpenseModal();
  const recent = expenses.slice(0, 5);

  const formatRelativeTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const today = new Date();
      const isToday =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();

      const timeStr = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      if (isToday) return `Today, ${timeStr}`;

      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();

      if (isYesterday) return `Yesterday, ${timeStr}`;

      return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}, ${timeStr}`;
    } catch {
      return '';
    }
  };

  const getCategoryMeta = (catName: string) => {
    const found = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
    return {
      color: found?.color || '#F7931A',
      icon: found?.icon,
    };
  };

  return (
    <Card className={`flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-primary flex items-center justify-center">
            <Receipt className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 tracking-tight">
              Recent Expenses
            </h3>
            <p className="text-[11px] text-slate-400">
              Latest 5 variable transactions
            </p>
          </div>
        </div>

        <Link
          href="/expenses"
          className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-0.5"
        >
          View All <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
            <Receipt className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-navy-900 dark:text-slate-200">
            No expenses yet
          </p>
          <p className="text-[11px] text-slate-400 max-w-xs mt-0.5 mb-3">
            Add your first expense with the Quick Add button or paste an SMS.
          </p>
          <button
            type="button"
            onClick={() => openQuickAdd()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary bg-brand-light/60 hover:bg-brand-light dark:bg-brand-primary/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Log First Expense
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {recent.map((exp) => {
            const meta = getCategoryMeta(exp.category);

            return (
              <div
                key={exp.id}
                className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg px-1.5 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: meta.color }}
                  >
                    <CategoryIcon name={exp.category} icon={meta.icon} className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-navy-900 dark:text-slate-100 truncate">
                      {exp.merchant || exp.note || exp.category}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <span>{exp.category}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatRelativeTime(exp.date)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                    {formatINR(exp.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Link */}
      {recent.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
          <Link
            href="/expenses"
            className="text-xs font-bold text-slate-500 hover:text-brand-primary transition-colors inline-flex items-center gap-1"
          >
            Manage and filter all expenses &rarr;
          </Link>
        </div>
      )}
    </Card>
  );
}
