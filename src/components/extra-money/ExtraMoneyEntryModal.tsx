'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { StorageService } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { ExtraMoneyEntry } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import {
  X,
  Sparkles,
  Gift,
  Coins,
  AlertCircle,
  Calendar,
  Check,
} from 'lucide-react';

interface ExtraMoneyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryToEdit?: ExtraMoneyEntry | null;
  onSaved?: () => void;
}

const COMMON_SOURCES = [
  'Freelance',
  'Gift',
  'Refund',
  'Cashback',
  'Bonus',
  'Old Items Sold',
  'Dividend',
];

export function ExtraMoneyEntryModal({
  isOpen,
  onClose,
  entryToEdit,
  onSaved,
}: ExtraMoneyEntryModalProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('Freelance');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormError('');
      if (entryToEdit) {
        setAmount(String(entryToEdit.amount));
        setSource(entryToEdit.source);
        setDate(entryToEdit.date ? entryToEdit.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
        setNote(entryToEdit.note || '');
      } else {
        setAmount('');
        setSource('Freelance');
        setDate(new Date().toISOString().slice(0, 10));
        setNote('');
      }
    }
  }, [isOpen, entryToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Amount must be greater than ₹0');
      return;
    }

    if (!source.trim()) {
      setFormError('Please specify the source (e.g. freelance, gift, refund)');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const entryDate = date ? new Date(date).toISOString() : new Date().toISOString();

      if (entryToEdit) {
        await StorageService.updateExtraMoneyEntry(
          {
            ...entryToEdit,
            amount: numAmount,
            source: source.trim(),
            date: entryDate,
            note: note.trim() || undefined,
          },
          userId
        );
      } else {
        await StorageService.addExtraMoneyEntry(
          {
            amount: numAmount,
            source: source.trim(),
            date: entryDate,
            note: note.trim() || undefined,
          },
          userId
        );
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-extra-money-updated'));
        window.dispatchEvent(
          new CustomEvent('savemoney-show-toast', {
            detail: {
              message: entryToEdit ? 'Extra money entry updated' : 'Extra money added to your pool!',
              severity: 'info',
            },
          })
        );
      }

      onSaved?.();
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <Card className="max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shadow-xs">
              <Coins className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-navy-900 dark:text-white tracking-tight">
                {entryToEdit ? 'Edit Extra Money' : 'Record Extra Money'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Gifts, refunds, cashbacks & freelance earnings
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
          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Amount (₹ INR) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-brand-primary pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy-900 dark:text-white text-xl sm:text-2xl font-black tracking-tight focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder:text-slate-300"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Source Input & Preset chips */}
          <div className="space-y-2">
            <Input
              label="Source / Origin *"
              placeholder="e.g. Birthday Gift, Freelance project, Tax refund"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SOURCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={`text-[11px] px-2 py-0.5 rounded-lg font-semibold transition-all border ${
                    source.toLowerCase() === s.toLowerCase()
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Date Received</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy-900 dark:text-slate-100 text-xs font-semibold px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>

          {/* Note Input */}
          <Input
            label="Note (Optional)"
            placeholder="e.g. Received via UPI from uncle"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* Explanatory note */}
          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
            💡 <strong>Protected from your monthly budget:</strong> Extra money stays in your private reserve and does not affect your salary, spendable budget, daily safe-to-spend, or alerts until you explicitly click &ldquo;Add to balance&rdquo;.
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
            <Button type="submit" size="md" variant="primary" loading={saving}>
              {entryToEdit ? 'Save Changes' : 'Record Extra Money'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
