'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';
import { AlertItem } from '@/lib/types';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Info,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

export function NotificationDropdown() {
  const { user } = useAuth();
  const userId = user?.id;

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const loadAlerts = useCallback(async () => {
    try {
      const items = await StorageService.getAlerts(userId);
      setAlerts(items);
    } catch (err) {
      console.warn('Failed to load alerts in bell:', err);
    }
  }, [userId]);

  // Initial load + window event listeners
  useEffect(() => {
    loadAlerts();

    const handleUpdate = () => {
      loadAlerts();
    };

    const handleFocus = () => {
      loadAlerts();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAlerts();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-alerts-updated', handleUpdate);
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        window.removeEventListener('savemoney-alerts-updated', handleUpdate);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [loadAlerts]);

  // Supabase Realtime subscription on alerts table
  useEffect(() => {
    if (!userId) return;

    try {
      const channel = supabase
        .channel(`alerts-bell-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'alerts',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            loadAlerts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Realtime subscription not available for bell:', err);
    }
  }, [userId, loadAlerts]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // When opening dropdown, automatically mark unread alerts as read
  const handleToggle = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState && unreadCount > 0) {
      // Optimistically mark all visible as read
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      try {
        await StorageService.markAllAlertsAsRead(userId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('savemoney-alerts-updated'));
        }
      } catch (e) {
        console.warn('Failed to auto-mark alerts read on open:', e);
      }
    }
  };

  const handleMarkAllRead = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    try {
      await StorageService.markAllAlertsAsRead(userId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-alerts-updated'));
      }
    } catch (e) {
      console.warn('Failed to mark alerts read:', e);
    }
  };

  const handleItemClick = async (alert: AlertItem) => {
    if (!alert.is_read) {
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a)));
      try {
        await StorageService.markAlertAsRead(alert.id, userId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('savemoney-alerts-updated'));
        }
      } catch (e) {
        console.warn('Failed to mark single alert read:', e);
      }
    }
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'danger') {
      return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
    }
    if (severity === 'warning') {
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
    }
    return <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`relative p-1.5 sm:p-2 rounded-xl transition-colors select-none shrink-0 ${
          isOpen
            ? 'bg-slate-100 text-brand-primary dark:bg-slate-800'
            : 'text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
        title="Alerts & Notifications"
        aria-label="Alerts"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-navy-900 dark:text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-light text-brand-primary dark:bg-brand-primary/20">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/settings/alerts"
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-semibold text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors"
                title="Alert diagnostics and settings"
              >
                Diagnostics
              </Link>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-bold text-slate-400 hover:text-brand-primary flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark read
                </button>
              )}
            </div>
          </div>

          {/* List of Latest 10 Alerts */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Bell className="w-7 h-7 mx-auto mb-2 opacity-30 text-slate-400" />
                No alerts yet. You&apos;ll be notified when budget limits are approached.
              </div>
            ) : (
              alerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => handleItemClick(alert)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                    !alert.is_read
                      ? 'bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    {alert.title && (
                      <p className="text-xs font-black text-navy-900 dark:text-white mb-0.5">
                        {alert.title}
                      </p>
                    )}
                    <p
                      className={`text-xs leading-relaxed ${
                        !alert.is_read
                          ? 'font-medium text-navy-900 dark:text-slate-100'
                          : 'text-slate-600 dark:text-slate-400 font-normal'
                      }`}
                    >
                      {alert.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {formatTimeAgo(alert.created_at)}
                    </span>
                  </div>
                  {!alert.is_read && (
                    <span className="w-2 h-2 rounded-full bg-brand-primary shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              href="/alerts"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-brand-primary hover:underline inline-flex items-center gap-1"
            >
              View all alerts in history <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
