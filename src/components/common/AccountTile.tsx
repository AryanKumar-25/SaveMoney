'use client';

import React from 'react';
import {
  Check,
  CreditCard,
  Building2,
  Smartphone,
  Banknote,
  Wallet,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { Account, AccountType } from '@/lib/types';
import { AccountStats } from '@/lib/accountCalculations';
import { formatINR } from '@/lib/formatters';

// Backward compatibility alias
export type AccountItem = Partial<Account> & {
  last4?: string;
  upiId?: string;
  bankName?: string;
};

interface AccountTileProps {
  account: Account | AccountItem;
  stats?: AccountStats;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onViewDetail?: (account: Account) => void;
  onReconcile?: (account: Account) => void;
  className?: string;
}

export function AccountTile({
  account,
  stats,
  isSelected = false,
  onSelect,
  onViewDetail,
  onReconcile,
  className = '',
}: AccountTileProps) {
  const accountType: AccountType = (account.type as AccountType) || 'bank';

  const getAccountIcon = () => {
    switch (accountType) {
      case 'credit_card':
        return <CreditCard className="w-5 h-5 text-brand-primary" />;
      case 'debit_card':
        return <CreditCard className="w-5 h-5 text-sky-500" />;
      case 'bank':
        return <Building2 className="w-5 h-5 text-blue-500" />;
      case 'upi':
        return <Smartphone className="w-5 h-5 text-emerald-500" />;
      case 'cash':
        return <Banknote className="w-5 h-5 text-amber-500" />;
      default:
        return <Wallet className="w-5 h-5 text-slate-500" />;
    }
  };

  const getTypeLabel = () => {
    switch (accountType) {
      case 'credit_card':
        return 'Credit Card';
      case 'debit_card':
        return 'Debit Card';
      case 'bank':
        return 'Bank Account';
      case 'upi':
        return 'UPI App';
      case 'cash':
        return 'Cash';
      default:
        return 'Account';
    }
  };

  const digits = account.last_4_digits || (account as AccountItem).last4;
  const spentThisMonth = stats?.spentThisMonth ?? 0;
  const isCreditCard = accountType === 'credit_card';
  const creditLimit = account.credit_limit || 0;
  const utilization = stats?.creditUtilizationPercent ?? (creditLimit > 0 ? Math.round((spentThisMonth / creditLimit) * 100) : 0);
  const isHighUtilization = stats?.isHighUtilization ?? (utilization >= 80);

  const estimatedBalance = stats?.estimatedBalance;

  const handleClick = () => {
    if (account.id) {
      onSelect?.(account.id);
    }
  };

  const handleDetailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewDetail && account.id) {
      onViewDetail(account as Account);
    } else if (account.id) {
      onSelect?.(account.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative min-w-[240px] sm:min-w-[260px] p-4 sm:p-5 rounded-2xl cursor-pointer transition-all duration-200 select-none bg-white dark:bg-slate-900 flex flex-col justify-between ${
        isSelected
          ? 'border-2 border-brand-primary shadow-glow ring-1 ring-brand-primary/20'
          : 'border border-slate-200/80 dark:border-slate-800 shadow-card hover:border-slate-300 dark:hover:border-slate-700'
      } ${className}`}
    >
      {/* Selection indicator & Quick Detail Link */}
      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
        {onViewDetail && (
          <button
            type="button"
            onClick={handleDetailClick}
            className="p-1 rounded-lg text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="View Account Details & Spending"
            aria-label="View Account Details"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}

        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-sm">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        )}
      </div>

      {/* Account Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 shrink-0 border border-slate-100 dark:border-slate-700/60"
            style={account.color ? { borderColor: account.color, backgroundColor: `${account.color}15` } : undefined}
          >
            {getAccountIcon()}
          </div>
          <div className="overflow-hidden pr-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {getTypeLabel()}
            </p>
            <h4 className="text-sm font-extrabold text-navy-900 dark:text-slate-100 truncate">
              {account.nickname}
            </h4>
          </div>
        </div>

        {/* Masked Card Number / Bank / UPI ID */}
        <p className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 tracking-wider">
          {digits ? `•••• •••• •••• ${digits}` : account.bank_or_app_name || (account as AccountItem).upiId || 'Direct Payment'}
        </p>
      </div>

      {/* Stats Section */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        {/* Spent this month */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Spent this month</span>
          <span className="font-extrabold text-navy-900 dark:text-white">
            {formatINR(spentThisMonth)}
          </span>
        </div>

        {/* Credit Card Utilization Bar */}
        {isCreditCard && creditLimit > 0 && (
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Limit: {formatINR(creditLimit)}</span>
              <span
                className={`font-black ${
                  isHighUtilization ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-slate-500'
                }`}
              >
                {utilization}% used
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isHighUtilization ? 'bg-rose-500' : 'bg-brand-primary'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }}
              />
            </div>
          </div>
        )}

        {/* Bank Account or Cash: Estimated Balance */}
        {(accountType === 'bank' || accountType === 'cash') && estimatedBalance !== undefined && (
          <div className="space-y-2 pt-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Est. Balance</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(estimatedBalance)}
              </span>
            </div>

            {onReconcile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReconcile(account as Account);
                }}
                className="w-full py-1.5 px-2.5 rounded-xl bg-slate-50 hover:bg-brand-50 dark:bg-slate-800 dark:hover:bg-brand-950/40 border border-slate-200/80 dark:border-slate-700 hover:border-brand-primary text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-brand-primary transition-all flex items-center justify-center gap-1.5"
              >
                <span>Check my balance</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Special "All Accounts" Tile for Dashboard filtering
 */
export function AllAccountsTile({
  isSelected = false,
  onSelect,
  totalSpentThisMonth = 0,
}: {
  isSelected?: boolean;
  onSelect?: () => void;
  totalSpentThisMonth?: number;
}) {
  return (
    <div
      onClick={onSelect}
      className={`relative min-w-[200px] sm:min-w-[220px] p-4 sm:p-5 rounded-2xl cursor-pointer transition-all duration-200 select-none bg-white dark:bg-slate-900 flex flex-col justify-between ${
        isSelected
          ? 'border-2 border-brand-primary shadow-glow ring-1 ring-brand-primary/20'
          : 'border border-slate-200/80 dark:border-slate-800 shadow-card hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {isSelected && (
        <div className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-sm">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
      )}

      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-primary shrink-0">
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Overview
            </p>
            <h4 className="text-sm font-extrabold text-navy-900 dark:text-white">
              All Accounts
            </h4>
          </div>
        </div>
        <p className="text-xs text-slate-400">Consolidated spending</p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">Total spent</span>
        <span className="font-extrabold text-navy-900 dark:text-white">
          {formatINR(totalSpentThisMonth)}
        </span>
      </div>
    </div>
  );
}

export function AddAccountTile({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[140px] p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand-primary hover:bg-brand-50/20 text-slate-400 hover:text-brand-primary font-bold text-xs uppercase tracking-wider flex items-center justify-center transition-all duration-150 select-none shrink-0"
    >
      + ADD
    </button>
  );
}
