'use client';

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Account, Expense } from '@/lib/types';
import { calculateAccountStats } from '@/lib/accountCalculations';
import { formatINR } from '@/lib/formatters';
import {
  X,
  CreditCard,
  Building2,
  Smartphone,
  Banknote,
  Wallet,
  Edit2,
  Trash2,
  Receipt,
  TrendingDown,
  Calendar,
  Scale,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface AccountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  allExpenses: Expense[];
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onReconcile?: (account: Account) => void;
}

export function AccountDetailModal({
  isOpen,
  onClose,
  account,
  allExpenses,
  onEdit,
  onDelete,
  onReconcile,
}: AccountDetailModalProps) {
  if (!isOpen || !account) return null;

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const stats = calculateAccountStats(account, allExpenses, currentMonthKey);

  // Filter expenses belonging to this account
  const accountExpenses = useMemo(() => {
    return allExpenses
      .filter((e) => e.account_id === account.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allExpenses, account.id]);

  // Build daily spending chart data for the last 14 days
  const chartData = useMemo(() => {
    const days: { date: string; amount: number; fullDate: string }[] = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayKey = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      const dayExpenses = accountExpenses.filter((e) => e.date && e.date.slice(0, 10) === dayKey);
      const dayTotal = dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      days.push({
        date: dayLabel,
        amount: dayTotal,
        fullDate: dayKey,
      });
    }

    return days;
  }, [accountExpenses]);

  const getAccountIcon = () => {
    switch (account.type) {
      case 'credit_card':
        return <CreditCard className="w-6 h-6 text-brand-primary" />;
      case 'debit_card':
        return <CreditCard className="w-6 h-6 text-sky-500" />;
      case 'bank':
        return <Building2 className="w-6 h-6 text-blue-500" />;
      case 'upi':
        return <Smartphone className="w-6 h-6 text-emerald-500" />;
      case 'cash':
        return <Banknote className="w-6 h-6 text-amber-500" />;
      default:
        return <Wallet className="w-6 h-6 text-slate-500" />;
    }
  };

  const isCreditCard = account.type === 'credit_card';
  const creditLimit = account.credit_limit || 0;
  const utilization = stats.creditUtilizationPercent || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fadeIn">
      <Card className="max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 relative">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shrink-0"
              style={account.color ? { borderColor: account.color, backgroundColor: `${account.color}15` } : undefined}
            >
              {getAccountIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {account.type.replace('_', ' ')}
                </span>
                {account.last_4_digits && (
                  <span className="text-xs font-mono text-slate-400">
                    •••• {account.last_4_digits}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-navy-900 dark:text-white mt-0.5">
                {account.nickname}
              </h3>
              {account.bank_or_app_name && (
                <p className="text-xs text-slate-400 font-medium">
                  {account.bank_or_app_name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {(account.type === 'bank' || account.type === 'cash') && onReconcile && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onReconcile(account)}
                icon={<Scale className="w-3.5 h-3.5" />}
              >
                Check Balance
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(account)}
              icon={<Edit2 className="w-3.5 h-3.5" />}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(account)}
              className="text-slate-400 hover:text-rose-600"
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Delete
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block">Spent This Month</span>
            <span className="text-base font-black text-navy-900 dark:text-white mt-0.5 block">
              {formatINR(stats.spentThisMonth)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block">Total Spent (All-time)</span>
            <span className="text-base font-black text-navy-900 dark:text-white mt-0.5 block">
              {formatINR(stats.totalSpent)}
            </span>
          </div>

          {/* Conditional 3rd stat card */}
          {isCreditCard && creditLimit > 0 ? (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block">Credit Limit</span>
              <span className="text-base font-black text-navy-900 dark:text-white mt-0.5 block">
                {formatINR(creditLimit)}
              </span>
            </div>
          ) : (account.type === 'bank' || account.type === 'cash') && stats.estimatedBalance !== undefined ? (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block">Estimated Balance</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {formatINR(stats.estimatedBalance)}
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block">Total Transactions</span>
              <span className="text-base font-black text-navy-900 dark:text-white mt-0.5 block">
                {stats.expenseCount}
              </span>
            </div>
          )}
        </div>

        {/* Credit Card Utilization Banner */}
        {isCreditCard && creditLimit > 0 && (
          <div
            className={`p-3.5 rounded-2xl border mb-4 space-y-2 ${
              stats.isHighUtilization
                ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200'
                : 'bg-brand-50/50 border-brand-200/60 dark:bg-slate-800/60 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Credit Utilization</span>
              <span className={stats.isHighUtilization ? 'text-rose-600 dark:text-rose-400' : 'text-brand-primary'}>
                {utilization}% Used ({formatINR(stats.spentThisMonth)} / {formatINR(creditLimit)})
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  stats.isHighUtilization ? 'bg-rose-500' : 'bg-brand-primary'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }}
              />
            </div>
            {account.billing_date && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Monthly billing date: {account.billing_date}th of every month
              </p>
            )}
          </div>
        )}

        {/* Spending Chart (Last 14 Days) */}
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recent Spending Trend (Last 14 Days)
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">Daily ₹ Spent</span>
          </div>

          <div className="h-36 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)}
                />
                <Tooltip
                  formatter={(val: number) => [formatINR(val), 'Spent']}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="amount" fill="#F7931A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Transactions from this account ({accountExpenses.length})
            </h4>
          </div>

          {accountExpenses.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
              No transactions recorded with this account yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
              {accountExpenses.map((exp) => (
                <div key={exp.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-navy-900 dark:text-white">
                      {exp.merchant || exp.note || exp.category}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-semibold">
                        {exp.category}
                      </span>
                      <span>
                        {new Date(exp.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <span className="font-extrabold text-navy-900 dark:text-white text-sm">
                    {formatINR(Number(exp.amount) || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
