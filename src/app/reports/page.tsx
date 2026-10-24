'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { Expense, MonthlyBudget, Category, Account } from '@/lib/types';
import { formatMonthName, getCurrentMonthKey } from '@/lib/formatters';
import {
  calculateMonthlyReport,
  calculateYearlyReport,
  MonthlyReportResult,
  YearlyReportResult,
} from '@/lib/reportCalculations';
import { getPreviousMonthKey } from '@/lib/monthRollover';
import { exportExpensesToCSV, exportAllDataToJSON } from '@/lib/exportUtils';
import { MonthlyReportCard } from '@/components/reports/MonthlyReportCard';
import { YearlyReportCard } from '@/components/reports/YearlyReportCard';
import { StatCardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileCode,
  Sparkles,
  Layers,
  Receipt,
  X,
  Filter,
} from 'lucide-react';

type ReportView = 'monthly' | 'yearly';

export default function ReportsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const { openQuickAdd } = useExpenseModal();

  const [view, setView] = useState<ReportView>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [fixedExpensesTotal, setFixedExpensesTotal] = useState<number>(0);
  const [fixedExpensesByMonth, setFixedExpensesByMonth] = useState<Record<string, number>>({});
  const [extraTransfersTotal, setExtraTransfersTotal] = useState<number>(0);
  const [balanceAdjustmentsTotal, setBalanceAdjustmentsTotal] = useState<number>(0);
  const [extraMoneyReceivedTotal, setExtraMoneyReceivedTotal] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // CSV Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const prevMonth = getPreviousMonthKey(selectedMonth);

      // Fetch all required data in parallel
      const [
        allExps,
        cats,
        accs,
        currentBudgetRes,
        currentFixed,
        monthTransfers,
        monthAdjustments,
        extraEntries,
      ] = await Promise.all([
        StorageService.getAllExpenses(userId),
        StorageService.getCategories(userId),
        StorageService.getAccounts(userId),
        StorageService.getMonthlyBudget(selectedMonth, userId),
        StorageService.getFixedExpenses(selectedMonth, userId),
        StorageService.getMonthExtraMoneyTransfers(selectedMonth, userId),
        StorageService.getBalanceAdjustments(selectedMonth, userId),
        StorageService.getExtraMoneyEntries(userId),
      ]);

      setAllExpenses(allExps);
      setCategories(StorageService.deduplicateCategories(cats).unique);
      setAccounts(accs);

      const currentFixedTotal = currentFixed.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
      setFixedExpensesTotal(currentFixedTotal);

      const xTransfersTotal = monthTransfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const xAdjustmentsTotal = monthAdjustments.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
      const xReceivedTotal = extraEntries
        .filter((e) => e.date && e.date.startsWith(selectedMonth))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      setExtraTransfersTotal(xTransfersTotal);
      setBalanceAdjustmentsTotal(xAdjustmentsTotal);
      setExtraMoneyReceivedTotal(xReceivedTotal);

      // Collect budgets across the year for yearly report
      const monthsInYear = Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
      const budgetPromises = monthsInYear.map((m) => StorageService.getMonthlyBudget(m, userId));
      const budgetResults = await Promise.all(budgetPromises);

      const loadedBudgets: MonthlyBudget[] = [];
      budgetResults.forEach((res) => {
        if (res.budget) loadedBudgets.push(res.budget);
      });
      setBudgets(loadedBudgets);

      // Fixed expenses for all months in year
      const fixedPromises = monthsInYear.map((m) => StorageService.getFixedExpenses(m, userId));
      const fixedResults = await Promise.all(fixedPromises);
      const fixedMap: Record<string, number> = {};
      monthsInYear.forEach((m, idx) => {
        fixedMap[m] = fixedResults[idx].reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
      });
      setFixedExpensesByMonth(fixedMap);
    } catch (err: unknown) {
      console.error('Failed to load reports data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [userId, selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-expense-updated', handleUpdate);
      window.addEventListener('savemoney-budget-updated', handleUpdate);
      window.addEventListener('savemoney-extra-money-updated', handleUpdate);
      window.addEventListener('savemoney-balance-adjusted', handleUpdate);
      return () => {
        window.removeEventListener('savemoney-expense-updated', handleUpdate);
        window.removeEventListener('savemoney-budget-updated', handleUpdate);
        window.removeEventListener('savemoney-extra-money-updated', handleUpdate);
        window.removeEventListener('savemoney-balance-adjusted', handleUpdate);
      };
    }
  }, [loadData]);

  // Handle shifting month
  const handleShiftMonth = (offset: number) => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1 + offset, 1);
    const newMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonthKey);
    setSelectedYear(date.getFullYear());
  };

  // Compute Monthly Report
  const monthlyReport: MonthlyReportResult = useMemo(() => {
    const prevMonthKey = getPreviousMonthKey(selectedMonth);
    const currentMonthExpenses = allExpenses.filter((e) => e.date && e.date.startsWith(selectedMonth));
    const prevMonthExpenses = allExpenses.filter((e) => e.date && e.date.startsWith(prevMonthKey));
    const budget = budgets.find((b) => b.month === selectedMonth) || null;

    return calculateMonthlyReport({
      month: selectedMonth,
      expenses: currentMonthExpenses,
      lastMonthExpenses: prevMonthExpenses,
      budget,
      fixedExpensesTotal,
      extraTransfers: extraTransfersTotal,
      balanceAdjustments: balanceAdjustmentsTotal,
      extraMoneyReceived: extraMoneyReceivedTotal,
      categories,
    });
  }, [selectedMonth, allExpenses, budgets, fixedExpensesTotal, extraTransfersTotal, balanceAdjustmentsTotal, extraMoneyReceivedTotal, categories]);

  // Compute Yearly Report
  const yearlyReport: YearlyReportResult = useMemo(() => {
    return calculateYearlyReport({
      year: selectedYear,
      allExpenses,
      monthlyBudgets: budgets,
      fixedExpensesByMonth,
    });
  }, [selectedYear, allExpenses, budgets, fixedExpensesByMonth]);

  // Export handlers
  const handleOpenExportModal = () => {
    // Default date range to selected month
    const [y, m] = selectedMonth.split('-');
    const daysInMonth = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
    setExportStartDate(`${selectedMonth}-01`);
    setExportEndDate(`${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`);
    setShowExportModal(true);
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      exportExpensesToCSV({
        expenses: allExpenses,
        accounts,
        startDate: exportStartDate || undefined,
        endDate: exportEndDate || undefined,
        filename: `savemoney_expenses_${exportStartDate || 'all'}_to_${exportEndDate || 'all'}.csv`,
      });
      setShowExportModal(false);
    } catch {
      alert('Failed to generate CSV export');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      await exportAllDataToJSON(userId);
    } catch {
      alert('Failed to generate JSON backup');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <BarChart3 className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Analytics & Insights
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            Spending Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Compare monthly budgets, discover top merchants, and track annual savings targets.
          </p>
        </div>

        {/* View Switcher & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Tab Selector: Monthly vs Yearly */}
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold gap-1">
            <button
              type="button"
              onClick={() => setView('monthly')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                view === 'monthly'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Monthly Report
            </button>
            <button
              type="button"
              onClick={() => setView('yearly')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                view === 'yearly'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Yearly View
            </button>
          </div>

          {/* Export CSV Button */}
          <Button
            size="sm"
            variant="outline"
            icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
            onClick={handleOpenExportModal}
          >
            Export CSV
          </Button>

          {/* Download JSON Backup */}
          <Button
            size="sm"
            variant="ghost"
            icon={<Download className="w-3.5 h-3.5 text-slate-400" />}
            onClick={handleExportJSON}
            title="Download full JSON backup of all accounts, expenses, and settings"
          >
            Backup (JSON)
          </Button>
        </div>
      </div>

      {/* Month Navigation Pill (Shown in Monthly View) */}
      {view === 'monthly' && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs max-w-sm">
          <button
            type="button"
            onClick={() => handleShiftMonth(-1)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-primary" />
            <span className="text-sm font-extrabold text-navy-900 dark:text-white">
              {formatMonthName(selectedMonth)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleShiftMonth(1)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <ChartSkeleton height="h-72" />
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load reports"
          message={error}
          onRetry={loadData}
        />
      ) : view === 'monthly' ? (
        monthlyReport.totalSpent === 0 && monthlyReport.spendableBudget === 0 ? (
          <EmptyState
            icon={<BarChart3 className="w-7 h-7 stroke-[1.8]" />}
            title={`No spending recorded in ${formatMonthName(selectedMonth)}`}
            description="Log your daily variable expenses or configure your monthly budget to see in-depth breakdown of your spending habits."
            actionText="Quick Add Expense"
            actionIcon={<Receipt className="w-3.5 h-3.5" />}
            onAction={() => openQuickAdd()}
          />
        ) : (
          <MonthlyReportCard report={monthlyReport} />
        )
      ) : (
        <YearlyReportCard
          report={yearlyReport}
          selectedYear={selectedYear}
          onYearChange={(y) => setSelectedYear(y)}
        />
      )}

      {/* CSV Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <Card className="max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                  Export Expenses to CSV
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Download your transactions with Date, Amount (₹), Category, Merchant, Note, and Account fields formatted for Excel and Google Sheets.
            </p>

            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="From Date"
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                />
                <Input
                  label="To Date"
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setExportStartDate('');
                    setExportEndDate('');
                  }}
                  className="text-brand-primary hover:underline font-bold"
                >
                  Export All Time ({allExpenses.length} records)
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
                loading={isExporting}
                onClick={handleExportCSV}
              >
                Download CSV
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
