'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StorageService } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Bell,
  Settings,
} from 'lucide-react';

const mobileTabs = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Budget', href: '/budget', icon: PiggyBank },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function check() {
      try {
        const alerts = await StorageService.getAlerts(user?.id);
        setUnreadCount(alerts.filter((a) => !a.is_read).length);
      } catch {}
    }
    check();
    const handleUpdate = () => check();
    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-alerts-updated', handleUpdate);
      return () => window.removeEventListener('savemoney-alerts-updated', handleUpdate);
    }
  }, [user?.id]);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 px-3 py-2 flex items-center justify-around safe-area-bottom">
      {mobileTabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-150 ${
              isActive
                ? 'text-brand-primary'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <div
              className={`relative p-1.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 shadow-sm text-brand-primary'
                  : ''
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2.2]" />
              {tab.name === 'Alerts' && unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-1 ring-white dark:ring-slate-900" />
              )}
            </div>
            <span
              className={`text-[10px] font-bold tracking-tight ${
                isActive ? 'text-brand-primary' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
