'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { AlertItem } from '@/lib/types';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Info,
  AlertTriangle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export function NotificationDropdown() {
  const { user } = useAuth();
  const userId = user?.id;

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const loadAlerts = async () => {
    try {
      const items = await StorageService.getAlerts(userId);
      setAlerts(items);
    } catch (err) {
      console.warn('Failed to load alerts:', err);
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

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAllRead = async () => {
    await StorageService.markAllAlertsAsRead(userId);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('savemoney-alerts-updated'));
    }
  };

  const handleItemClick = async (alert: AlertItem) => {
    if (!alert.is_read) {
      await StorageService.markAlertAsRead(alert.id, userId);
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a)));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-alerts-updated'));
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
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`relative p-2 rounded-xl transition-colors select-none ${
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

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-slate-400 hover:text-brand-primary flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List of Latest 5 Alerts */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Bell className="w-7 h-7 mx-auto mb-2 opacity-30 text-slate-400" />
                No alerts yet. You&apos;ll be notified when budget limits are approached.
              </div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
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
                    <p
                      className={`text-xs leading-relaxed ${
                        !alert.is_read
                          ? 'font-bold text-navy-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-300 font-medium'
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
