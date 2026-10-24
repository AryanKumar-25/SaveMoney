'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Expense, DailyCheckInStatus, UserAlertSettings } from '@/lib/types';
import { StorageService } from '@/lib/storage';
import { evaluateDailyCheckIn, DailyCheckInEvaluation } from '@/lib/safeguardCalculations';
import { formatINR } from '@/lib/formatters';
import {
  CalendarCheck,
  Check,
  Plus,
  Sparkles,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface DailyCheckInCardProps {
  expenses: Expense[];
  onOpenQuickAdd: () => void;
  userId?: string;
  className?: string;
}

export function DailyCheckInCard({
  expenses,
  onOpenQuickAdd,
  userId,
  className = '',
}: DailyCheckInCardProps) {
  const [checkInStatus, setCheckInStatus] = useState<DailyCheckInStatus | null>(null);
  const [alertSettings, setAlertSettings] = useState<UserAlertSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);

  const loadStatus = async () => {
    try {
      const [status, settings] = await Promise.all([
        StorageService.getDailyCheckInStatus(todayKey, userId),
        StorageService.getAlertSettings(userId),
      ]);
      setCheckInStatus(status);
      setAlertSettings(settings);
    } catch (err) {
      console.warn('Failed to load daily check-in status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();

    const handleUpdate = () => {
      loadStatus();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-checkin-updated', handleUpdate);
      window.addEventListener('savemoney-expense-updated', handleUpdate);
      return () => {
        window.removeEventListener('savemoney-checkin-updated', handleUpdate);
        window.removeEventListener('savemoney-expense-updated', handleUpdate);
      };
    }
  }, [todayKey, userId]);

  const evaluation: DailyCheckInEvaluation = evaluateDailyCheckIn({
    expenses,
    checkInStatus,
    configuredTime: alertSettings?.dailyCheckInTime || '21:00',
    enabled: alertSettings?.dailyCheckInEnabled !== false,
  });

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const type = evaluation.isZeroSpend ? 'zero_spend_confirmed' : 'nothing_missed';
      const updated = await StorageService.confirmDailyCheckIn(todayKey, type, userId);
      setCheckInStatus(updated);
      setJustConfirmed(true);
      setTimeout(() => {
        setJustConfirmed(false);
      }, 4000);
    } catch (err) {
      console.warn('Failed to confirm check-in:', err);
    } finally {
      setConfirming(false);
    }
  };

  // If user just confirmed or check-in is already confirmed, we show a clean compact badge or hide
  if (justConfirmed) {
    return (
      <Card className={`p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800 animate-fadeIn ${className}`}>
        <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>All set for today! Confirmed that no expenses were missed.</span>
        </div>
      </Card>
    );
  }

  // If check-in should not show right now (e.g. morning, or already confirmed)
  if (!evaluation.shouldShow) {
    return null;
  }

  return (
    <Card className={`p-4 sm:p-5 relative overflow-hidden border-brand-200/80 dark:border-brand-900/50 bg-gradient-to-r from-brand-500/10 via-amber-500/5 to-transparent ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
            evaluation.isZeroSpend
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'bg-brand-primary/15 text-brand-primary'
          }`}>
            {evaluation.isZeroSpend ? (
              <HelpCircle className="w-5 h-5 stroke-[2.2]" />
            ) : (
              <CalendarCheck className="w-5 h-5 stroke-[2.2]" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                evaluation.isZeroSpend ? 'text-amber-600 dark:text-amber-400' : 'text-brand-primary'
              }`}>
                {evaluation.isZeroSpend ? 'Zero Spending Check' : 'Evening Check-in'}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            </div>

            <h4 className="text-sm sm:text-base font-extrabold text-navy-900 dark:text-white mt-0.5">
              {evaluation.title}
            </h4>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {evaluation.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            size="sm"
            variant="outline"
            icon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
            onClick={handleConfirm}
            loading={confirming}
            className="text-xs font-bold hover:border-emerald-500"
          >
            {evaluation.isZeroSpend ? 'Yes, zero spent' : 'Nothing missed today'}
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenQuickAdd}
            className="text-xs font-bold"
          >
            Add Expense
          </Button>
        </div>
      </div>
    </Card>
  );
}
