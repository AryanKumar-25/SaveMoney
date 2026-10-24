'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatINR } from '@/lib/formatters';
import {
  Coins,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Plus,
} from 'lucide-react';

interface ExtraMoneyDashboardCardProps {
  availableExtraMoney: number;
  totalReceived?: number;
  onOpenMoveModal: () => void;
  className?: string;
}

export function ExtraMoneyDashboardCard({
  availableExtraMoney,
  totalReceived = 0,
  onOpenMoveModal,
  className = '',
}: ExtraMoneyDashboardCardProps) {
  return (
    <Card className={`relative overflow-hidden p-4 sm:p-5 border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-r from-amber-500/5 via-brand-primary/5 to-transparent ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs shrink-0">
            <Coins className="w-6 h-6 stroke-[2]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Extra Money Available
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            </div>

            <div className="flex items-baseline gap-2 mt-0.5">
              <h3 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
                {formatINR(availableExtraMoney)}
              </h3>
              <span className="text-xs text-slate-400 font-semibold">
                in reserve pool
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Freelance, gifts, refunds & cashbacks • Kept outside monthly salary budget
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="primary"
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            onClick={onOpenMoveModal}
            disabled={availableExtraMoney <= 0}
            title={availableExtraMoney <= 0 ? 'No extra money currently available to move' : 'Move funds into this month\'s spendable budget'}
          >
            Add to Balance
          </Button>

          <Link
            href="/extra-money"
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white flex items-center gap-1 transition-all"
          >
            <span>Manage</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
