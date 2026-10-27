'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Expense } from '@/lib/types';

interface ExpenseModalContextType {
  isOpen: boolean;
  expenseToEdit: Expense | null;
  openQuickAdd: (initialData?: Partial<Expense>) => void;
  openEditExpense: (expense: Expense) => void;
  closeModal: () => void;
  initialData?: Partial<Expense> | null;
  onSuccessCallback?: () => void;
  setOnSuccessCallback: (cb: () => void) => void;
  isVoiceOpen: boolean;
  openVoiceAdd: () => void;
  closeVoiceModal: () => void;
}

const ExpenseModalContext = createContext<ExpenseModalContextType | undefined>(undefined);

export function ExpenseModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [initialData, setInitialData] = useState<Partial<Expense> | null>(null);
  const [onSuccess, setOnSuccess] = useState<(() => void) | undefined>(undefined);

  const openQuickAdd = useCallback((data?: Partial<Expense>) => {
    setIsVoiceOpen(false);
    setExpenseToEdit(null);
    setInitialData(data || null);
    setIsOpen(true);
  }, []);

  const openVoiceAdd = useCallback(() => {
    setIsOpen(false);
    setIsVoiceOpen(true);
  }, []);

  const closeVoiceModal = useCallback(() => {
    setIsVoiceOpen(false);
  }, []);

  const openEditExpense = useCallback((expense: Expense) => {
    setIsVoiceOpen(false);
    setExpenseToEdit(expense);
    setInitialData(null);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setExpenseToEdit(null);
    setInitialData(null);
  }, []);

  return (
    <ExpenseModalContext.Provider
      value={{
        isOpen,
        expenseToEdit,
        openQuickAdd,
        openEditExpense,
        closeModal,
        initialData,
        onSuccessCallback: onSuccess,
        setOnSuccessCallback: setOnSuccess,
        isVoiceOpen,
        openVoiceAdd,
        closeVoiceModal,
      }}
    >
      {children}
    </ExpenseModalContext.Provider>
  );
}

export function useExpenseModal() {
  const context = useContext(ExpenseModalContext);
  if (!context) {
    throw new Error('useExpenseModal must be used within an ExpenseModalProvider');
  }
  return context;
}
