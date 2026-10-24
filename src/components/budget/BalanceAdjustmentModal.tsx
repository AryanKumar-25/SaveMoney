'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { StorageService } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { BalanceAdjustment } from '@/lib/types';
import { formatINR, getCurrentMonthKey, formatMonthName } from '@/lib/formatters';
import { calculateSafeToSpendToday } from '@/lib/calculations';
import {
  X,
  SlidersHorizontal,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Plus,
  Minus,
  CheckCircle2,
} from 'lucide-react';

interface BalanceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpendableBudget: number;
  spentSoFarThisMonth: number;
  spentToday: number;
  targetMonth?: string;
  adjustmentToEdit?: BalanceAdjustment | null;
  onSaved?: () => void;
}

const COMMON_REASONS = [
  'Cash found',
  'Forgot a bill',
  'Correction',
  'ATM withdrawal not tracked',
  'Lent to friend',
  'Returned from friend',
  'Bank interest / charge',
];

export function BalanceAdjustmentModal({
  isOpen,
  onClose,
  currentSpendableBudget,
  spentSoFarThisMonth,
  spentToday,
  targetMonth = getCurrentMonthKey(),
  adjustmentToEdit,
  onSaved,
}: BalanceAdjustmentModalProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const [type, setType] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormError('');
      if (adjustmentToEdit) {
        setType(adjustmentToEdit.amount < 0 ? 'subtract' : 'add');
        setAmount(String(Math.abs(adjustmentToEdit.amount)));
        setReason(adjustmentToEdit.reason);
        setDate(adjustmentToEdit.date ? adjustmentToEdit.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      } else {
        setType('add');
        setAmount('');
        setReason('');
        setDate(new Date().toISOString().slice(0, 10));
      }
    }
  }, [isOpen, adjustmentToEdit]);

  // Compute live preview
  const rawNumAmount = parseFloat(amount) || 0;
  const signedAmount = type === 'add' ? rawNumAmount : -rawNumAmount;

  // If editing an existing adjustment, difference = signedAmount - oldAmount
  const oldAdjustmentAmount = adjustmentToEdit ? adjustmentToEdit.amount : 0;
  const delta = signedAmount - oldAdjustmentAmount;
  const newSpendableBudget = currentSpendableBudget + delta;

  // Safe to spend preview
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rawNumAmount <= 0) {
      setFormError('Amount must be greater than ₹0');
      return;
    }

    if (!reason.trim()) {
      setFormError('A required reason is needed (e.g. Cash found, Forgot a bill, Correction)');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const entryDate = date ? new Date(date).toISOString() : new Date().toISOString();

      if (adjustmentToEdit) {
        await StorageService.updateBalanceAdjustment(
          {
            ...adjustmentToEdit,
            amount: signedAmount,
            reason: reason.trim(),
            date: entryDate,
            month: targetMonth,
          },
          userId
        );
      } else {
        await StorageService.addBalanceAdjustment(
          {
            amount: signedAmount,
            reason: reason.trim(),
            date: entryDate,
            month: targetMonth,
          },
          userId
        );
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-adjustments-updated'));
        window.dispatchEvent(new Event('savemoney-budget-updated'));
        window.dispatchEvent(
          new CustomEvent('savemoney-show-toast', {
            detail: {
              message: `Balance adjustment of ${type === 'add' ? '+' : '-'}${formatINR(rawNumAmount)} applied to ${formatMonthName(targetMonth)}!`,
              severity: 'info',
            },
          })
        );
      }

      onSaved?.();
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save adjustment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <Card className="max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center shadow-sm">
              <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-navy-900 dark:text-white tracking-tight">
                {adjustmentToEdit ? 'Edit Balance Adjustment' : 'Adjust Monthly Balance'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Direct manual adjustment for {formatMonthName(targetMonth)}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Add vs Subtract Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setType('add')}
                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs transition-all ${
                  type === 'add'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add to Budget</span>
              </button>

              <button
                type="button"
                onClick={() => setType('subtract')}
                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs transition-all ${
                  type === 'subtract'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
                <span>- Deduct from Budget</span>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Amount (₹ INR) *
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black ${
                type === 'add' ? 'text-emerald-500' : 'text-rose-500'
              } pointer-events-none`}>
                {type === 'add' ? '+₹' : '-₹'}
              </span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="1000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setFormError('');
                }}
                className="w-full pl-12 pr-4 py-2.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy-900 dark:text-white text-xl sm:text-2xl font-black tracking-tight focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder:text-slate-300"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Reason Input & Reason Chips */}
          <div className="space-y-2">
            <Input
              label="Reason (Required) *"
              placeholder="e.g. Cash found in old wallet, Forgot internet bill"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[11px] px-2 py-0.5 rounded-lg font-semibold transition-all border ${
                    reason.toLowerCase() === r.toLowerCase()
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Adjustment Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy-900 dark:text-slate-100 text-xs font-semibold px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px] block">
              Live Impact Preview
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
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-indigo-600 dark:text-indigo-400 font-black">
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
              loading={saving}
            >
              {adjustmentToEdit ? 'Save Changes' : 'Confirm Adjustment'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
