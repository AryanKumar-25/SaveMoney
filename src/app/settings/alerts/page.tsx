'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuth } from '@/hooks/useAuth';
import { formatINR, getCurrentMonthKey, formatMonthName } from '@/lib/formatters';
import { AlertItem } from '@/lib/types';
import {
  Activity,
  ArrowLeft,
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Send,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Calendar,
  Layers,
  Database,
  Key,
} from 'lucide-react';

interface DiagnosticsData {
  numbers: {
    spendableBudget: number;
    baseSpendableBudget: number;
    spentSoFar: number;
    spentToday: number;
    dailyAllowance: number;
    safeToSpendToday: number;
    daysRemaining: number;
    percentUsed: number;
    projectedSpend: number;
    isProjectedOverBudget: boolean;
  };
  rulesEvaluated: {
    rule: string;
    enabled: boolean;
    fired: boolean;
    reason: string;
  }[];
  recentAlerts: AlertItem[];
  pushSubscriptionsCount: number;
  lastPushError: string | null;
  envChecks: {
    NEXT_PUBLIC_SUPABASE_URL: boolean;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: boolean;
    SUPABASE_SERVICE_ROLE_KEY: boolean;
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: boolean;
    VAPID_PRIVATE_KEY: boolean;
    VAPID_SUBJECT: boolean;
  };
}

export default function AlertDiagnosticsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [month, setMonth] = useState(getCurrentMonthKey());
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [evaluating, setEvaluating] = useState(false);
  const [testingInApp, setTestingInApp] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const loadDiagnostics = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/alerts/diagnostics?userId=${userId}&month=${month}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch alert diagnostics');
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown diagnostics error');
    } finally {
      setLoading(false);
    }
  }, [userId, month]);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handleRunEvaluation = async () => {
    if (!userId) return;
    setEvaluating(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/alerts/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, month }),
      });
      const result = await res.json();
      if (res.ok) {
        const count = result.alertsCreated?.length || 0;
        setActionMessage({
          text: `Evaluation complete! ${count} new alert(s) generated.`,
          type: 'success',
        });
        await loadDiagnostics();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('savemoney-alerts-updated'));
        }
      } else {
        throw new Error(result.error || 'Evaluation failed');
      }
    } catch (err: unknown) {
      setActionMessage({
        text: err instanceof Error ? err.message : 'Failed to run evaluation',
        type: 'error',
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handleSendTestInApp = async () => {
    if (!userId) return;
    setTestingInApp(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode: 'in-app' }),
      });
      const result = await res.json();
      if (res.ok) {
        setActionMessage({
          text: `Test in-app alert saved to Supabase (id: ${result.alert?.id?.slice(0, 8)}...)`,
          type: 'success',
        });
        await loadDiagnostics();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('savemoney-alerts-updated'));
          window.dispatchEvent(
            new CustomEvent('savemoney-show-toast', {
              detail: {
                message: result.alert?.message || '🔔 Test in-app alert received!',
                severity: 'info',
              },
            })
          );
        }
      } else {
        throw new Error(result.error || 'Failed to send test in-app alert');
      }
    } catch (err: unknown) {
      setActionMessage({
        text: err instanceof Error ? err.message : 'Test in-app alert failed',
        type: 'error',
      });
    } finally {
      setTestingInApp(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!userId) return;
    setTestingPush(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode: 'push' }),
      });
      const result = await res.json();
      if (res.ok) {
        const sent = result.pushResult?.sent || 0;
        const failed = result.pushResult?.failed || 0;
        const subs = result.pushResult?.totalSubscriptions || 0;

        if (sent > 0) {
          setActionMessage({
            text: `Web push delivered to ${sent} active device subscription(s)!`,
            type: 'success',
          });
        } else if (subs === 0) {
          setActionMessage({
            text: 'No push subscriptions found for your account. Enable push in Settings first.',
            type: 'info',
          });
        } else {
          setActionMessage({
            text: `Push delivery failed (${failed} errors). Check VAPID configuration.`,
            type: 'error',
          });
        }
        await loadDiagnostics();
      } else {
        throw new Error(result.error || 'Failed to send test push');
      }
    } catch (err: unknown) {
      setActionMessage({
        text: err instanceof Error ? err.message : 'Test push failed',
        type: 'error',
      });
    } finally {
      setTestingPush(false);
    }
  };

  const formatTimeAgo = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/settings"
              className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-brand-primary" />
            Alert Engine Diagnostics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Inspect real-time numbers, rule triggers, push dispatch, and Supabase alert rows for{' '}
            <strong className="text-navy-900 dark:text-white">{formatMonthName(month)}</strong>.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDiagnostics}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRunEvaluation}
            disabled={evaluating}
            icon={<Activity className="w-3.5 h-3.5" />}
          >
            {evaluating ? 'Evaluating...' : 'Run Evaluation Now'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTestInApp}
            disabled={testingInApp}
            icon={<Bell className="w-3.5 h-3.5 text-brand-primary" />}
          >
            {testingInApp ? 'Sending...' : 'Send Test In-App'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTestPush}
            disabled={testingPush}
            icon={<Smartphone className="w-3.5 h-3.5 text-indigo-500" />}
          >
            {testingPush ? 'Sending...' : 'Send Test Push'}
          </Button>
        </div>
      </div>

      {/* Action Status Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2.5 animate-fadeIn ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : actionMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : actionMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <Activity className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <ErrorState
          title="Diagnostics inspection failed"
          message={error}
          onRetry={loadDiagnostics}
        />
      ) : data ? (
        <>
          {/* SECTION 1: FINANCIAL NUMBERS MATRIX */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Coins className="w-4 h-4 text-brand-primary" />
                Current Financial Parameters ({formatMonthName(month)})
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Spendable Budget
                </p>
                <p className="text-lg sm:text-xl font-black text-navy-900 dark:text-white">
                  {formatINR(data.numbers.spendableBudget)}
                </p>
                <p className="text-[10px] text-slate-400">
                  Base: {formatINR(data.numbers.baseSpendableBudget)}
                </p>
              </Card>

              <Card className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Spent This Month
                </p>
                <p className="text-lg sm:text-xl font-black text-navy-900 dark:text-white">
                  {formatINR(data.numbers.spentSoFar)}
                </p>
                <p className="text-[10px] text-slate-400">
                  {data.numbers.percentUsed}% of budget
                </p>
              </Card>

              <Card className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Spent Today
                </p>
                <p className="text-lg sm:text-xl font-black text-navy-900 dark:text-white">
                  {formatINR(data.numbers.spentToday)}
                </p>
                <p className="text-[10px] text-slate-400">
                  Allowance: {formatINR(data.numbers.dailyAllowance)}
                </p>
              </Card>

              <Card className="p-4 space-y-1 border-brand-primary/30 dark:border-brand-primary/40 bg-brand-light/30 dark:bg-brand-primary/10">
                <p className="text-[11px] font-bold text-brand-primary uppercase tracking-wide">
                  Safe to Spend Today
                </p>
                <p className="text-lg sm:text-xl font-black text-brand-primary">
                  {formatINR(data.numbers.safeToSpendToday)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {data.numbers.daysRemaining} days left in month
                </p>
              </Card>

              <Card className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Projected Month-End
                </p>
                <p
                  className={`text-lg sm:text-xl font-black ${
                    data.numbers.isProjectedOverBudget ? 'text-rose-500' : 'text-emerald-500'
                  }`}
                >
                  {formatINR(data.numbers.projectedSpend)}
                </p>
                <p className="text-[10px] text-slate-400">
                  {data.numbers.isProjectedOverBudget ? '⚠ Over budget' : '✓ Under budget'}
                </p>
              </Card>
            </div>
          </div>

          {/* SECTION 2: RULE STATUS MATRIX */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Alert Rules Evaluation Matrix"
              subtitle="Shows whether each rule is enabled in user settings, whether it would fire right now, and the exact arithmetic calculation."
            />

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.rulesEvaluated.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div className="space-y-1 md:max-w-md">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-navy-900 dark:text-white">
                        {rule.rule}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                      {rule.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Enabled Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-semibold">Enabled:</span>
                      {rule.enabled ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Yes
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> No
                        </span>
                      )}
                    </div>

                    {/* Would Fire Now Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-semibold">Would Fire:</span>
                      {rule.fired ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Yes (Fires)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1">
                          No
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* SECTION 3: PUSH NOTIFICATIONS & ENVIRONMENT HEALTH */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Push Infrastructure */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Smartphone className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-sm text-navy-900 dark:text-white">
                  Push Delivery Infrastructure
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Active Push Subscriptions (Supabase):
                  </span>
                  <span className="font-black text-navy-900 dark:text-white px-2 py-0.5 rounded-md bg-white dark:bg-slate-700">
                    {data.pushSubscriptionsCount} device(s)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Last Push Delivery Error:
                  </span>
                  {data.lastPushError ? (
                    <span className="font-bold text-rose-500 text-[11px] truncate max-w-xs">
                      {data.lastPushError}
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                      None (Clean)
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Web push sends over VAPID to subscribed service workers. When a browser returns
                  HTTP 410 (Gone) or 404 (Not Found), dead endpoints are automatically cleaned from
                  Supabase.
                </p>
              </div>
            </Card>

            {/* Server Environment Variables Presence */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Key className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-sm text-navy-900 dark:text-white">
                  Environment Keys Presence (Values Hidden)
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                {Object.entries(data.envChecks).map(([keyName, isPresent]) => (
                  <div
                    key={keyName}
                    className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {keyName}
                    </span>
                    {isPresent ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Configured
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Missing
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* SECTION 4: LAST 20 ALERT ROWS FROM DATABASE */}
          <Card className="overflow-hidden">
            <CardHeader
              title={`Last 20 Alert Records in Supabase (public.alerts)`}
              subtitle="Shows persistence, dedupe_key unique values, push delivery timestamps, and push errors."
            />

            {data.recentAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Database className="w-7 h-7 mx-auto mb-2 opacity-30" />
                No alert records exist in Supabase yet. Run an evaluation or add an expense to create
                records.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Created At</th>
                      <th className="py-2.5 px-4">Type / Severity</th>
                      <th className="py-2.5 px-4">Title & Message</th>
                      <th className="py-2.5 px-4">Dedupe Key</th>
                      <th className="py-2.5 px-4">Push Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {data.recentAlerts.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {formatTimeAgo(row.created_at)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              row.severity === 'danger'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : row.severity === 'warning'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-sm">
                          {row.title && (
                            <p className="font-bold text-navy-900 dark:text-white mb-0.5">
                              {row.title}
                            </p>
                          )}
                          <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                            {row.message}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                          {row.dedupe_key || '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-[11px]">
                          {row.push_sent_at ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              ✓ Sent ({formatTimeAgo(row.push_sent_at)})
                            </span>
                          ) : row.push_error ? (
                            <span
                              className="text-rose-500 font-bold truncate block max-w-xs"
                              title={row.push_error}
                            >
                              ⚠ Error: {row.push_error}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
