'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import { Plus } from 'lucide-react';

interface FloatingAddExpenseButtonProps {
  isDrawerOpen?: boolean;
}

export function FloatingAddExpenseButton({ isDrawerOpen = false }: FloatingAddExpenseButtonProps) {
  const pathname = usePathname();
  const { isOpen, openQuickAdd } = useExpenseModal();

  // Hide when any modal is open, mobile drawer is open, or on pages where quick-add makes no sense:
  // - /budget: monthly budget setup & fixed expenses form
  // - /import: bank statement CSV upload and mapping form wizard
  // - /settings: application settings & data management
  // - /login: authentication screen
  const hiddenRoutes = ['/budget', '/import', '/settings', '/login'];
  if (isDrawerOpen || isOpen || hiddenRoutes.includes(pathname)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => openQuickAdd()}
      style={{
        position: 'fixed',
        right: '16px',
        bottom: 'calc(64px + 16px + env(safe-area-inset-bottom, 0px))',
      }}
      className="md:hidden z-30 w-14 h-14 rounded-full bg-gradient-to-tr from-brand-600 via-brand-primary to-amber-400 text-white flex items-center justify-center shadow-xl hover:shadow-glow shadow-brand-500/40 active:scale-95 transition-all select-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      aria-label="Add new expense"
    >
      <Plus className="w-7 h-7 stroke-[2.5]" />
    </button>
  );
}
