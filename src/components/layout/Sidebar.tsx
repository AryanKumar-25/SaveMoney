'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StorageService } from '@/lib/storage';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Bell,
  BarChart3,
  CreditCard,
  Settings,
  Wallet,
  ChevronRight,
  LogOut,
  Sparkles,
  Coins,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Budget', href: '/budget', icon: PiggyBank },
  { name: 'Extra Money', href: '/extra-money', icon: Coins },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Accounts', href: '/accounts', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  onNavigate?: () => void;
  isMobileDrawer?: boolean;
}

export function Sidebar({ onNavigate, isMobileDrawer = false }: SidebarProps) {
  const pathname = usePathname();
  const { isDemoMode, user, profile, signOut } = useAuth();
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);

  useEffect(() => {
    async function check() {
      try {
        const alerts = await StorageService.getAlerts(user?.id);
        setUnreadAlerts(alerts.filter((a) => !a.is_read).length);
      } catch {}
    }
    check();
    const handleUpdate = () => check();
    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-alerts-updated', handleUpdate);
      return () => window.removeEventListener('savemoney-alerts-updated', handleUpdate);
    }
  }, [user?.id]);

  const accountName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'My Account';

  const containerClasses = isMobileDrawer
    ? 'flex flex-col w-full h-full p-4 select-none'
    : 'hidden md:flex flex-col w-64 h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-5 shrink-0 z-30 select-none';

  return (
    <aside className={containerClasses}>
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-2 py-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-primary to-brand-300 flex items-center justify-center text-white shadow-glow">
          <Wallet className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-lg tracking-tight text-navy-900 dark:text-white">
              SaveMoney
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-950/60 text-brand-primary border border-brand-200/50">
              ₹ INR
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Smart Indian Spending</p>
        </div>
      </div>

      {/* Demo Mode Badge */}
      {isDemoMode && (
        <div className="mb-4 mx-1 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="leading-tight">
            <span className="font-semibold block">Demo / Local Mode</span>
            <span className="text-[10px] opacity-80">Sync with Supabase in Settings</span>
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-2">
          Menu
        </div>
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group ${
                isActive
                  ? 'bg-brand-primary text-white shadow-glow'
                  : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-primary'
                  }`}
                />
                <span>{item.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {(item.href === '/alerts' && unreadAlerts > 0 ? (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      isActive
                        ? 'bg-white text-brand-primary'
                        : 'bg-rose-500 text-white animate-pulse'
                    }`}
                  >
                    {unreadAlerts > 9 ? '9+' : unreadAlerts}
                  </span>
                ) : item.badge ? (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null)}
                <ChevronRight
                  className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                    isActive ? 'opacity-100 text-white/80' : 'text-slate-300'
                  }`}
                />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer / Account Info */}
      <div className="pt-4 mt-auto border-t border-slate-100 dark:border-slate-800">
        {user ? (
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                {accountName.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-navy-900 dark:text-slate-100 truncate">
                  {accountName}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                signOut();
              }}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            onClick={() => onNavigate?.()}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-brand-primary hover:bg-brand-600 text-white text-xs font-bold shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sign In to SaveMoney</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
