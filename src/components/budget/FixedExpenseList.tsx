'use client';

import React, { useState } from 'react';
import { FixedExpense } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Home,
  CreditCard,
  Tv,
  FileText,
  Shield,
  MoreHorizontal,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  Circle,
  X,
  Edit2,
} from 'lucide-react';

interface FixedExpenseListProps {
  expenses: FixedExpense[];
  onAdd: (expense: Omit<FixedExpense, 'id' | 'month'>) => Promise<unknown>;
  onEdit?: (expense: FixedExpense) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  saving?: boolean;
}

const CATEGORIES: { label: FixedExpense['category']; icon: React.ReactNode; color: string }[] = [
  { label: 'Rent', icon: <Home className="w-4 h-4" />, color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' },
  { label: 'EMI', icon: <CreditCard className="w-4 h-4" />, color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' },
  { label: 'Subscription', icon: <Tv className="w-4 h-4" />, color: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' },
  { label: 'Bills', icon: <FileText className="w-4 h-4" />, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
  { label: 'Insurance', icon: <Shield className="w-4 h-4" />, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
  { label: 'Other', icon: <MoreHorizontal className="w-4 h-4" />, color: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
];

export function FixedExpenseList({
  expenses,
  onAdd,
  onDelete,
  saving = false,
}: FixedExpenseListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<FixedExpense['category']>('Rent');
  const [dueDay, setDueDay] = useState('');
  const [formError, setFormError] = useState('');

  const totalFixed = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a description (e.g. House Rent, Netflix)');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Amount must be greater than ₹0');
      return;
    }

    if (dueDay) {
      const parsedDay = parseInt(dueDay, 10);
      if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
        setFormError('Due day must be between 1 and 31');
        return;
      }
    }

    try {
      await onAdd({
        title: title.trim(),
        amount: numAmount,
        category,
        due_day: dueDay ? parseInt(dueDay, 10) : undefined,
        is_paid: false,
      });

      // Reset form
      setTitle('');
      setAmount('');
      setDueDay('');
      setFormError('');
      setShowAddForm(false);
    } catch {
      setFormError('Failed to add fixed expense. Please try again.');
    }
  };

  const getCategoryMeta = (cat: string) => {
    return CATEGORIES.find((c) => c.label === cat) || CATEGORIES[5];
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span>Fixed Monthly Expenses</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {expenses.length} items
            </span>
          </div>
        }
        subtitle="Rent, EMIs, Subscriptions & Bills you pay every month"
        action={
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-navy-900 dark:text-white">
              Total: {formatINR(totalFixed)}
            </span>
            {!showAddForm && (
              <Button
                size="sm"
                variant="primary"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setShowAddForm(true)}
              >
                Add Bill
              </Button>
            )}
          </div>
        }
      />

      {/* Add Fixed Expense Inline Form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 p-4 rounded-xl bg-brand-50/40 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-900/40 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Add New Fixed Commitment
            </h4>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormError('');
              }}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Title / Name"
              placeholder="e.g. 2BHK Rent, Netflix, HDFC Car EMI"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Input
              label="Amount (₹ INR)"
              type="number"
              placeholder="e.g. 25000"
              prefix="₹"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FixedExpense['category'])}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy-900 dark:text-slate-100 text-sm font-medium py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.label} value={cat.label}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Due Day of Month (Optional)"
              type="number"
              min="1"
              max="31"
              placeholder="e.g. 5 for 5th of every month"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </div>

          {formError && <p className="text-xs text-red-500 font-semibold">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              Save Commitment
            </Button>
          </div>
        </form>
      )}

      {/* Expenses List */}
      <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[380px] pr-1">
        {expenses.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              No fixed expenses added yet
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Add your monthly rent, subscriptions, loan EMIs and bills to calculate your spendable budget accurately.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setShowAddForm(true)}
            >
              Add your first bill
            </Button>
          </div>
        ) : (
          expenses.map((expense) => {
            const meta = getCategoryMeta(expense.category);

            return (
              <div
                key={expense.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}
                  >
                    {meta.icon}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-navy-900 dark:text-slate-100 leading-tight">
                      {expense.title}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span>{expense.category}</span>
                      {expense.due_day && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Due {expense.due_day}th
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold text-navy-900 dark:text-white">
                    {formatINR(expense.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(expense.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
