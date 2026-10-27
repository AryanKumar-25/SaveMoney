'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Moon, Sun, ShieldCheck, Database, Menu, Plus, Mic } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import { NotificationDropdown } from '@/components/layout/NotificationDropdown';
import Link from 'next/link';

interface TopBarProps {
  onToggleMobileMenu?: () => void;
  onOpenSupabaseModal?: () => void;
}

export function TopBar({ onToggleMobileMenu, onOpenSupabaseModal }: TopBarProps) {
  const router = useRouter();
  const { user, profile, isConfigured, isDemoMode } = useAuth();
  const { openQuickAdd, openVoiceAdd } = useExpenseModal();
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Check initial dark mode preference and respect system setting by default
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
      
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Listen for system theme changes if no manual preference is saved
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (!localStorage.getItem('theme')) {
          setDarkMode(e.matches);
          if (e.matches) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);

      const handleCustomThemeChange = () => {
        const theme = localStorage.getItem('theme');
        const dark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setDarkMode(dark);
      };
      window.addEventListener('savemoney-theme-changed', handleCustomThemeChange);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
        window.removeEventListener('savemoney-theme-changed', handleCustomThemeChange);
      };
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new Event('savemoney-theme-changed'));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/expenses?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const displayName = user
    ? profile?.full_name || user?.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    : 'Sign In';
  const roleLabel = user ? user.email : 'Click to Log In';

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-3 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
      {/* Mobile Menu trigger & Search Bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-md">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <form onSubmit={handleSearchSubmit} className="relative w-full hidden sm:block">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search expenses, notes, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs sm:text-sm font-medium rounded-xl pl-9 pr-4 py-2 text-navy-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
        </form>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        {/* Quick Add Expense Desktop Button */}
        <button
          type="button"
          onClick={() => openQuickAdd()}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-600 text-white text-xs font-bold shadow-sm shadow-brand-500/20 active:scale-95 transition-all select-none"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add Expense</span>
        </button>

        {/* Voice Expense Desktop Button */}
        <button
          type="button"
          onClick={() => openVoiceAdd()}
          className="hidden sm:inline-flex items-center justify-center p-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 active:scale-95 transition-all"
          title="Voice Expense Entry"
          aria-label="Voice Expense Entry"
        >
          <Mic className="w-4 h-4 stroke-[2.2]" />
        </button>

        {/* Supabase Status Pill */}
        <button
          type="button"
          onClick={onOpenSupabaseModal}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-full text-xs font-semibold border transition-all shrink-0 ${
            isConfigured
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
          }`}
          title={isConfigured ? 'Connected to Supabase' : 'Offline / Demo Mode'}
          aria-label="Database connection status"
        >
          {isConfigured ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">Supabase Connected</span>
            </>
          ) : (
            <>
              <Database className="w-3.5 h-3.5 text-amber-600 animate-pulse shrink-0" />
              <span className="hidden sm:inline">Supabase Setup</span>
            </>
          )}
        </button>

        {/* Notifications */}
        <NotificationDropdown />

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleDarkMode}
          className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? (
            <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        {/* User Avatar + Name */}
        <Link
          href={user ? '/settings' : '/login'}
          className="flex items-center gap-2 pl-1.5 sm:pl-2.5 border-l border-slate-200 dark:border-slate-800 hover:opacity-80 transition-opacity shrink-0"
          title={displayName}
          aria-label="Account Settings"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-brand-primary to-amber-400 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-sm shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-navy-900 dark:text-white leading-tight">
              {displayName}
            </p>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              {roleLabel}
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
