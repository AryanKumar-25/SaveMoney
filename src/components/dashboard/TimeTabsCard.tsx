'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { TimeTabTotals } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import { Clock, Calendar, CalendarDays, CalendarRange } from 'lucide-react';

interface TimeTabsCardProps {
  totals: TimeTabTotals;
  activeTab?: 'today' | 'week' | 'month' | 'year';
  onSelectTab?: (tab: 'today' | 'week' | 'month' | 'year') => void;
  className?: string;
}

export function TimeTabsCard({
  totals,
  activeTab = 'month',
  onSelectTab,
  className = '',
}: TimeTabsCardProps) {
  const tabs = [
    {
      id: 'today' as const,
      label: 'Today',
      amount: totals.today,
      icon: <Clock className="w-3.5 h-3.5" />,
      subtext: 'Spent since midnight',
    },
    {
      id: 'week' as const,
      label: 'This Week',
      amount: totals.thisWeek,
      icon: <CalendarDays className="w-3.5 h-3.5" />,
      subtext: 'Monday – Sunday',
    },
    {
      id: 'month' as const,
      label: 'This Month',
      amount: totals.thisMonth,
      icon: <Calendar className="w-3.5 h-3.5" />,
      subtext: 'Current calendar month',
    },
    {
      id: 'year' as const,
      label: 'This Year',
      amount: totals.thisYear,
      icon: <CalendarRange className="w-3.5 h-3.5" />,
      subtext: 'Full year total',
    },
  ];

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab?.(tab.id)}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 ${
              isSelected
                ? 'bg-white dark:bg-slate-900 border-brand-primary shadow-md ring-1 ring-brand-primary/50'
                : 'bg-white/70 dark:bg-slate-900/70 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">
                <span className={isSelected ? 'text-brand-primary' : 'text-slate-400'}>
                  {tab.icon}
                </span>
                {tab.label}
              </span>
              {isSelected && (
                <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
              )}
            </div>

            <div className="text-lg sm:text-xl font-black text-navy-900 dark:text-white tracking-tight">
              {formatINR(tab.amount)}
            </div>

            <p className="text-[10px] text-slate-400 mt-1 truncate">
              {tab.subtext}
            </p>
          </button>
        );
      })}
    </div>
  );
}
