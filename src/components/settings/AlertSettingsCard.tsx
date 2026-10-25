'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { UserAlertSettings } from '@/lib/types';
import {
  getPushSubscriptionState,
  registerPushSubscription,
  unregisterPushSubscription,
  PushClientState,
} from '@/lib/pushClient';
import Link from 'next/link';
import {
  Bell,
  Send,
  Check,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Info,
  CalendarCheck,
  Scale,
  Clock,
  Activity,
} from 'lucide-react';

export function AlertSettingsCard() {
  const { user } = useAuth();
  const userId = user?.id;

  const [settings, setSettings] = useState<UserAlertSettings>({
    overDaily: true,
    underDaily: true,
    budgetThresholds: true,
    thresholds: [50, 80, 100],
    projectionWarning: true,
    savingsAtRisk: true,
    pushNotifications: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState('');
  const [pushStatus, setPushStatus] = useState<PushClientState>({
    status: 'checking',
    supported: false,
    permission: 'not_supported',
    isSubscribed: false,
  });

  // Load initial settings and push status
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [loadedSettings, pushState] = await Promise.all([
          StorageService.getAlertSettings(userId),
          getPushSubscriptionState(),
        ]);

        if (mounted) {
          setSettings(loadedSettings);
          setPushStatus(pushState);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load alert settings:', err);
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleToggle = async (key: keyof Omit<UserAlertSettings, 'thresholds'>) => {
    const updated = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(updated);

    try {
      setSaving(true);
      await StorageService.saveAlertSettings(updated, userId);
    } catch (err) {
      console.warn('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = async (time: string) => {
    const updated = {
      ...settings,
      dailyCheckInTime: time,
    };
    setSettings(updated);

    try {
      setSaving(true);
      await StorageService.saveAlertSettings(updated, userId);
    } catch (err) {
      console.warn('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleThreshold = async (val: number) => {
    const current = [...settings.thresholds];
    const exists = current.includes(val);
    const updatedThresholds = exists
      ? current.filter((t) => t !== val)
      : [...current, val].sort((a, b) => a - b);

    const updated = {
      ...settings,
      thresholds: updatedThresholds,
    };
    setSettings(updated);

    try {
      setSaving(true);
      await StorageService.saveAlertSettings(updated, userId);
    } catch (err) {
      console.warn('Failed to save thresholds:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePushNotifications = async () => {
    if (pushStatus.status === 'not_supported' || !pushStatus.supported) {
      alert('Browser push notifications are not supported on this browser or platform.');
      return;
    }

    if (pushStatus.status === 'blocked') {
      alert('Notifications are blocked by your browser settings. Please allow notifications for this site to continue.');
      return;
    }

    setSaving(true);
    setTestSuccessMessage('');

    if (pushStatus.status === 'enabled' || settings.pushNotifications) {
      // Disabling push
      await unregisterPushSubscription(userId);
      const updated = { ...settings, pushNotifications: false };
      setSettings(updated);
      await StorageService.saveAlertSettings(updated, userId);
      const pushState = await getPushSubscriptionState();
      setPushStatus(pushState);
      setTestSuccessMessage('Push notifications disabled.');
    } else {
      // Enabling push
      const regRes = await registerPushSubscription(userId);
      if (regRes.success) {
        const updated = { ...settings, pushNotifications: true };
        setSettings(updated);
        await StorageService.saveAlertSettings(updated, userId);
        const pushState = await getPushSubscriptionState();
        setPushStatus(pushState);
        setTestSuccessMessage('Push notifications enabled successfully!');
      } else {
        alert(regRes.error || 'Failed to enable push notifications');
        const pushState = await getPushSubscriptionState();
        setPushStatus(pushState);
      }
    }

    setSaving(false);
  };

  const handleSendTestAlert = async () => {
    setTesting(true);
    setTestSuccessMessage('');

    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        const data = await res.json();
        // Trigger local toast and bell refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('savemoney-show-toast', {
              detail: {
                message: data.alert?.message || '🔔 Test alert triggered successfully!',
                severity: 'info',
              },
            })
          );
          window.dispatchEvent(new Event('savemoney-alerts-updated'));
        }

        const pushInfo =
          data.pushResult?.sent > 0
            ? ' and sent push notification to your device!'
            : '. (Push notification not sent: enable push below or add VAPID keys).';

        setTestSuccessMessage(`Test alert logged to your history${pushInfo}`);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to send test alert');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to send test alert');
    } finally {
      setTesting(false);
    }
  };

  const renderPushBadge = () => {
    switch (pushStatus.status) {
      case 'checking':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 animate-pulse">
            Checking...
          </span>
        );
      case 'enabled':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Enabled on this device
          </span>
        );
      case 'available':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Not enabled
          </span>
        );
      case 'blocked':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
            Blocked in browser permissions
          </span>
        );
      case 'not_supported':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Not supported by this browser
          </span>
        );
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Alerts & Notifications"
        subtitle="Configure daily spending alarms, monthly budget thresholds, and browser push"
      />

      <div className="space-y-6 text-xs sm:text-sm">
        {/* Alert Types List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {/* 1. Over Today's Limit */}
          <div className="py-3.5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <p className="font-bold text-navy-900 dark:text-white">
                  Over Today&apos;s Limit
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Alert when an expense pushes today&apos;s spending past your calculated safe-to-spend limit.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('overDaily')}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                settings.overDaily ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.overDaily ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 2. Under the Limit */}
          <div className="py-3.5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <p className="font-bold text-navy-900 dark:text-white">
                  Under the Limit (After each expense)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Friendly status update showing remaining daily budget after recording an expense under the limit.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('underDaily')}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                settings.underDaily ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.underDaily ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Monthly Budget Thresholds */}
          <div className="py-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <p className="font-bold text-navy-900 dark:text-white">
                    Monthly Budget Thresholds
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Fires once per month when monthly spending crosses your chosen budget percentage milestones.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggle('budgetThresholds')}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                  settings.budgetThresholds ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.budgetThresholds ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Threshold Selector Chips */}
            {settings.budgetThresholds && (
              <div className="pl-11 flex items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-500">Threshold levels:</span>
                {[50, 80, 100].map((t) => {
                  const isActive = settings.thresholds.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleToggleThreshold(t)}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                        isActive
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-navy-900'
                      }`}
                    >
                      {t}% {isActive && '✓'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Projection Warning */}
          <div className="py-3.5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <TrendingDown className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <p className="font-bold text-navy-900 dark:text-white">
                  Projection Warning
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Warns once per month when current average daily spending pace projects a deficit by month end.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('projectionWarning')}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                settings.projectionWarning ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.projectionWarning ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 5. Savings at Risk */}
          <div className="py-3.5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <p className="font-bold text-navy-900 dark:text-white">
                  Savings at Risk
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  High-priority danger alert if remaining monthly budget drops below what is required to protect your monthly savings target.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('savingsAtRisk')}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                settings.savingsAtRisk ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.savingsAtRisk ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 6. Daily Evening Check-in Prompt */}
          <div className="py-3.5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-primary flex items-center justify-center shrink-0 mt-0.5">
                <CalendarCheck className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="space-y-2">
                <div>
                  <p className="font-bold text-navy-900 dark:text-white">
                    Daily Evening Check-in
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Prompt every evening (&quot;Anything not logged today?&quot;) and confirm zero-spend days to ensure no transactions slipped through.
                  </p>
                </div>

                {settings.dailyCheckInEnabled !== false && (
                  <div className="flex items-center gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-brand-primary" />
                    <span className="font-medium">Notification time:</span>
                    <input
                      type="time"
                      value={settings.dailyCheckInTime || '21:00'}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-navy-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('dailyCheckInEnabled')}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                settings.dailyCheckInEnabled !== false ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.dailyCheckInEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 7. Weekly Balance Reconciliation Reminder */}
          <div className="py-3.5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <Scale className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <p className="font-bold text-navy-900 dark:text-white">
                  Weekly Balance Check Reminder
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Remind weekly if bank accounts or physical cash balances haven&apos;t been reconciled against real bank apps for over 7 days.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('weeklyReconciliationReminder')}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                settings.weeklyReconciliationReminder !== false ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.weeklyReconciliationReminder !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Browser Push Notifications Section */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-brand-primary" />
              <div>
                <p className="font-extrabold text-navy-900 dark:text-white">
                  Browser Push Notifications (PWA)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Receive system alerts even when the app tab is closed
                </p>
              </div>
            </div>

            {/* Status Pill */}
            {renderPushBadge()}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Push notifications only fire for critical warnings and danger events (Over today&apos;s limit, 80%+ monthly budget crossed, and savings at risk).
          </p>

          {/* Blocked instructions banner */}
          {pushStatus.status === 'blocked' && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Notifications are blocked in your browser</p>
                <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-400">
                  To enable alerts, click the lock or site settings icon in your browser address bar (next to the URL), change Notifications to <strong>Allow</strong>, and reload the page.
                </p>
              </div>
            </div>
          )}

          {/* Not supported explanation banner */}
          {pushStatus.status === 'not_supported' && (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 text-slate-500 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Push notifications not supported on this device/browser</p>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {pushStatus.unsupportedReason ||
                    'Web Push requires a browser that supports the Web Push & ServiceWorker APIs over a secure HTTPS connection.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <Button
              type="button"
              variant={pushStatus.status === 'enabled' ? 'outline' : 'primary'}
              size="sm"
              disabled={
                saving ||
                pushStatus.status === 'checking' ||
                pushStatus.status === 'not_supported' ||
                pushStatus.status === 'blocked'
              }
              onClick={handleTogglePushNotifications}
              icon={<Smartphone className="w-3.5 h-3.5" />}
            >
              {pushStatus.status === 'checking'
                ? 'Checking Support...'
                : pushStatus.status === 'enabled'
                ? 'Disable Push Notifications'
                : pushStatus.status === 'blocked'
                ? 'Permission Blocked'
                : pushStatus.status === 'not_supported'
                ? 'Not Supported'
                : 'Enable Push Notifications'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testing}
              onClick={handleSendTestAlert}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              {testing ? 'Sending...' : 'Send Test Alert'}
            </Button>

            <Link href="/settings/alerts" className="sm:ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-slate-500 hover:text-navy-900 dark:hover:text-white"
                icon={<Activity className="w-3.5 h-3.5 text-brand-primary" />}
              >
                Alert Diagnostics & Test Console
              </Button>
            </Link>
          </div>

          {testSuccessMessage && (
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              {testSuccessMessage}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
