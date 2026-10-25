'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import { StorageService } from '@/lib/storage';
import { Expense, Category, Account } from '@/lib/types';
import { formatINR, getCurrentMonthKey } from '@/lib/formatters';
import { exportExpensesToCSV } from '@/lib/exportUtils';
import { triggerAlertEvaluation } from '@/lib/alertClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ExpenseListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Calendar,
  Trash2,
  Edit2,
  Clock,
  Sparkles,
  Tag,
  CreditCard,
  Download,
  FileSpreadsheet,
  Upload,
  X,
  ChevronDown,
} from 'lucide-react';
import { CategoryIcon } from '@/components/expense/CategoryIcon';

const PAGE_SIZE = 30;

export default function ExpensesPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const { openQuickAdd, openEditExpense } = useExpenseModal();

  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'this-month' | '7-days' | 'all'>('this-month');

  // Pagination limit
  const [displayLimit, setDisplayLimit] = useState<number>(PAGE_SIZE);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const query = params.get('search') || params.get('q');
      if (query) {
        setSearchQuery(query);
      }
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [exps, cats, accs] = await Promise.all([
        StorageService.getAllExpenses(userId),
        StorageService.getCategories(userId),
        StorageService.getAccounts(userId),
      ]);
      setAllExpenses(exps);
      setCategories(StorageService.deduplicateCategories(cats).unique);
      setAccounts(accs);
    } catch (err: unknown) {
      console.error('Failed to load expenses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadExpenses();

    const handleUpdate = () => {
      loadExpenses();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-expense-updated', handleUpdate);
      window.addEventListener('savemoney-categories-updated', handleUpdate);
      window.addEventListener('savemoney-accounts-updated', handleUpdate);
      return () => {
        window.removeEventListener('savemoney-expense-updated', handleUpdate);
        window.removeEventListener('savemoney-categories-updated', handleUpdate);
        window.removeEventListener('savemoney-accounts-updated', handleUpdate);
      };
    }
  }, [loadExpenses]);

  // Handle Delete
  const handleDelete = async (id: string, date: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    setDeletingId(id);
    try {
      await StorageService.deleteExpense(id, date, userId);
      setAllExpenses((prev) => prev.filter((e) => e.id !== id));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-expense-updated'));
      }

      // Re-evaluate alerts after delete (awaited so errors are not swallowed)
      const expenseMonth = date.slice(0, 7);
      await triggerAlertEvaluation({
        userId,
        month: expenseMonth,
        showToasts: true,
      });
    } catch (err) {
      alert('Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  };

  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const acc of accounts) {
      map.set(acc.id, acc);
    }
    return map;
  }, [accounts]);

  // Current Month string 'YYYY-MM'
  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  // Filter logic across allExpenses
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return allExpenses.filter((exp) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        (exp.note && exp.note.toLowerCase().includes(q)) ||
        (exp.merchant && exp.merchant.toLowerCase().includes(q)) ||
        exp.category.toLowerCase().includes(q);

      // Category filter
      const matchesCategory = selectedCategory === 'All' || exp.category.toLowerCase() === selectedCategory.toLowerCase();

      // Account filter
      const matchesAccount = selectedAccountId === 'all' || exp.account_id === selectedAccountId;

      // Date filter
      let matchesDate = true;
      if (dateFilter === 'this-month') {
        matchesDate = Boolean(exp.date && exp.date.startsWith(currentMonthKey));
      } else if (dateFilter === '7-days') {
        const expDate = new Date(exp.date);
        matchesDate = expDate >= sevenDaysAgo && expDate <= now;
      }

      return matchesSearch && matchesCategory && matchesAccount && matchesDate;
    });
  }, [allExpenses, searchQuery, selectedCategory, selectedAccountId, dateFilter, currentMonthKey]);

  // Total amount spent across the filtered items
  const totalFilteredSpent = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredExpenses]);

  // Paginated slice for high performance
  const paginatedExpenses = useMemo(() => {
    return filteredExpenses.slice(0, displayLimit);
  }, [filteredExpenses, displayLimit]);

  // Group paginated expenses by Day
  const groupedExpenses = useMemo(() => {
    const groups: { [dateStr: string]: { dateStr: string; displayDate: string; items: Expense[]; totalDay: number } } = {};

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    for (const exp of paginatedExpenses) {
      const expDay = exp.date ? exp.date.slice(0, 10) : todayStr;
      if (!groups[expDay]) {
        let displayDate = new Date(exp.date).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

        if (expDay === todayStr) displayDate = 'Today, ' + displayDate;
        else if (expDay === yesterdayStr) displayDate = 'Yesterday, ' + displayDate;

        groups[expDay] = {
          dateStr: expDay,
          displayDate,
          items: [],
          totalDay: 0,
        };
      }

      groups[expDay].items.push(exp);
      groups[expDay].totalDay += Number(exp.amount) || 0;
    }

    // Sort days descending
    return Object.values(groups).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [paginatedExpenses]);

  const getCategoryMeta = (catName: string) => {
    const found = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
    return {
      color: found?.color || '#F7931A',
      icon: <CategoryIcon name={catName} icon={found?.icon} className="w-4 h-4" />,
    };
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const handleExportFilteredCSV = () => {
    exportExpensesToCSV({
      expenses: filteredExpenses,
      accounts,
      filename: `savemoney_expenses_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            Expenses
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track daily variable expenses, filter by categories, and paste SMS for instant entry
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/import">
            <Button
              size="sm"
              variant="outline"
              icon={<Upload className="w-3.5 h-3.5 text-brand-primary" />}
              title="Import bank statement CSV"
            >
              Import Statement
            </Button>
          </Link>

          <Button
            size="sm"
            variant="outline"
            icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
            onClick={handleExportFilteredCSV}
            title="Export currently filtered expenses to CSV"
          >
            Export CSV
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={() => openQuickAdd()}
          >
            Quick Add
          </Button>
        </div>
      </div>

      {/* Filter and Summary Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by merchant, note, or category..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayLimit(PAGE_SIZE);
              }}
              className="w-full text-xs font-semibold pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-navy-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range Tabs */}
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold gap-1 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setDateFilter('this-month');
                setDisplayLimit(PAGE_SIZE);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateFilter === 'this-month'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => {
                setDateFilter('7-days');
                setDisplayLimit(PAGE_SIZE);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateFilter === '7-days'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => {
                setDateFilter('all');
                setDisplayLimit(PAGE_SIZE);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateFilter === 'all'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Category Pills Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setDisplayLimit(PAGE_SIZE);
            }}
            className={`px-3 py-1 rounded-xl font-bold transition-all shrink-0 ${
              selectedCategory === 'All'
                ? 'bg-navy-900 text-white dark:bg-white dark:text-navy-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
            return (
              <button
                key={cat.id || cat.name}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.name);
                  setDisplayLimit(PAGE_SIZE);
                }}
                className={`px-3 py-1 rounded-xl font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? '#FFFFFF' : cat.color || '#F7931A' }}
                />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Account Filter Row */}
        {accounts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-slate-400 font-bold shrink-0 text-[11px] mr-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" /> Account:
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedAccountId('all');
                setDisplayLimit(PAGE_SIZE);
              }}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all shrink-0 ${
                selectedAccountId === 'all'
                  ? 'bg-navy-900 text-white dark:bg-white dark:text-navy-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All Accounts
            </button>
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(acc.id);
                    setDisplayLimit(PAGE_SIZE);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span>{acc.nickname}</span>
                  {acc.last_4_digits && <span className="opacity-70 font-mono text-[10px]">•••• {acc.last_4_digits}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Summary Counter */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-400 font-medium">
            Showing {Math.min(filteredExpenses.length, displayLimit)} of {filteredExpenses.length} transaction(s)
          </span>
          <span className="font-extrabold text-navy-900 dark:text-white">
            Total: <span className="text-brand-primary">{formatINR(totalFilteredSpent)}</span>
          </span>
        </div>
      </Card>

      {/* Grouped Expenses List */}
      <div className="space-y-4">
        {loading ? (
          <ExpenseListSkeleton count={6} />
        ) : error ? (
          <ErrorState
            title="Failed to load expenses"
            message={error}
            onRetry={loadExpenses}
          />
        ) : groupedExpenses.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-7 h-7 stroke-[1.8]" />}
            title="No expenses found"
            description={
              searchQuery || selectedCategory !== 'All' || selectedAccountId !== 'all'
                ? 'No transactions matched your current filters. Try resetting the search or category filter.'
                : 'Tap "Quick Add Expense" or paste your bank/UPI SMS to log your first transaction in under 5 seconds!'
            }
            actionText="Quick Add Expense"
            actionIcon={<Plus className="w-3.5 h-3.5" />}
            onAction={() => openQuickAdd()}
          />
        ) : (
          <>
            {groupedExpenses.map((group) => (
              <div key={group.dateStr} className="space-y-2">
                {/* Day Header with Day Total */}
                <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                    <span>{group.displayDate}</span>
                  </div>
                  <span className="font-black text-navy-900 dark:text-slate-200">
                    {formatINR(group.totalDay)}
                  </span>
                </div>

                {/* Transactions in Day */}
                <Card className="p-0 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {group.items.map((exp) => {
                    const meta = getCategoryMeta(exp.category);

                    return (
                      <div
                        key={exp.id}
                        className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Left: Icon + Title + Meta */}
                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                            style={{
                              backgroundColor: `${meta.color}15`,
                              color: meta.color,
                            }}
                          >
                            {meta.icon}
                          </div>
                          <div className="truncate min-w-0">
                            <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100 truncate">
                              {exp.merchant || exp.note || exp.category}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate-400">
                              <span className="font-medium text-slate-500 dark:text-slate-400">
                                {exp.category}
                              </span>
                              {exp.note && exp.merchant && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[140px]">{exp.note}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="flex items-center gap-1 text-[11px]">
                                <Clock className="w-3 h-3" />
                                {formatTime(exp.date)}
                              </span>
                              {exp.account_id && accountMap.get(exp.account_id) && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                                    💳 {accountMap.get(exp.account_id)!.nickname}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount + Actions */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          <span className="text-base sm:text-lg font-black text-navy-900 dark:text-white">
                            {formatINR(exp.amount)}
                          </span>

                          <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => openEditExpense(exp)}
                              className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors"
                              title="Edit expense"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(exp.id, exp.date)}
                              disabled={deletingId === exp.id}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}

            {/* Pagination Controls / Load More */}
            {filteredExpenses.length > displayLimit && (
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<ChevronDown className="w-4 h-4" />}
                  onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
                >
                  Load More ({filteredExpenses.length - displayLimit} remaining)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-500 text-xs"
                  onClick={() => setDisplayLimit(filteredExpenses.length)}
                >
                  Show All ({filteredExpenses.length})
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
