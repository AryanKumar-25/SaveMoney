'use client';

import React, { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import { Mic, Keyboard } from 'lucide-react';

interface FloatingAddExpenseButtonProps {
  isDrawerOpen?: boolean;
}

export function FloatingAddExpenseButton({ isDrawerOpen = false }: FloatingAddExpenseButtonProps) {
  const pathname = usePathname();
  const { isOpen, isVoiceOpen, openQuickAdd, openVoiceAdd } = useExpenseModal();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // Hide when any modal is open, mobile drawer is open, or on pages where quick-add makes no sense:
  // - /budget: monthly budget setup & fixed expenses form
  // - /import: bank statement CSV upload and mapping form wizard
  // - /settings: application settings & data management
  // - /login: authentication screen
  const hiddenRoutes = ['/budget', '/import', '/settings', '/login'];
  if (isDrawerOpen || isOpen || isVoiceOpen || hiddenRoutes.includes(pathname)) {
    return null;
  }

  const handleTouchStart = () => {
    isLongPressRef.current = false;
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
      openQuickAdd();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      return;
    }
    openVoiceAdd();
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: '16px',
        bottom: 'calc(64px + 16px + env(safe-area-inset-bottom, 0px))',
      }}
      className="md:hidden z-30 flex items-center gap-2 select-none"
    >
      {/* Small manual keyboard entry button */}
      <button
        type="button"
        onClick={() => openQuickAdd()}
        className="w-10 h-10 rounded-full bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-label="Add expense manually"
        title="Manual expense entry"
      >
        <Keyboard className="w-5 h-5 stroke-[2]" />
      </button>

      {/* Main voice microphone button with long-press support */}
      <button
        type="button"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand-600 via-brand-primary to-amber-400 text-white flex items-center justify-center shadow-xl hover:shadow-glow shadow-brand-500/40 active:scale-95 transition-all select-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        aria-label="Add expense with voice (or long press for manual)"
        title="Tap to speak, or hold for manual entry"
      >
        <Mic className="w-7 h-7 stroke-[2.2]" />
      </button>
    </div>
  );
}
