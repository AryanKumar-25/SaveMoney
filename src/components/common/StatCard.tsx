import React from 'react';
import { Card } from '../ui/Card';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'danger' | 'success' | 'warning';
  actions?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  subValue,
  change,
  changeType = 'neutral',
  icon,
  badge,
  badgeVariant = 'default',
  actions,
  className = '',
}: StatCardProps) {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  const getBadgeStyle = () => {
    if (badgeVariant === 'danger' || isNegative) {
      return 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-extrabold';
    }
    if (badgeVariant === 'success') {
      return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold';
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold';
  };

  return (
    <Card
      className={`min-w-[270px] sm:min-w-[290px] flex-1 flex flex-col justify-between transition-all duration-200 ${
        isNegative
          ? 'border-rose-300 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/10'
          : ''
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 overflow-hidden">
            {icon && (
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isNegative
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                    : 'bg-brand-50 dark:bg-brand-950/40 text-brand-primary'
                }`}
              >
                {icon}
              </div>
            )}
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {title}
            </span>
          </div>
          {badge && (
            <span
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${getBadgeStyle()}`}
            >
              {badge}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <h4
            className={`text-xl sm:text-2xl font-black tracking-tight ${
              isNegative
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-navy-900 dark:text-slate-100'
            }`}
          >
            {value}
          </h4>
          {subValue && (
            <p
              className={`text-xs font-medium leading-relaxed ${
                isNegative
                  ? 'text-rose-600 font-semibold'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {subValue}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        {change && (
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {isPositive && <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            {isNegative && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
            <span
              className={
                isPositive
                  ? 'text-emerald-500'
                  : isNegative
                  ? 'text-rose-600 font-bold'
                  : 'text-slate-500'
              }
            >
              {change}
            </span>
          </div>
        )}
        {actions && <div className="flex items-center gap-1.5 ml-auto">{actions}</div>}
      </div>
    </Card>
  );
}

export function AddStatCard({
  label = '+ ADD',
  onClick,
  className = '',
}: {
  label?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[150px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand-primary/60 hover:bg-brand-50/20 text-slate-400 hover:text-brand-primary font-bold text-xs uppercase tracking-wider flex items-center justify-center p-6 transition-all duration-150 shrink-0 ${className}`}
    >
      {label}
    </button>
  );
}
