'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Account, Expense, ReconciliationRecord } from '@/lib/types';
import { StorageService } from '@/lib/storage';
import { calculateAccountStats } from '@/lib/accountCalculations';
import { calculateReconciliationDifference, ReconciliationDiffResult } from '@/lib/safeguardCalculations';
import { formatINR, getCurrentMonthKey } from '@/lib/formatters';
import {
  X,
  Scale,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  History,
  Plus,
  SlidersHorizontal,
  Building2,
  Banknote,
  Sparkles,
} from 'lucide-react';

interface AccountReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  allExpenses: Expense[];
  onAddMissingExpense: (amount: number, accountId: string) => void;
  onSaved?: () => void;
  userId?: string;
}

export function AccountReconciliationModal({
  isOpen,
  onClose,
  account,
  allExpenses,
  onAddMissingExpense,
  onSaved,
  userId,
}: AccountReconciliationModalProps) {
  const [actualBalanceInput, setActualBalanceInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [history, setHistory] = useState<ReconciliationRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'reconcile' | 'history'>('reconcile');
  const [successNote, setSuccessNote] = useState('');

  const stats = useMemo(() => {
    if (!account) return null;
    return calculateAccountStats(account, allExpenses);
  }, [account, allExpenses]);

  const estimatedBalance = stats?.estimatedBalance ?? (account?.opening_balance || 0);

  // Load past reconciliation history for this account
  useEffect(() => {
    if (isOpen && account) {
      setActualBalanceInput('');
      setReasonInput('');
      setSuccessNote('');
      setActiveTab('reconcile');

      StorageService.getReconciliations(account.id, userId).then((records) => {
        setHistory(records);
      });
    }
  }, [isOpen, account, userId]);

  if (!isOpen || !account) return null;

  const enteredActual = parseFloat(actualBalanceInput);
  const hasEntered = !isNaN(enteredActual);
  const diffResult: ReconciliationDiffResult | null = hasEntered
    ? calculateReconciliationDifference(enteredActual, estimatedBalance)
    : null;

  // 1. Resolve by Adding Missing Expense
  const handleResolveWithExpense = async () => {
    if (!diffResult || diffResult.difference >= 0) return;
    const missingAmount = Math.abs(diffResult.difference);

    // Save reconciliation record
    await StorageService.addReconciliation(
      {
        account_id: account.id,
        actual_balance: enteredActual,
        estimated_balance: estimatedBalance,
        difference: diffResult.difference,
        resolved_method: 'expense_added',
        note: `Missing expense of ${formatINR(missingAmount)} logged`,
        date: new Date().toISOString(),
      },
      userId
    );

    onClose();
    onAddMissingExpense(missingAmount, account.id);
  };

  // 2. Resolve with Balance Adjustment
  const handleResolveWithAdjustment = async () => {
    if (!diffResult || diffResult.difference === 0) return;
    setSaving(true);
    try {
      const currentMonth = getCurrentMonthKey();
      const defaultReason = reasonInput.trim() || `Reconciliation: Bank mismatch on ${account.nickname}`;

      await StorageService.addBalanceAdjustment(
        {
          amount: diffResult.difference,
          reason: defaultReason,
          month: currentMonth,
          date: new Date().toISOString().slice(0, 10),
        },
        userId
      );

      await StorageService.addReconciliation(
        {
          account_id: account.id,
          actual_balance: enteredActual,
          estimated_balance: estimatedBalance,
          difference: diffResult.difference,
          resolved_method: 'balance_adjusted',
          note: defaultReason,
          date: new Date().toISOString(),
        },
        userId
      );

      setSuccessNote(`Saved ${formatINR(diffResult.difference)} adjustment to ${currentMonth} spendable budget.`);
      onSaved?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      alert('Failed to save balance adjustment');
    } finally {
      setSaving(false);
    }
  };

  // 3. Confirm Exact Match & Record
  const handleConfirmMatch = async () => {
    if (!hasEntered) return;
    setSaving(true);
    try {
      await StorageService.addReconciliation(
        {
          account_id: account.id,
          actual_balance: enteredActual,
          estimated_balance: estimatedBalance,
          difference: diffResult?.difference || 0,
          resolved_method: 'confirmed_match',
          note: reasonInput.trim() || 'Verified against bank balance',
          date: new Date().toISOString(),
        },
        userId
      );

      setSuccessNote('Reconciliation check recorded successfully.');
      onSaved?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      alert('Failed to record reconciliation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <Card className="w-full max-w-lg overflow-hidden shadow-2xl border-slate-200 dark:border-slate-800 animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-navy-900 dark:text-white">
                Check My Balance
              </h3>
              <p className="text-xs text-slate-400">
                {account.nickname} {account.last_4_digits && `(•••• ${account.last_4_digits})`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 text-xs font-bold px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('reconcile')}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'reconcile'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            Reconcile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({history.length})</span>
          </button>
        </div>

        {activeTab === 'reconcile' ? (
          <div className="p-5 space-y-4 text-xs">
            {/* Account Estimated Balance Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  App&apos;s Estimated Balance
                </span>
                <span className="text-xl font-black text-navy-900 dark:text-white block mt-0.5">
                  {formatINR(estimatedBalance)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Opening {formatINR(account.opening_balance || 0)} - Tracked {formatINR(stats?.totalSpent || 0)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-500 shadow-xs border border-slate-100 dark:border-slate-700">
                {account.type === 'cash' ? (
                  <Banknote className="w-5 h-5 text-amber-500" />
                ) : (
                  <Building2 className="w-5 h-5 text-blue-500" />
                )}
              </div>
            </div>

            {/* Input for Real Balance */}
            <div>
              <Input
                label="Real Balance in Bank / Cash Wallet"
                type="number"
                prefix="₹"
                placeholder="e.g. 14360"
                value={actualBalanceInput}
                onChange={(e) => setActualBalanceInput(e.target.value)}
                hint="Open your bank app and enter your actual available balance"
                required
                autoFocus
              />
            </div>

            {/* Live Comparison Card */}
            {diffResult && (
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  diffResult.isMatch
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : diffResult.status === 'unaccounted'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 font-extrabold text-sm">
                    {diffResult.isMatch ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{diffResult.formattedDiff}</span>
                  </div>

                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/30">
                    {diffResult.status}
                  </span>
                </div>

                <p className="text-xs opacity-90 leading-relaxed">
                  {diffResult.explanation}
                </p>

                {/* Resolution buttons */}
                {!diffResult.isMatch && (
                  <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 space-y-2">
                    {diffResult.status === 'unaccounted' && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Plus className="w-3.5 h-3.5" />}
                        onClick={handleResolveWithExpense}
                        className="w-full text-xs font-bold"
                      >
                        Add Missing Expense ({formatINR(Math.abs(diffResult.difference))})
                      </Button>
                    )}

                    <div className="space-y-1.5">
                      <Input
                        placeholder="Adjustment reason (e.g. Forgot a bill, ATM cash)"
                        value={reasonInput}
                        onChange={(e) => setReasonInput(e.target.value)}
                        className="text-xs"
                      />

                      <Button
                        size="sm"
                        variant="outline"
                        icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                        onClick={handleResolveWithAdjustment}
                        loading={saving}
                        className="w-full text-xs font-bold"
                      >
                        Save as Balance Adjustment ({diffResult.difference > 0 ? '+' : ''}{formatINR(diffResult.difference)})
                      </Button>
                    </div>
                  </div>
                )}

                {diffResult.isMatch && (
                  <div className="mt-3 pt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      onClick={handleConfirmMatch}
                      loading={saving}
                      className="w-full text-xs font-bold"
                    >
                      Record Verified Match
                    </Button>
                  </div>
                )}
              </div>
            )}

            {successNote && (
              <div className="p-3 rounded-xl bg-emerald-100/80 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNote}</span>
              </div>
            )}
          </div>
        ) : (
          /* History Tab */
          <div className="p-5 max-h-80 overflow-y-auto space-y-3 text-xs">
            {history.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <History className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="font-bold">No past reconciliations recorded</p>
                <p className="text-[11px] mt-0.5">Reconcile regularly to catch missed expenses early</p>
              </div>
            ) : (
              history.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-navy-900 dark:text-white">
                      Actual: {formatINR(rec.actual_balance)}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        rec.difference === 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : rec.difference < 0
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {rec.difference === 0 ? 'Match' : `${formatINR(rec.difference)} diff`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Est: {formatINR(rec.estimated_balance)}</span>
                    <span>{new Date(rec.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {rec.note && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                      &ldquo;{rec.note}&rdquo;
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
