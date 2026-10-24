'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ExpenseListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { AlertItem, AlertSeverity, AlertType } from '@/lib/types';
import {
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  AlertTriangle,
  AlertCircle,
  Info,
  SlidersHorizontal,
  Calendar,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

type FilterTab = 'all' | 'unread' | 'warnings' | 'daily' | 'thresholds';

export default function AlertsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [clearing, setClearing] = useState(false);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const items = await StorageService.getAlerts(userId);
      setAlerts(items);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();

    const handleUpdate = () => {
      loadAlerts();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-alerts-updated', handleUpdate);
      return () => {
        window.removeEventListener('savemoney-alerts-updated', handleUpdate);
      };
    }
  }, [userId]);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.is_read).length, [alerts]);

  const handleMarkAllRead = async () => {
    await StorageService.markAllAlertsAsRead(userId);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('savemoney-alerts-updated'));
    }
  };

  const handleMarkOneRead = async (alert: AlertItem) => {
    if (!alert.is_read) {
      await StorageService.markAlertAsRead(alert.id, userId);
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a)));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-alerts-updated'));
      }
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear your alerts history?')) return;
    try {
      setClearing(true);
      await StorageService.clearAlerts(userId);
      setAlerts([]);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-alerts-updated'));
      }
    } catch (err) {
      alert('Failed to clear alerts');
    } finally {
      setClearing(false);
    }
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (activeTab === 'unread') return !alert.is_read;
      if (activeTab === 'warnings') return alert.severity === 'warning' || alert.severity === 'danger';
      if (activeTab === 'daily') return alert.type === 'over_daily' || alert.type === 'under_daily';
      if (activeTab === 'thresholds') {
        return (
          alert.type === 'threshold_50' ||
          alert.type === 'threshold_80' ||
          alert.type === 'threshold_100' ||
          alert.type === 'projection_warning' ||
          alert.type === 'savings_risk'
        );
      }
      return true;
    });
  }, [alerts, activeTab]);

  // Group alerts by day
  const groupedAlerts = useMemo(() => {
    const groups: { [dateStr: string]: { displayDate: string; items: AlertItem[] } } = {};
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    for (const alert of filteredAlerts) {
      const day = alert.created_at.slice(0, 10);
      if (!groups[day]) {
        let display = new Date(alert.created_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        if (day === todayStr) display = 'Today, ' + display;
        else if (day === yesterdayStr) display = 'Yesterday, ' + display;

        groups[day] = {
          displayDate: display,
          items: [],
        };
      }
      groups[day].items.push(alert);
    }

    return Object.entries(groups).sort(
      ([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime()
    );
  }, [filteredAlerts]);

  const getAlertBadge = (type: AlertType, severity: AlertSeverity) => {
    switch (type) {
      case 'over_daily':
        return { label: "Over Today's Limit", color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' };
      case 'under_daily':
        return { label: 'Under Limit', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' };
      case 'threshold_50':
        return { label: '50% Budget Crossed', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' };
      case 'threshold_80':
        return { label: '80% Budget Crossed', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' };
      case 'threshold_100':
        return { label: '100% Budget Crossed', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' };
      case 'projection_warning':
        return { label: 'Projection Warning', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' };
      case 'savings_risk':
        return { label: 'Savings at Risk', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' };
      default:
        return { label: 'Notice', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    if (severity === 'danger') {
      return (
        <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 stroke-[2.2]" />
        </div>
      );
    }
    if (severity === 'warning') {
      return (
        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
        <Info className="w-5 h-5 stroke-[2.2]" />
      </div>
    );
  };

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-brand-light text-brand-primary dark:bg-brand-primary/20">
              <Bell className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Notifications & Alerts
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            Spending Alerts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time triggers when you exceed daily safe-to-spend or cross monthly thresholds.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              icon={<CheckCheck className="w-3.5 h-3.5" />}
            >
              Mark all read
            </Button>
          )}

          {alerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={clearing}
              className="text-slate-400 hover:text-rose-600"
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Clear
            </Button>
          )}

          <Link href="/settings">
            <Button variant="outline" size="sm" icon={<Settings className="w-3.5 h-3.5" />}>
              Configure
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-850 rounded-2xl overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-navy-900 dark:text-slate-400'
          }`}
        >
          All ({alerts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('unread')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'unread'
              ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-navy-900 dark:text-slate-400'
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-brand-primary text-white text-[10px] font-black flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('warnings')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'warnings'
              ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-navy-900 dark:text-slate-400'
          }`}
        >
          Warnings & Over-limit
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'daily'
              ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-navy-900 dark:text-slate-400'
          }`}
        >
          Daily Limit
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('thresholds')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'thresholds'
              ? 'bg-white dark:bg-slate-700 text-navy-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-navy-900 dark:text-slate-400'
          }`}
        >
          Monthly Thresholds
        </button>
      </div>

      {/* Alert List */}
      {loading ? (
        <ExpenseListSkeleton count={5} />
      ) : groupedAlerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-7 h-7 stroke-[1.8]" />}
          title={activeTab === 'all' ? 'No alerts yet' : 'No matching alerts'}
          description={
            activeTab === 'all'
              ? 'Add expenses to see real-time alerts when you stay under your daily safe spend or cross monthly budget milestones.'
              : 'There are no spending alerts matching this filter right now.'
          }
          actionText="Check Budget"
          onAction={() => {
            window.location.href = '/budget';
          }}
          secondaryActionText="Alert Settings"
          onSecondaryAction={() => {
            window.location.href = '/settings';
          }}
        />
      ) : (
        <div className="space-y-6">
          {groupedAlerts.map(([day, group]) => (
            <div key={day} className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {group.displayDate}
                </h3>
              </div>

              <div className="space-y-2">
                {group.items.map((alert) => {
                  const badge = getAlertBadge(alert.type, alert.severity);

                  return (
                    <Card
                      key={alert.id}
                      onClick={() => handleMarkOneRead(alert)}
                      className={`p-4 transition-all cursor-pointer border ${
                        !alert.is_read
                          ? 'border-brand-primary/30 dark:border-brand-primary/40 bg-white dark:bg-slate-850 shadow-md ring-1 ring-brand-primary/10'
                          : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-white/60 dark:bg-slate-900/40 opacity-90'
                      }`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        {getSeverityIcon(alert.severity)}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatTime(alert.created_at)}
                            </span>
                            {!alert.is_read && (
                              <span className="text-[10px] font-black text-brand-primary uppercase tracking-wide">
                                • New
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-xs sm:text-sm leading-relaxed ${
                              !alert.is_read
                                ? 'font-bold text-navy-900 dark:text-white'
                                : 'text-slate-600 dark:text-slate-300 font-medium'
                            }`}
                          >
                            {alert.message}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
