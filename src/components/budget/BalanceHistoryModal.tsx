'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BalanceAdjustment, ExtraMoneyTransfer } from '@/lib/types';
import { formatINR, formatMonthName } from '@/lib/formatters';
import {
  X,
  History,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
  RotateCcw,
  Calendar,
  Coins,
  SlidersHorizontal,
} from 'lucide-react';

interface BalanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string;
  adjustments: BalanceAdjustment[];
  transfers: ExtraMoneyTransfer[];
  onEditAdjustment: (adj: BalanceAdjustment) => void;
  onDeleteAdjustment: (id: string) => Promise<void>;
  onUndoTransfer: (id: string) => Promise<void>;
}

export function BalanceHistoryModal({
  isOpen,
  onClose,
  month,
  adjustments,
  transfers,
  onEditAdjustment,
  onDeleteAdjustment,
  onUndoTransfer,
}: BalanceHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'adjustments' | 'transfers'>('adjustments');
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDeleteAdj = async (id: string) => {
    if (!confirm('Are you sure you want to delete this balance adjustment? Everything will recalculate.')) return;
    setBusyId(id);
    try {
      await onDeleteAdjustment(id);
    } catch {
      alert('Failed to delete adjustment');
    } finally {
      setBusyId(null);
    }
  };

  const handleUndoMove = async (id: string) => {
    if (!confirm('Undo this transfer? The amount will return to your Extra Money pool and the monthly spendable budget will reduce.')) return;
    setBusyId(id);
    try {
      await onUndoTransfer(id);
    } catch {
      alert('Failed to undo transfer');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <Card className="max-w-lg w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-navy-900 dark:text-white flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-navy-900 dark:text-white tracking-tight">
                Balance & Transfer History
              </h3>
              <p className="text-[11px] text-slate-400">
                Audit trail for {formatMonthName(month)}
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

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 my-3 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('adjustments')}
            className={`py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'adjustments'
                ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-xs'
                : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Adjustments ({adjustments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transfers')}
            className={`py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'transfers'
                ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-xs'
                : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Extra Moves ({transfers.length})</span>
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1">
          {activeTab === 'adjustments' ? (
            adjustments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No direct balance adjustments recorded for {formatMonthName(month)}
              </div>
            ) : (
              adjustments.map((adj) => {
                const isPositive = adj.amount > 0;

                return (
                  <div
                    key={adj.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isPositive
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-navy-900 dark:text-white truncate">
                          {adj.reason}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{new Date(adj.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`font-black text-sm ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}{formatINR(adj.amount)}
                      </span>

                      <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onEditAdjustment(adj);
                          }}
                          className="p-1 text-slate-400 hover:text-brand-primary rounded"
                          title="Edit adjustment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === adj.id}
                          onClick={() => handleDeleteAdj(adj.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete adjustment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            transfers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No extra money was moved into {formatMonthName(month)}
              </div>
            ) : (
              transfers.map((tr) => (
                <div
                  key={tr.id}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Coins className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-navy-900 dark:text-white truncate">
                        {tr.note || 'Moved from Extra Money Pool'}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        <span>{new Date(tr.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-black text-sm text-brand-primary">
                      +{formatINR(tr.amount)}
                    </span>

                    <button
                      type="button"
                      disabled={busyId === tr.id}
                      onClick={() => handleUndoMove(tr.id)}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-slate-600 dark:text-slate-300 hover:text-amber-600 flex items-center gap-1 transition-colors"
                      title="Undo move and return amount to extra money pool"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
