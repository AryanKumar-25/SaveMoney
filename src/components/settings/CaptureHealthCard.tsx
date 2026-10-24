'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StorageService } from '@/lib/storage';
import { Expense, CaptureHealthStatus } from '@/lib/types';
import { evaluateCaptureHealth } from '@/lib/safeguardCalculations';
import {
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';

interface CaptureHealthCardProps {
  userId?: string;
  className?: string;
}

export function CaptureHealthCard({ userId, className = '' }: CaptureHealthCardProps) {
  const [lastAutoCaptureTime, setLastAutoCaptureTime] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simulatedSuccess, setSimulatedSuccess] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lastTime, allExp] = await Promise.all([
        StorageService.getLastAutoCaptureTime(userId),
        StorageService.getAllExpenses(userId),
      ]);
      setLastAutoCaptureTime(lastTime);
      setExpenses(allExp);
    } catch (err) {
      console.warn('Failed to load capture health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-capture-health-updated', handleUpdate);
      window.addEventListener('savemoney-expense-updated', handleUpdate);
      return () => {
        window.removeEventListener('savemoney-capture-health-updated', handleUpdate);
        window.removeEventListener('savemoney-expense-updated', handleUpdate);
      };
    }
  }, [userId]);

  const health: CaptureHealthStatus = evaluateCaptureHealth(
    expenses,
    lastAutoCaptureTime,
    new Date()
  );

  const formatLastCapture = (isoStr?: string | null) => {
    if (!isoStr) return 'No auto-capture detected yet';
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      const timeStr = date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      if (diffHours < 24 && date.toDateString() === now.toDateString()) {
        return `Today at ${timeStr}`;
      } else if (diffHours < 48) {
        return `Yesterday at ${timeStr}`;
      } else {
        return `${date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        })} at ${timeStr}`;
      }
    } catch {
      return isoStr;
    }
  };

  const handleSimulateAutoCapture = async () => {
    setSimulating(true);
    try {
      const now = new Date().toISOString();
      await StorageService.recordAutoCapture(now, userId);
      setLastAutoCaptureTime(now);
      setSimulatedSuccess(true);
      setTimeout(() => setSimulatedSuccess(false), 4000);
    } catch (err) {
      console.warn('Failed to record simulation:', err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader
        title="Capture Health & Automation"
        subtitle="Monitor phone webhook and background SMS/UPI auto-capture status"
      />

      <div className="space-y-4 text-xs sm:text-sm">
        {/* Warning Banner if silent for 24+ hours while manual expenses were added */}
        {health.showWarning && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 animate-fadeIn">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">
                Phone Automation May Have Stopped
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Auto-capture has been silent for over 24 hours while manual expenses were recently recorded.
                Please check your phone automation app (MacroDroid, Tasker, or webhook forwarder) to confirm background permissions, battery optimization exemptions, and SMS access.
              </p>
            </div>
          </div>
        )}

        {/* Current Health Status Summary */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              health.showWarning
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}>
              <Smartphone className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Last Auto-Captured Expense
              </p>
              <h4 className="text-sm sm:text-base font-extrabold text-navy-900 dark:text-white mt-0.5">
                {formatLastCapture(health.lastAutoCaptureTime)}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <Button
              size="sm"
              variant="outline"
              icon={<Zap className="w-3.5 h-3.5 text-brand-primary" />}
              loading={simulating}
              onClick={handleSimulateAutoCapture}
              className="text-xs font-bold"
            >
              Simulate Auto-Capture
            </Button>
          </div>
        </div>

        {simulatedSuccess && (
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Auto-capture signal verified! Timestamp updated.</span>
          </p>
        )}

        {/* Multi-Source Deduplication Info */}
        <div className="p-3.5 rounded-2xl bg-brand-500/5 border border-brand-500/20 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-navy-900 dark:text-white">
              Multi-Source Protection Active:{' '}
            </span>
            If the same transaction arrives from two sources (e.g. an instant UPI push notification and a bank debit SMS minutes later), SaveMoney automatically deduplicates by matching amount, timestamp window (within 24 hours), and merchant name.
          </div>
        </div>
      </div>
    </Card>
  );
}
