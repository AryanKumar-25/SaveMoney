'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { parseTransactionSMS, ParsedSMSResult } from '@/lib/smsParser';
import { Category, Expense, Account } from '@/lib/types';
import { matchAccountFromSMS } from '@/lib/accountCalculations';
import Link from 'next/link';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatINR } from '@/lib/formatters';
import { triggerAlertEvaluation } from '@/lib/alertClient';
import {
  X,
  Sparkles,
  Check,
  Receipt,
  MoreHorizontal,
  Calendar,
  AlertCircle,
  Tag,
  Clock,
  ArrowRight,
  CreditCard,
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';

const AMOUNT_PRESETS = [50, 100, 200, 500, 1000, 2000];

export function QuickAddExpenseModal({ onSaved }: { onSaved?: () => void }) {
  const { isOpen, closeModal, expenseToEdit, initialData } = useExpenseModal();
  const { user } = useAuth();
  const userId = user?.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('');
  
  // SMS Parser state
  const [showSmsBox, setShowSmsBox] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [smsFeedback, setSmsFeedback] = useState<ParsedSMSResult | null>(null);
  const [matchedAccountName, setMatchedAccountName] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showFutureDateConfirm, setShowFutureDateConfirm] = useState(false);
  const [confirmedFutureDate, setConfirmedFutureDate] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Load categories and listen to updates
  useEffect(() => {
    const fetchCats = () => {
      StorageService.getCategories(userId).then((cats) => {
        const { unique } = StorageService.deduplicateCategories(cats);
        setCategories(unique);
        if (unique.length > 0 && !unique.some((c) => c.name.toLowerCase() === category.toLowerCase())) {
          setCategory(unique[0].name);
        }
      });
    };
    fetchCats();

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-categories-updated', fetchCats);
      return () => {
        window.removeEventListener('savemoney-categories-updated', fetchCats);
      };
    }
  }, [userId]);

  // Load accounts and listen to updates
  useEffect(() => {
    const fetchAccs = () => {
      StorageService.getAccounts(userId).then((accs) => {
        setAccounts(accs);
      });
    };
    fetchAccs();

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-accounts-updated', fetchAccs);
      return () => {
        window.removeEventListener('savemoney-accounts-updated', fetchAccs);
      };
    }
  }, [userId]);

  // Format local datetime for input (YYYY-MM-DDTHH:mm)
  const getLocalDatetimeString = (dateObj: Date = new Date()) => {
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  // Initialize or reset form fields
  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setSmsText('');
      setSmsFeedback(null);
      setMatchedAccountName(null);
      setShowFutureDateConfirm(false);
      setConfirmedFutureDate(false);

      if (expenseToEdit) {
        setAmount(String(expenseToEdit.amount));
        setCategory(expenseToEdit.category);
        setNote(expenseToEdit.note || '');
        setMerchant(expenseToEdit.merchant || '');
        setDate(getLocalDatetimeString(new Date(expenseToEdit.date)));
        setSelectedAccountId(expenseToEdit.account_id || '');
        setShowSmsBox(false);
      } else {
        setAmount(initialData?.amount ? String(initialData.amount) : '');
        setCategory(initialData?.category || 'Food');
        setNote(initialData?.note || '');
        setMerchant(initialData?.merchant || '');
        setDate(getLocalDatetimeString(initialData?.date ? new Date(initialData.date) : new Date()));
        
        // Remember last used account
        const lastUsed = typeof window !== 'undefined' ? localStorage.getItem('savemoney_last_account_id') : null;
        setSelectedAccountId(lastUsed || (accounts[0]?.id ?? ''));
        setShowSmsBox(false);
      }

      // Auto-focus amount for under 5-second entry
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, expenseToEdit, initialData, accounts]);

  if (!isOpen) return null;

  // Handle SMS Parsing
  const handleParseSMS = (text: string) => {
    setSmsText(text);
    setMatchedAccountName(null);
    if (!text.trim()) {
      setSmsFeedback(null);
      return;
    }

    const result = parseTransactionSMS(text);
    setSmsFeedback(result);

    if (result.success && result.amount) {
      setAmount(String(result.amount));
      if (result.merchant) {
        setMerchant(result.merchant);
        if (!note) setNote(result.merchant);
      }
      if (result.suggestedCategory) {
        setCategory(result.suggestedCategory);
      }
      if (result.date) {
        setDate(getLocalDatetimeString(new Date(result.date)));
      }

      // Pre-select account if matched by digits or bank name
      const matched = matchAccountFromSMS(text, accounts);
      if (matched) {
        setSelectedAccountId(matched.id);
        setMatchedAccountName(matched.nickname);
      }

      setFormError('');
    }
  };

  const handleQuickAmount = (val: number) => {
    const current = parseFloat(amount) || 0;
    setAmount(String(current + val));
  };

  const handleSubmit = async (e?: React.FormEvent, bypassFutureCheck: boolean = false) => {
    if (e) e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Amount must be greater than ₹0');
      return;
    }

    if (!category.trim()) {
      setFormError('Please select a category');
      return;
    }

    // Check future date
    const expenseTime = date ? new Date(date).getTime() : Date.now();
    const now = Date.now();
    const isFuture = expenseTime > now + 60 * 1000;

    if (isFuture && !bypassFutureCheck && !confirmedFutureDate) {
      setShowFutureDateConfirm(true);
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const isoDate = date ? new Date(date).toISOString() : new Date().toISOString();

      if (selectedAccountId && typeof window !== 'undefined') {
        localStorage.setItem('savemoney_last_account_id', selectedAccountId);
      }

      if (expenseToEdit) {
        await StorageService.updateExpense(
          {
            ...expenseToEdit,
            account_id: selectedAccountId || null,
            amount: numAmount,
            category,
            note: note.trim() || undefined,
            merchant: merchant.trim() || undefined,
            date: isoDate,
          },
          userId
        );
      } else {
        await StorageService.addExpense(
          {
            account_id: selectedAccountId || null,
            amount: numAmount,
            category,
            note: note.trim() || undefined,
            merchant: merchant.trim() || undefined,
            date: isoDate,
          },
          userId
        );
      }

      // Evaluate alerts server-side and trigger immediate toast & bell update
      const expenseMonth = isoDate.slice(0, 7);
      await triggerAlertEvaluation({
        userId,
        month: expenseMonth,
        lastExpense: {
          amount: numAmount,
          merchant: merchant.trim() || undefined,
          category,
          note: note.trim() || undefined,
          date: isoDate,
        },
        showToasts: true,
      });

      closeModal();
      onSaved?.();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fadeIn">
      <Card className="max-w-md w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-primary text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-navy-900 dark:text-white tracking-tight">
                {expenseToEdit ? 'Edit Expense' : 'Quick Add Expense'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {expenseToEdit ? 'Update expense details' : 'Record spending in under 5 seconds'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toggle Paste SMS Bar */}
        {!expenseToEdit && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowSmsBox(!showSmsBox)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-brand-50/70 hover:bg-brand-50 dark:bg-brand-950/30 text-brand-primary text-xs font-bold transition-all border border-brand-200/50"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                <span>{showSmsBox ? 'Hide SMS Box' : 'Paste Bank / UPI SMS'}</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-primary/10">
                Auto-Parse
              </span>
            </button>

            {showSmsBox && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Paste SMS from HDFC, SBI, ICICI, Axis, Paytm, PhonePe, GPay:
                </label>
                <textarea
                  rows={2}
                  value={smsText}
                  onChange={(e) => handleParseSMS(e.target.value)}
                  placeholder="e.g. Alert: You have spent Rs.450 on HDFC Card ending 1234 at SWIGGY on 23-OCT-26..."
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
                />

                {/* Parser Feedback */}
                {smsFeedback && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
                      smsFeedback.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {smsFeedback.success ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="text-[11px] leading-relaxed">
                      {smsFeedback.success ? (
                        <>
                          <p className="font-bold">
                            Detected {formatINR(smsFeedback.amount)}{' '}
                            {smsFeedback.merchant && `at ${smsFeedback.merchant}`}
                          </p>
                          <p className="opacity-80">
                            Category auto-assigned to <strong>{smsFeedback.suggestedCategory}</strong>.
                          </p>
                          {matchedAccountName && (
                            <p className="text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">
                              💳 Payment method matched: <strong>{matchedAccountName}</strong>
                            </p>
                          )}
                        </>
                      ) : (
                        <p>{smsFeedback.error || 'Could not detect amount. Please fill details manually.'}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Expense Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Big Amount Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Amount (₹ INR) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-brand-primary pointer-events-none">
                ₹
              </span>
              <input
                ref={amountInputRef}
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy-900 dark:text-white text-2xl sm:text-3xl font-black tracking-tight focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder:text-slate-300"
                required
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {AMOUNT_PRESETS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  +{val}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selector Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Category *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {categories.map((cat) => {
                const isSelected = category === cat.name;

                return (
                  <button
                    key={cat.id || cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all select-none ${
                      isSelected
                        ? 'border-brand-primary bg-brand-50/80 dark:bg-brand-950/50 text-brand-primary shadow-sm ring-1 ring-brand-primary'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center mb-1 shrink-0"
                      style={{
                        backgroundColor: isSelected ? (cat.color || '#F7931A') : cat.color ? `${cat.color}20` : '#F1F5F9',
                        color: isSelected ? '#FFFFFF' : cat.color || '#64748B',
                      }}
                    >
                      <CategoryIcon name={cat.name} icon={cat.icon} className="w-4 h-4" />
                    </div>
                    <span className="truncate w-full text-center text-[11px]">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paid With Account Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Paid With</span>
              </label>
              <Link
                href="/accounts"
                onClick={closeModal}
                className="text-[11px] font-bold text-brand-primary hover:underline"
              >
                + Manage Accounts
              </Link>
            </div>

            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy-900 dark:text-slate-100 text-xs font-bold px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none pr-8 cursor-pointer"
              >
                <option value="">None / Cash Direct</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nickname} {acc.last_4_digits ? `(•••• ${acc.last_4_digits})` : ''} - {acc.type.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Merchant & Optional Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Merchant / Paid To"
              placeholder="e.g. Swiggy, Uber, DMart"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
            <Input
              label="Note (Optional)"
              placeholder="e.g. Dinner with team"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Date & Time Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Date & Time</span>
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy-900 dark:text-slate-100 text-xs font-semibold px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Future Date Confirmation Prompt */}
          {showFutureDateConfirm && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-2.5 animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Future Date Confirmation</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                The selected date ({new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}) is in the future. Are you sure you want to log a transaction ahead of time?
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setConfirmedFutureDate(true);
                    setShowFutureDateConfirm(false);
                    handleSubmit(undefined, true);
                  }}
                >
                  Yes, Confirm Future Date
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDate(getLocalDatetimeString(new Date()));
                    setShowFutureDateConfirm(false);
                  }}
                >
                  Reset to Now
                </Button>
              </div>
            </div>
          )}

          {formError && (
            <p className="text-xs text-rose-500 font-bold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{formError}</span>
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" size="md" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              loading={saving}
              className="flex-1"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {expenseToEdit ? 'Update Expense' : 'Save Expense'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
