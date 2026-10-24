'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StorageService } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { Account, AccountType } from '@/lib/types';
import { validateAccount } from '@/lib/accountCalculations';
import {
  X,
  CreditCard,
  Building2,
  Smartphone,
  Banknote,
  ShieldCheck,
  Sparkles,
  IndianRupee,
  Lock,
} from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountToEdit?: Account | null;
  onSaved?: () => void;
}

const ACCOUNT_TYPES: { type: AccountType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'bank', label: 'Bank Account', icon: <Building2 className="w-4 h-4" />, desc: 'Savings / Current' },
  { type: 'upi', label: 'UPI App', icon: <Smartphone className="w-4 h-4" />, desc: 'GPay, PhonePe, Paytm' },
  { type: 'credit_card', label: 'Credit Card', icon: <CreditCard className="w-4 h-4" />, desc: 'Visa, Mastercard, RuPay' },
  { type: 'debit_card', label: 'Debit Card', icon: <CreditCard className="w-4 h-4" />, desc: 'ATM / Debit Card' },
  { type: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" />, desc: 'Physical cash wallet' },
];

const PRESET_COLORS = [
  '#F7931A', // Brand Orange
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#64748B', // Slate
];

export function AccountModal({ isOpen, onClose, accountToEdit, onSaved }: AccountModalProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const [type, setType] = useState<AccountType>('bank');
  const [nickname, setNickname] = useState('');
  const [bankOrAppName, setBankOrAppName] = useState('');
  const [last4Digits, setLast4Digits] = useState('');
  const [color, setColor] = useState('#F7931A');
  const [creditLimit, setCreditLimit] = useState('');
  const [billingDate, setBillingDate] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (accountToEdit) {
      setType(accountToEdit.type || 'bank');
      setNickname(accountToEdit.nickname || '');
      setBankOrAppName(accountToEdit.bank_or_app_name || '');
      setLast4Digits(accountToEdit.last_4_digits || '');
      setColor(accountToEdit.color || '#F7931A');
      setCreditLimit(accountToEdit.credit_limit ? String(accountToEdit.credit_limit) : '');
      setBillingDate(accountToEdit.billing_date ? String(accountToEdit.billing_date) : '');
      setOpeningBalance(accountToEdit.opening_balance ? String(accountToEdit.opening_balance) : '');
    } else {
      setType('bank');
      setNickname('');
      setBankOrAppName('');
      setLast4Digits('');
      setColor('#F7931A');
      setCreditLimit('');
      setBillingDate('');
      setOpeningBalance('');
    }
    setFormError('');
  }, [accountToEdit, isOpen]);

  if (!isOpen) return null;

  const handleLast4Change = (val: string) => {
    // Only allow numeric digits, max 4
    const cleaned = val.replace(/\D/g, '').slice(0, 4);
    setLast4Digits(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedCreditLimit = creditLimit.trim() ? parseFloat(creditLimit) : undefined;
    const parsedBillingDate = billingDate.trim() ? parseInt(billingDate, 10) : undefined;
    const parsedOpeningBalance = openingBalance.trim() ? parseFloat(openingBalance) : undefined;

    const validation = validateAccount({
      nickname,
      type,
      last_4_digits: last4Digits || undefined,
      credit_limit: parsedCreditLimit,
      billing_date: parsedBillingDate,
      opening_balance: parsedOpeningBalance,
    });

    if (!validation.valid) {
      setFormError(validation.error || 'Please check the form fields.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (accountToEdit) {
        await StorageService.updateAccount(
          {
            ...accountToEdit,
            nickname: nickname.trim(),
            type,
            bank_or_app_name: bankOrAppName.trim() || undefined,
            last_4_digits: last4Digits.trim() || undefined,
            color,
            credit_limit: type === 'credit_card' ? parsedCreditLimit : undefined,
            billing_date: type === 'credit_card' ? parsedBillingDate : undefined,
            opening_balance: type === 'bank' || type === 'cash' ? parsedOpeningBalance : undefined,
          },
          userId
        );
      } else {
        await StorageService.addAccount(
          {
            nickname: nickname.trim(),
            type,
            bank_or_app_name: bankOrAppName.trim() || undefined,
            last_4_digits: last4Digits.trim() || undefined,
            color,
            credit_limit: type === 'credit_card' ? parsedCreditLimit : undefined,
            billing_date: type === 'credit_card' ? parsedBillingDate : undefined,
            opening_balance: type === 'bank' || type === 'cash' ? parsedOpeningBalance : undefined,
          },
          userId
        );
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-accounts-updated'));
      }

      onSaved?.();
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fadeIn">
      <Card className="max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-primary text-white flex items-center justify-center shadow-sm">
              <CreditCard className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-navy-900 dark:text-white tracking-tight">
                {accountToEdit ? 'Edit Payment Account' : 'Add Payment Account'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Track transactions by bank, card, UPI, or cash wallet
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Assurance Banner */}
        <div className="my-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5 leading-relaxed">
          <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong>Strict Zero-Knowledge Security: </strong>
            SaveMoney strictly stores nicknames and the last 4 digits only. Never enter full card numbers, CVV, ATM PINs, net banking passwords, or UPI PINs.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-300">
              {formError}
            </div>
          )}

          {/* Account Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Account Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setType(t.type)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    type === t.type
                      ? 'border-brand-primary bg-brand-50/50 dark:bg-brand-950/40 text-brand-primary ring-1 ring-brand-primary/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    {t.icon}
                    <span>{t.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nickname & Bank Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nickname <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                placeholder={type === 'upi' ? 'e.g. Personal GPay' : type === 'cash' ? 'e.g. Wallet Cash' : 'e.g. HDFC Salary'}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {type === 'upi' ? 'App / UPI Name' : type === 'cash' ? 'Holder / Location' : 'Bank / Issuer Name'}
              </label>
              <Input
                type="text"
                placeholder={type === 'upi' ? 'e.g. Google Pay / Paytm' : 'e.g. HDFC Bank, SBI, ICICI'}
                value={bankOrAppName}
                onChange={(e) => setBankOrAppName(e.target.value)}
              />
            </div>
          </div>

          {/* Last 4 Digits (For Cards & Bank Accounts) */}
          {type !== 'cash' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Last 4 Digits <span className="text-slate-400 font-normal">(Optional, digits only)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                  ••••
                </span>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="8910"
                  value={last4Digits}
                  onChange={(e) => handleLast4Change(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-2 text-sm font-mono tracking-widest text-navy-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Used to automatically match SMS transaction notifications to this account.
              </p>
            </div>
          )}

          {/* Credit Card Specific Fields: Credit Limit & Billing Date */}
          {type === 'credit_card' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Credit Limit (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="1,00,000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-navy-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Billing Date <span className="text-slate-400 font-normal">(1-31)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g. 15"
                  value={billingDate}
                  onChange={(e) => setBillingDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium text-navy-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          )}

          {/* Bank / Cash Specific Fields: Opening Balance */}
          {(type === 'bank' || type === 'cash') && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Opening Balance (₹) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="25,000"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-navy-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Estimated balance is calculated as opening balance minus recorded expenses.
              </p>
            </div>
          )}

          {/* Tile Color Accent */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-brand-primary scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? 'Saving...' : accountToEdit ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
