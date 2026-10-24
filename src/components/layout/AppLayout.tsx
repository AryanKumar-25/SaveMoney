'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { SupabaseSetupModal } from '../common/SupabaseSetupModal';
import { MonthRolloverModal } from '../common/MonthRolloverModal';
import { ExpenseModalProvider } from '@/context/ExpenseModalContext';
import { ToastProvider } from '@/context/ToastContext';
import { QuickAddExpenseModal } from '../expense/QuickAddExpenseModal';
import { FloatingAddExpenseButton } from '../expense/FloatingAddExpenseButton';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle } from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
  const { isConfigured, isDemoMode, user } = useAuth();

  // Render standalone login page without dashboard navigation shell
  if (pathname === '/login') {
    return <>{children}</>;
  }

  const handleExpenseSaved = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('savemoney-expense-updated'));
    }
  };

  return (
    <ToastProvider>
      <ExpenseModalProvider>
        <div className="min-h-screen flex bg-surface-bg dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans antialiased">
          {/* Desktop Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
            <TopBar
              onToggleMobileMenu={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              onOpenSupabaseModal={() => setSupabaseModalOpen(true)}
            />

            {/* Global Demo/Setup Alert Banner if Supabase not configured */}
            {!isConfigured && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Running in Instant Demo Mode:</strong> Data is stored safely in your browser. Connect Supabase anytime to sync across devices.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSupabaseModalOpen(true)}
                  className="underline font-bold hover:text-amber-900 dark:hover:text-amber-200 shrink-0 ml-2"
                >
                  Setup Supabase &rarr;
                </button>
              </div>
            )}

            {/* Banner if Supabase is connected but user has not logged in yet */}
            {isConfigured && !user && !isDemoMode && (
              <div className="bg-brand-50/80 dark:bg-brand-950/40 border-b border-brand-200/60 dark:border-brand-900/60 px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs text-brand-900 dark:text-brand-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>
                    <strong>Not signed in:</strong> Log in with your Supabase email to sync your real budget and see your real account name.
                  </span>
                </div>
                <Link
                  href="/login"
                  className="underline font-bold text-brand-primary hover:text-brand-600 shrink-0 ml-2"
                >
                  Sign In with Email &rarr;
                </Link>
              </div>
            )}

            <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>

          {/* Mobile Drawer (if expanded) */}
          {mobileDrawerOpen && (
            <div
              className="fixed inset-0 z-50 bg-navy-900/50 md:hidden backdrop-blur-xs flex"
              onClick={() => setMobileDrawerOpen(false)}
            >
              <div
                className="w-72 bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-extrabold text-navy-900 dark:text-white">SaveMoney Menu</span>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <Sidebar
                    isMobileDrawer
                    onNavigate={() => setMobileDrawerOpen(false)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Month Rollover Prompt Modal */}
          <MonthRolloverModal />

          {/* Floating Add Expense Button on Mobile */}
          <FloatingAddExpenseButton />

          {/* Quick Add / Edit Expense Modal */}
          <QuickAddExpenseModal onSaved={handleExpenseSaved} />

          {/* Mobile Bottom Navigation */}
          <MobileNav />

          {/* Supabase Configuration Modal */}
          <SupabaseSetupModal
            isOpen={supabaseModalOpen}
            onClose={() => setSupabaseModalOpen(false)}
          />
        </div>
      </ExpenseModalProvider>
    </ToastProvider>
  );
}
