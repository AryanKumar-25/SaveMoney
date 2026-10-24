'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { StorageService } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { formatINR, getCurrentMonthKey, formatMonthName } from '@/lib/formatters';
import { calculateSafeToSpendToday } from '@/lib/calculations';
import {
  X,
  Coins,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface MoveToBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableExtraMoney: number;
  currentSpendableBudget: number;
  spentSoFarThisMonth: number;
  spentToday: number;
  targetMonth?: string;
  onMoved?: () => void;
}

export function MoveToBalanceModal({
  isOpen,
  onClose,
  availableExtraMoney,
  currentSpendableBudget,
  spentSoFarThisMonth,
  spentToday,
  targetMonth = getCurrentMonthKey(),
  onMoved,
}: MoveToBalanceModalProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNote('');
      setFormError('');
    }
  }, [isOpen]);

  // Calculate live preview
  const numAmount = parseFloat(amount) || 0;
  const newSpendableBudget = currentSpendableBudget + numAmount;

  // Safe-to-spend today before and after
  const currentSafeToSpend = useMemo(() => {
    return calculateSafeToSpendToday(
      currentSpendableBudget,
      spentSoFarThisMonth,
      spentToday
    ).safeToSpendRemainingToday;
  }, [currentSpendableBudget, spentSoFarThisMonth, spentToday]);

  const newSafeToSpend = useMemo(() => {
    return calculateSafeToSpendToday(
      newSpendableBudget,
      spentSoFarThisMonth,
      spentToday
    ).safeToSpendRemainingToday;
  }, [newSpendableBudget, spentSoFarThisMonth, spentToday]);

  if (!isOpen) return null;

  const handleUseAll = () => {
    setAmount(String(availableExtraMoney));
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (numAmount <= 0) {
      setFormError('Amount must be greater than ₹0');
      return;
    }

    if (numAmount > availableExtraMoney) {
      setFormError(`Cannot move ₹${formatINR(numAmount)}. Only ${formatINR(availableExtraMoney)} available.`);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await StorageService.addExtraMoneyTransfer(
        {
          amount: numAmount,
          date: new Date().toISOString(),
          month: targetMonth,
          note: note.trim() || undefined,
        },
        userId
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-extra-money-updated'));
        window.dispatchEvent(new Event('savemoney-budget-updated'));
        window.dispatchEvent(
          new CustomEvent('savemoney-show-toast', {
            detail: {
              message: `🎉 Added ${formatINR(numAmount)} to your ${formatMonthName(targetMonth)} spendable balance!`,
              severity: 'info',
            },
          })
        );
      }

      onMoved?.();
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to move extra money');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <Card className="max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-primary text-white flex items-center justify-center shadow-sm">
              <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-navy-900 dark:text-white tracking-tight">
                Add to Monthly Balance
              </h3>
              <p className="text-[11px] text-slate-400">
                Move extra money into {formatMonthName(targetMonth)}&apos;s spendable budget
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Available reserve banner */}
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Available Extra Money Pool:
            </span>
          </div>
          <span className="text-sm font-black text-amber-700 dark:text-amber-300">
            {formatINR(availableExtraMoney)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Transfer Amount (₹ INR) *
              </label>
              {availableExtraMoney > 0 && (
                <button
                  type="button"
                  onClick={handleUseAll}
                  className="text-[11px] font-bold text-brand-primary hover:underline"
                >
                  Use all available ({formatINR(availableExtraMoney)})
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-brand-primary pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                max={availableExtraMoney}
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setFormError('');
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy-900 dark:text-white text-xl sm:text-2xl font-black tracking-tight focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder:text-slate-300"
                required
                autoFocus
              />
            </div>
          </div>

          <Input
            label="Optional Note"
            placeholder="e.g. For weekend trip, Dining out bonus"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px] block">
              Budget Impact Preview
            </span>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Spendable this month:</span>
              <div className="font-bold flex items-center gap-1.5">
                <span className="text-slate-400 line-through">
                  {formatINR(currentSpendableBudget)}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-navy-900 dark:text-white font-black">
                  {formatINR(newSpendableBudget)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Safe to spend today:</span>
              <div className="font-bold flex items-center gap-1.5">
                <span className="text-slate-400 line-through">
                  {formatINR(currentSafeToSpend)}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  {formatINR(newSafeToSpend)}
                </span>
              </div>
            </div>
          </div>

          {formError && (
            <p className="text-xs text-rose-500 font-bold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{formError}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="md"
              variant="primary"
              loading={submitting}
              disabled={availableExtraMoney <= 0}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Confirm & Add to Balance
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
