'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBudget } from '@/hooks/useBudget';
import { StorageService } from '@/lib/storage';
import { ExtraMoneyEntry, ExtraMoneyTransfer, ExtraMoneyPool } from '@/lib/types';
import { formatINR, formatMonthName, getCurrentMonthKey } from '@/lib/formatters';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCardSkeleton, ExpenseListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ExtraMoneyEntryModal } from '@/components/extra-money/ExtraMoneyEntryModal';
import { MoveToBalanceModal } from '@/components/extra-money/MoveToBalanceModal';
import {
  Coins,
  Plus,
  TrendingUp,
  RotateCcw,
  Edit2,
  Trash2,
  Calendar,
  Sparkles,
  Gift,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function ExtraMoneyPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const {
    currentMonth,
    calculation,
    spending,
    refreshBudget,
  } = useBudget();

  const [entries, setEntries] = useState<ExtraMoneyEntry[]>([]);
  const [transfers, setTransfers] = useState<ExtraMoneyTransfer[]>([]);
  const [pool, setPool] = useState<ExtraMoneyPool>({
    totalReceived: 0,
    totalTransferred: 0,
    availableExtraMoney: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<ExtraMoneyEntry | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);

  // Busy state for deleting / undoing
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allEntries, allTransfers, poolData] = await Promise.all([
        StorageService.getExtraMoneyEntries(userId),
        StorageService.getExtraMoneyTransfers(userId),
        StorageService.getExtraMoneyPool(userId),
      ]);

      setEntries(allEntries);
      setTransfers(allTransfers);
      setPool(poolData);
    } catch (err: unknown) {
      console.error('Failed to load extra money data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load extra money data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-extra-money-updated', handleUpdate);
      return () => {
        window.removeEventListener('savemoney-extra-money-updated', handleUpdate);
      };
    }
  }, [loadData]);

  // Handle Delete Entry
  const handleDeleteEntry = async (entry: ExtraMoneyEntry) => {
    // Check if deleting would leave available pool negative
    if (pool.totalReceived - entry.amount < pool.totalTransferred) {
      alert(
        `Cannot delete this entry. You have already moved ₹${pool.totalTransferred} into monthly budgets, which exceeds what would be left. Please undo a transfer first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete this ₹${entry.amount} entry from "${entry.source}"?`)) {
      return;
    }

    setBusyId(entry.id);
    try {
      await StorageService.deleteExtraMoneyEntry(entry.id, userId);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-extra-money-updated'));
        window.dispatchEvent(new Event('savemoney-budget-updated'));
      }
      loadData();
    } catch {
      alert('Failed to delete entry');
    } finally {
      setBusyId(null);
    }
  };

  // Handle Undo Transfer
  const handleUndoTransfer = async (transfer: ExtraMoneyTransfer) => {
    if (
      !confirm(
        `Undo move of ${formatINR(transfer.amount)} to ${formatMonthName(transfer.month)}? The amount will return to your available pool.`
      )
    ) {
      return;
    }

    setBusyId(transfer.id);
    try {
      await StorageService.undoExtraMoneyTransfer(transfer.id, userId);
      setTransfers((prev) => prev.filter((t) => t.id !== transfer.id));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-extra-money-updated'));
        window.dispatchEvent(new Event('savemoney-budget-updated'));
        window.dispatchEvent(
          new CustomEvent('savemoney-show-toast', {
            detail: {
              message: `Restored ${formatINR(transfer.amount)} back to your extra money pool!`,
              severity: 'info',
            },
          })
        );
      }
      loadData();
      refreshBudget();
    } catch {
      alert('Failed to undo transfer');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Coins className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Windfalls & Reserve Pool
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            Extra Money
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gifts, refunds, cashbacks & freelance earnings kept outside your monthly salary until explicitly moved
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<TrendingUp className="w-3.5 h-3.5 text-brand-primary" />}
            onClick={() => setMoveModalOpen(true)}
            disabled={pool.availableExtraMoney <= 0}
            title={pool.availableExtraMoney <= 0 ? 'No extra money available to move' : 'Add extra money to this month\'s spendable budget'}
          >
            Add to Balance
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setEntryToEdit(null);
              setEntryModalOpen(true);
            }}
          >
            Record Extra Money
          </Button>
        </div>
      </div>

      {/* 3 Reserve Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : error ? (
        <ErrorState title="Could not load extra money" message={error} onRetry={loadData} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Available Extra Money */}
          <Card className="p-4 sm:p-5 relative overflow-hidden border-amber-200/80 dark:border-amber-900/60 bg-gradient-to-br from-amber-500/10 via-brand-primary/5 to-transparent">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 text-[11px]">
                Available to Move
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                RESERVE POOL
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
              {formatINR(pool.availableExtraMoney)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Carries over across months until you choose to use it
            </p>
          </Card>

          {/* Card 2: Total Received */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                Total Received
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {entries.length} entries
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
              {formatINR(pool.totalReceived)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              All-time gifts, refunds, freelance & windfalls
            </p>
          </Card>

          {/* Card 3: Total Moved to Balances */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                Moved to Balances
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                {transfers.length} moves
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
              {formatINR(pool.totalTransferred)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Injected into monthly discretionary spending budgets
            </p>
          </Card>
        </div>
      )}

      {/* Two Column Grid: Entries List (Left) and Transfers History (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Extra Money Receipts (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-navy-900 dark:text-white tracking-tight">
              Received Extra Money ({entries.length})
            </h3>
            <span className="text-xs text-slate-400">
              Not counted in salary or monthly budgets
            </span>
          </div>

          {entries.length === 0 ? (
            <EmptyState
              icon={<Coins className="w-7 h-7 stroke-[1.8]" />}
              title="No extra money recorded yet"
              description="Keep track of freelance payments, refunds, cashbacks, birthday gifts, or unexpected income here."
              actionText="Record First Entry"
              actionIcon={<Plus className="w-3.5 h-3.5" />}
              onAction={() => {
                setEntryToEdit(null);
                setEntryModalOpen(true);
              }}
            />
          ) : (
            <Card className="p-0 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5 stroke-[2]" />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-navy-900 dark:text-white truncate">
                        {entry.source}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(entry.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {entry.note && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[150px]">{entry.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base sm:text-lg font-black text-navy-900 dark:text-white">
                      +{formatINR(entry.amount)}
                    </span>

                    <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setEntryToEdit(entry);
                          setEntryModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors"
                        title="Edit entry"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === entry.id}
                        onClick={() => handleDeleteEntry(entry)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Right Column: Move to Balance History (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-navy-900 dark:text-white tracking-tight">
              Transfer History ({transfers.length})
            </h3>
            <span className="text-xs text-slate-400">
              Added to monthly budgets
            </span>
          </div>

          {transfers.length === 0 ? (
            <Card className="py-12 px-5 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <TrendingUp className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                No money moved to monthly balances yet
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Whenever you want extra discretionary spending power for this month, click &ldquo;Add to Balance&rdquo;.
              </p>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {transfers.map((tr) => (
                <div
                  key={tr.id}
                  className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-navy-900 dark:text-white truncate">
                      <span>{formatMonthName(tr.month)} Budget</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{new Date(tr.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      {tr.note && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{tr.note}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-black text-sm text-brand-primary">
                      +{formatINR(tr.amount)}
                    </span>

                    <button
                      type="button"
                      disabled={busyId === tr.id}
                      onClick={() => handleUndoTransfer(tr)}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-slate-600 dark:text-slate-300 hover:text-amber-600 flex items-center gap-1 transition-colors"
                      title="Undo move and return amount to extra money pool"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {/* Add / Edit Extra Money Modal */}
      <ExtraMoneyEntryModal
        isOpen={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        entryToEdit={entryToEdit}
        onSaved={loadData}
      />

      {/* Move to Balance Modal */}
      <MoveToBalanceModal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        availableExtraMoney={pool.availableExtraMoney}
        currentSpendableBudget={calculation.spendableBudget}
        spentSoFarThisMonth={spending.spentSoFarThisMonth}
        spentToday={spending.spentToday}
        targetMonth={currentMonth}
        onMoved={() => {
          loadData();
          refreshBudget();
        }}
      />
    </div>
  );
}
