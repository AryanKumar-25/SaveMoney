'use client';

import React from 'react';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import { Plus } from 'lucide-react';

export function FloatingAddExpenseButton() {
  const { openQuickAdd } = useExpenseModal();

  return (
    <button
      type="button"
      onClick={() => openQuickAdd()}
      className="md:hidden fixed bottom-18 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-brand-600 via-brand-primary to-amber-400 text-white flex items-center justify-center shadow-lg hover:shadow-glow shadow-brand-500/40 active:scale-95 transition-all select-none"
      aria-label="Add new expense"
    >
      <Plus className="w-7 h-7 stroke-[2.5]" />
    </button>
  );
}
