'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { exportExpensesToCSV, exportAllDataToJSON } from '@/lib/exportUtils';
import { SupabaseSetupModal } from '@/components/common/SupabaseSetupModal';
import { CategoryManagement } from '@/components/settings/CategoryManagement';
import { AlertSettingsCard } from '@/components/settings/AlertSettingsCard';
import { CaptureHealthCard } from '@/components/settings/CaptureHealthCard';
import { VoiceSettingsCard } from '@/components/settings/VoiceSettingsCard';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Database,
  Moon,
  Sun,
  Laptop,
  Trash2,
  Sparkles,
  IndianRupee,
  LogOut,
  Mail,
  Download,
  FileSpreadsheet,
  Check,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, isConfigured, isDemoMode, signOut } = useAuth();
  const userId = user?.id;

  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<'system' | 'light' | 'dark'>('system');
  const [exportingJSON, setExportingJSON] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');

  // Load theme preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setThemePreference(savedTheme);
      } else {
        setThemePreference('system');
      }

      const handleThemeChange = () => {
        const theme = localStorage.getItem('theme');
        if (theme === 'dark' || theme === 'light') {
          setThemePreference(theme);
        } else {
          setThemePreference('system');
        }
      };
      window.addEventListener('savemoney-theme-changed', handleThemeChange);
      return () => window.removeEventListener('savemoney-theme-changed', handleThemeChange);
    }
  }, []);

  const handleSetTheme = (theme: 'system' | 'light' | 'dark') => {
    setThemePreference(theme);
    if (theme === 'system') {
      localStorage.removeItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else if (theme === 'dark') {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      localStorage.setItem('theme', 'light');
      document.documentElement.classList.remove('dark');
    }
    window.dispatchEvent(new Event('savemoney-theme-changed'));
  };

  const handleExportCSV = async () => {
    setExportingCSV(true);
    setExportSuccess('');
    try {
      const [allExpenses, accounts] = await Promise.all([
        StorageService.getAllExpenses(userId),
        StorageService.getAccounts(userId),
      ]);
      const res = exportExpensesToCSV({ expenses: allExpenses, accounts });
      setExportSuccess(`Exported ${res.count} transactions to CSV.`);
      setTimeout(() => setExportSuccess(''), 4000);
    } catch {
      alert('Failed to export CSV');
    } finally {
      setExportingCSV(false);
    }
  };

  const handleExportJSON = async () => {
    setExportingJSON(true);
    setExportSuccess('');
    try {
      await exportAllDataToJSON(userId);
      setExportSuccess('Full JSON backup downloaded successfully.');
      setTimeout(() => setExportSuccess(''), 4000);
    } catch {
      alert('Failed to export JSON backup');
    } finally {
      setExportingJSON(false);
    }
  };

  const handleClearCache = () => {
    if (confirm('Clear local app cache and reload? Your Supabase database is safe.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your account, database sync, backups, and appearance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Details Card */}
        <Card>
          <CardHeader
            title="User Account"
            subtitle="Personal single-user credentials"
          />

          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div className="w-10 h-10 rounded-full bg-brand-primary text-white font-black text-sm flex items-center justify-center">
                {profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="truncate">
                <p className="font-bold text-sm text-navy-900 dark:text-white truncate">
                  {user ? (profile?.full_name || user?.user_metadata?.full_name || user.email?.split('@')[0] || 'My Account') : 'Not Signed In'}
                </p>
                <p className="text-slate-400 truncate flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3" />
                  {user?.email || 'Guest / Local Session'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Currency</span>
              <span className="font-bold text-navy-900 dark:text-slate-100 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-brand-primary" /> Indian Rupee (₹ INR)
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-rose-600 hover:text-rose-700 hover:border-rose-300"
              icon={<LogOut className="w-3.5 h-3.5" />}
              onClick={() => signOut()}
            >
              Sign Out
            </Button>
          </div>
        </Card>

        {/* Appearance / Theme Settings */}
        <Card>
          <CardHeader
            title="Appearance & Theme"
            subtitle="Dark mode with high contrast and brand orange accent"
          />

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => handleSetTheme('system')}
                className={`py-2 px-3 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
                  themePreference === 'system'
                    ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-sm'
                    : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span className="text-[11px]">System</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetTheme('light')}
                className={`py-2 px-3 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
                  themePreference === 'light'
                    ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-sm'
                    : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span className="text-[11px]">Light</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetTheme('dark')}
                className={`py-2 px-3 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
                  themePreference === 'dark'
                    ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-sm'
                    : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span className="text-[11px]">Dark</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              System setting automatically aligns SaveMoney with your OS preferences (light during day, dark at night).
            </p>
          </div>
        </Card>

        {/* Data Export & Backup Card */}
        <Card>
          <CardHeader
            title="Data Export & Backup"
            subtitle="Download your expenses and complete offline data"
          />

          <div className="space-y-3 text-xs">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
              loading={exportingCSV}
              onClick={handleExportCSV}
            >
              Export All Expenses to CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              icon={<Download className="w-4 h-4 text-blue-600" />}
              loading={exportingJSON}
              onClick={handleExportJSON}
            >
              Download All My Data (JSON)
            </Button>

            {exportSuccess && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-1">
                <Check className="w-3.5 h-3.5" />
                <span>{exportSuccess}</span>
              </p>
            )}
          </div>
        </Card>

        {/* Supabase Database Connection Card */}
        <Card>
          <CardHeader
            title="Supabase Database"
            subtitle="PostgreSQL + Row-Level Security"
          />

          <div className="space-y-4 text-xs">
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isConfigured
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {isConfigured ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Database className="w-5 h-5 text-amber-600" />
                )}
                <div>
                  <p className="font-bold">
                    {isConfigured ? 'Connected to Supabase' : 'Offline / Demo Mode'}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {isConfigured ? 'Row Level Security active' : 'Data kept in browser localStorage'}
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              className="w-full"
              icon={<Database className="w-3.5 h-3.5" />}
              onClick={() => setSetupModalOpen(true)}
            >
              {isConfigured ? 'View Supabase Info' : 'Connect Supabase'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-slate-500 hover:text-rose-600 hover:border-rose-300"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleClearCache}
            >
              Reset Local Storage & Cache
            </Button>
          </div>
        </Card>
      </div>

      {/* Voice & Speech Entry Settings */}
      <VoiceSettingsCard />

      {/* Category Management */}
      <CategoryManagement />

      {/* Capture Health & Phone Automation */}
      <CaptureHealthCard userId={userId} />

      {/* Alerts & Notifications Settings */}
      <AlertSettingsCard />

      <SupabaseSetupModal
        isOpen={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
      />
    </div>
  );
}
