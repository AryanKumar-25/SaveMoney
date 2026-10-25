'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useBudget } from '@/hooks/useBudget';
import { useAuth } from '@/hooks/useAuth';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import { StorageService } from '@/lib/storage';
import { Account, Expense, BalanceAdjustment } from '@/lib/types';
import { formatINR, formatMonthName } from '@/lib/formatters';
import { calculateAccountStats } from '@/lib/accountCalculations';
import { triggerAlertEvaluation } from '@/lib/alertClient';
import {
  calculateChartDataForRange,
  calculateCategoryBreakdown,
  calculateTimeTabTotals,
  calculateSafeToSpendToday,
} from '@/lib/calculations';
import { BudgetOverviewCard } from '@/components/budget/BudgetOverviewCard';
import { ExtraMoneyDashboardCard } from '@/components/dashboard/ExtraMoneyDashboardCard';
import { DailyCheckInCard } from '@/components/dashboard/DailyCheckInCard';
import { MoveToBalanceModal } from '@/components/extra-money/MoveToBalanceModal';
import { BalanceAdjustmentModal } from '@/components/budget/BalanceAdjustmentModal';
import { BalanceHistoryModal } from '@/components/budget/BalanceHistoryModal';
import { StatCard, AddStatCard } from '@/components/common/StatCard';
import {
  AccountTile,
  AllAccountsTile,
  AddAccountTile,
} from '@/components/common/AccountTile';
import { AccountModal } from '@/components/accounts/AccountModal';
import { AccountDetailModal } from '@/components/accounts/AccountDetailModal';
import { SpendingAreaChart } from '@/components/dashboard/SpendingAreaChart';
import { TimeTabsCard } from '@/components/dashboard/TimeTabsCard';
import { MonthEndProjectionCard } from '@/components/dashboard/MonthEndProjectionCard';
import { CategoryBreakdownChart } from '@/components/dashboard/CategoryBreakdownChart';
import { RecentExpensesCard } from '@/components/dashboard/RecentExpensesCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCardSkeleton, ChartSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { TimeRange } from '@/components/common/RangePills';
import {
  Layers,
  ChevronRight,
  Plus,
  Receipt,
  Sparkles,
  CreditCard,
  Filter,
  X,
  Wallet,
  Coins,
  SlidersHorizontal,
  History,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const { openQuickAdd } = useExpenseModal();

  const {
    currentMonth,
    calculation,
    fixedExpenses,
    spending,
    allExpenses,
    categories,
    safeToSpend,
    projection,
    timeTabTotals,
    extraTransfers,
    balanceAdjustments,
    extraMoneyPool,
    refreshBudget,
    loading,
  } = useBudget();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [chartRange, setChartRange] = useState<TimeRange>('1M');

  // Account Modals
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [accountForDetail, setAccountForDetail] = useState<Account | null>(null);

  // Extra Money & Balance Adjustment Modals
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentToEdit, setAdjustmentToEdit] = useState<BalanceAdjustment | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Load user accounts
  const fetchAccounts = () => {
    StorageService.getAccounts(userId).then((accs) => {
      setAccounts(accs);
    });
  };

  useEffect(() => {
    fetchAccounts();

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-accounts-updated', fetchAccounts);
      return () => {
        window.removeEventListener('savemoney-accounts-updated', fetchAccounts);
      };
    }
  }, [userId]);

  // Active expenses filtered by selected account ('all' vs specific account)
  const activeExpenses = useMemo(() => {
    if (selectedAccountId === 'all') return allExpenses;
    return allExpenses.filter((e) => e.account_id === selectedAccountId);
  }, [allExpenses, selectedAccountId]);

  // Selected account metadata
  const selectedAccount = useMemo(() => {
    if (selectedAccountId === 'all') return null;
    return accounts.find((a) => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  // Dynamic totals for active expenses
  const spentSoFarThisMonth = useMemo(() => {
    return activeExpenses
      .filter((e) => e.date && e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [activeExpenses, currentMonth]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const spentToday = useMemo(() => {
    return activeExpenses
      .filter((e) => e.date && e.date.slice(0, 10) === todayStr)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [activeExpenses, todayStr]);

  const sevenDaysAgo = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const spentThisWeek = useMemo(() => {
    const now = new Date();
    return activeExpenses
      .filter((e) => {
        const d = new Date(e.date);
        return d >= sevenDaysAgo && d <= now;
      })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [activeExpenses, sevenDaysAgo]);

  // Dynamic Time Tabs Totals for active expenses
  const activeTimeTabTotals = useMemo(() => {
    return calculateTimeTabTotals(activeExpenses);
  }, [activeExpenses]);

  // Dynamic Safe-to-Spend for active expenses
  const activeSafeToSpend = useMemo(() => {
    if (selectedAccountId === 'all') {
      return safeToSpend;
    }
    return calculateSafeToSpendToday(
      calculation.spendableBudget,
      spentSoFarThisMonth,
      spentToday
    );
  }, [selectedAccountId, safeToSpend, calculation.spendableBudget, spentSoFarThisMonth, spentToday]);

  const isConfigured =
    calculation.income > 0 || calculation.totalFixedExpenses > 0 || calculation.savingsTarget > 0;

  // Safe to spend status & over-budget/over-daily logic
  const isOverMonthBudget = activeSafeToSpend.isOverBudget;
  const isOverToday = activeSafeToSpend.isOverToday;

  let safeSpendValue = formatINR(activeSafeToSpend.safeToSpendRemainingToday);
  let safeSpendSubValue = `${formatINR(activeSafeToSpend.remainingBudget)} remaining for month`;
  let safeSpendChange = `${activeSafeToSpend.daysLeftInMonth} days left (incl. today)`;
  let safeSpendBadge = 'DAILY ALLOWANCE';
  let safeSpendBadgeVariant: 'default' | 'danger' | 'success' | 'warning' = 'success';
  let safeSpendChangeType: 'positive' | 'negative' | 'neutral' = 'positive';

  if (!isConfigured) {
    safeSpendValue = formatINR(0);
    safeSpendSubValue = 'Configure your income in Budget Setup to calculate daily allowance';
    safeSpendChange = 'Budget not configured';
    safeSpendBadge = 'SETUP NEEDED';
    safeSpendBadgeVariant = 'default';
    safeSpendChangeType = 'neutral';
  } else if (isOverMonthBudget) {
    safeSpendValue = formatINR(0);
    safeSpendSubValue = `Over budget by ${formatINR(activeSafeToSpend.overBudgetBy)}`;
    safeSpendChange = `Spent: ${formatINR(spentSoFarThisMonth)} / Budget: ${formatINR(calculation.spendableBudget)}`;
    safeSpendBadge = 'OVER BUDGET';
    safeSpendBadgeVariant = 'danger';
    safeSpendChangeType = 'negative';
  } else if (isOverToday) {
    safeSpendValue = formatINR(0);
    safeSpendSubValue = `Over daily limit by ${formatINR(activeSafeToSpend.overTodayBy)}`;
    safeSpendChange = `Spent ₹${activeSafeToSpend.spentToday} (Limit was ₹${activeSafeToSpend.dailyAllowanceForToday})`;
    safeSpendBadge = 'OVER TODAY';
    safeSpendBadgeVariant = 'danger';
    safeSpendChangeType = 'negative';
  } else {
    safeSpendValue = formatINR(activeSafeToSpend.safeToSpendRemainingToday);
    safeSpendSubValue = `Daily limit: ${formatINR(activeSafeToSpend.dailyAllowanceForToday)} (${activeSafeToSpend.daysLeftInMonth}d left)`;
    safeSpendChange = `${formatINR(activeSafeToSpend.remainingBudget)} remaining for month`;
    safeSpendBadge = 'SAFE TO SPEND';
    safeSpendBadgeVariant = 'success';
    safeSpendChangeType = 'positive';
  }

  // Calculate Category Breakdown and Chart points for the active expenses & range
  const { filteredExpenses: rangeFilteredExpenses, totalSpent: rangeTotalSpent } = useMemo(() => {
    return calculateChartDataForRange(
      activeExpenses,
      chartRange,
      activeSafeToSpend.dailyAllowanceForToday
    );
  }, [activeExpenses, chartRange, activeSafeToSpend.dailyAllowanceForToday]);

  const rangeCategoryBreakdown = useMemo(() => {
    return calculateCategoryBreakdown(rangeFilteredExpenses, categories);
  }, [rangeFilteredExpenses, categories]);

  // Total spent across all accounts for current month
  const totalSpentAllAccountsThisMonth = useMemo(() => {
    return allExpenses
      .filter((e) => e.date && e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [allExpenses, currentMonth]);

  const handleOpenDetail = (acc: Account) => {
    setAccountForDetail(acc);
    setDetailModalOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setAccountToEdit(acc);
    setAccountModalOpen(true);
    setDetailModalOpen(false);
  };

  const handleDeleteAccount = async (acc: Account) => {
    if (!confirm(`Are you sure you want to delete "${acc.nickname}"? Past expenses will remain safe.`)) {
      return;
    }
    try {
      await StorageService.deleteAccount(acc.id, userId);
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
      if (selectedAccountId === acc.id) {
        setSelectedAccountId('all');
      }
      setDetailModalOpen(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-accounts-updated'));
      }
    } catch {
      alert('Failed to delete account');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-12">
        <div className="h-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 animate-pulse space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <ChartSkeleton height="h-64" />
          </div>
          <div className="lg:col-span-5">
            <ChartSkeleton height="h-64" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Active Account Filter Notification Bar */}
      {selectedAccount && (
        <div className="p-3 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900/60 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-brand-primary shrink-0" />
            <span className="text-slate-600 dark:text-slate-300">
              Dashboard filtered to: <strong className="text-navy-900 dark:text-white">{selectedAccount.nickname}</strong>{' '}
              {selectedAccount.last_4_digits && `(•••• ${selectedAccount.last_4_digits})`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedAccountId('all')}
            className="flex items-center gap-1 font-bold text-brand-primary hover:text-brand-600 hover:underline shrink-0 ml-2"
          >
            <span>Show all accounts</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Section: Month Budget Bar & Primary Safe-To-Spend Allowance */}
      <BudgetOverviewCard
        calculation={calculation}
        spentSoFarThisMonth={spentSoFarThisMonth}
        spentToday={spentToday}
        monthName={formatMonthName(currentMonth)}
      />

      {/* Extra Money Summary Card */}
      <ExtraMoneyDashboardCard
        availableExtraMoney={extraMoneyPool.availableExtraMoney}
        totalReceived={extraMoneyPool.totalReceived}
        onOpenMoveModal={() => setMoveModalOpen(true)}
      />

      {/* Daily Check-in Card (Evening prompt / Zero spend verification) */}
      <DailyCheckInCard
        expenses={allExpenses}
        onOpenQuickAdd={() => openQuickAdd()}
        userId={userId}
      />

      {/* Key Financial Health Vitals (Stat Cards) */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 uppercase tracking-wider">
              Spending Vitals
            </h3>
            <span className="text-xs text-slate-400">
              {selectedAccount ? `Filtered: ${selectedAccount.nickname}` : 'Real-time calculation'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={<SlidersHorizontal className="w-3.5 h-3.5 text-brand-primary" />}
              onClick={() => {
                setAdjustmentToEdit(null);
                setAdjustmentModalOpen(true);
              }}
              className="text-xs"
            >
              Adjust Balance
            </Button>

            {(balanceAdjustments.length > 0 || extraTransfers.length > 0) && (
              <Button
                size="sm"
                variant="ghost"
                icon={<History className="w-3.5 h-3.5" />}
                onClick={() => setHistoryModalOpen(true)}
                className="text-xs text-slate-500 hover:text-navy-900 dark:hover:text-white"
              >
                History ({balanceAdjustments.length + extraTransfers.length})
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Safe to Spend Today */}
          <StatCard
            title="Safe to Spend Today"
            value={safeSpendValue}
            subValue={safeSpendSubValue}
            badge={safeSpendBadge}
            badgeVariant={safeSpendBadgeVariant}
            change={safeSpendChange}
            changeType={safeSpendChangeType}
          />

          {/* Card 2: Savings Goal Target Progress */}
          <StatCard
            title="Monthly Savings Target"
            value={formatINR(calculation.savingsTarget)}
            subValue={
              !isConfigured
                ? 'Set a savings target in Budget Setup'
                : isOverMonthBudget
                ? `Savings at risk! Deficit: ${formatINR(activeSafeToSpend.overBudgetBy)}`
                : `${formatINR(activeSafeToSpend.remainingBudget)} buffer untouched`
            }
            badge={!isConfigured ? 'SETUP NEEDED' : isOverMonthBudget ? 'AT RISK' : 'ON TRACK'}
            badgeVariant={!isConfigured ? 'default' : isOverMonthBudget ? 'danger' : 'success'}
            change={
              !isConfigured
                ? 'Budget not configured'
                : isOverMonthBudget
                ? 'Over spendable limit'
                : `${calculation.savingsRatePercent}% of monthly income protected`
            }
            changeType={isOverMonthBudget ? 'negative' : 'positive'}
          />

          {/* Card 3: Fixed Obligations */}
          <div className="relative">
            <StatCard
              title="Fixed Obligations"
              value={formatINR(calculation.totalFixedExpenses)}
              subValue={`${fixedExpenses.length} bills, rent & EMIs committed`}
              badge={fixedExpenses.length > 0 ? 'COMMITTED' : 'NONE'}
              badgeVariant="default"
              change={
                calculation.income > 0
                  ? `${calculation.fixedExpensesPercent}% of income locked`
                  : 'Income not set'
              }
              changeType="neutral"
            />
            <Link
              href="/budget"
              className="absolute top-4 right-4 text-xs font-bold text-brand-primary hover:text-brand-600"
            >
              {fixedExpenses.length > 0 ? 'Manage &rarr;' : 'Add &rarr;'}
            </Link>
          </div>
        </div>
      </div>

      {/* Time Tabs (Today, This week, This month, This year) */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100 uppercase tracking-wider">
            Spending Windows
          </h3>
          <span className="text-xs text-slate-400">
            {selectedAccount ? `Transactions for ${selectedAccount.nickname}` : 'Calculated from all real transactions'}
          </span>
        </div>
        <TimeTabsCard
          totals={activeTimeTabTotals}
          activeTab={
            chartRange === '1D'
              ? 'today'
              : chartRange === '7D'
              ? 'week'
              : chartRange === '1Y'
              ? 'year'
              : 'month'
          }
          onSelectTab={(tab) => {
            if (tab === 'today') setChartRange('1D');
            else if (tab === 'week') setChartRange('7D');
            else if (tab === 'month') setChartRange('1M');
            else if (tab === 'year') setChartRange('1Y');
          }}
        />
      </div>

      {/* Charts Grid: My Spending (with Dashed Limit Line) & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: My Spending Bar Chart (7 Cols on Desktop) */}
        <div className="lg:col-span-7">
          <SpendingAreaChart
            expenses={activeExpenses}
            dailySafeLimit={activeSafeToSpend.dailyAllowanceForToday}
            monthName={formatMonthName(currentMonth)}
            selectedRange={chartRange}
            onRangeChange={setChartRange}
          />
        </div>

        {/* Right: Category Breakdown (5 Cols on Desktop) */}
        <div className="lg:col-span-5">
          <CategoryBreakdownChart
            breakdown={rangeCategoryBreakdown}
            totalSpent={rangeTotalSpent}
            rangeLabel={`${chartRange} Spending`}
          />
        </div>
      </div>

      {/* Bottom Insights Grid: Month-End Projection & Recent Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Month-End Projection (6 Cols) */}
        <div className="lg:col-span-6">
          <MonthEndProjectionCard
            projection={projection}
            monthName={formatMonthName(currentMonth)}
          />
        </div>

        {/* Right: Recent Expenses (6 Cols) */}
        <div className="lg:col-span-6">
          <RecentExpensesCard
            expenses={activeExpenses}
            categories={categories}
          />
        </div>
      </div>

      {/* "My Accounts & Cards" Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-navy-900 dark:text-slate-100 tracking-tight">
              My Accounts & Cards
            </h3>
            <p className="text-xs text-slate-400">
              Select an account to filter dashboard numbers, or click for details
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setAccountToEdit(null);
              setAccountModalOpen(true);
            }}
          >
            Add Account
          </Button>
        </div>

        {accounts.length === 0 ? (
          <Card className="py-8 px-5 text-center bg-slate-50/50 dark:bg-slate-900/40 border-dashed border-2">
            <Wallet className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-40" />
            <h4 className="text-sm font-bold text-navy-900 dark:text-white">
              No accounts yet. Add your first account
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-3">
              Add your bank accounts, credit cards, UPI handles, or cash wallet to track spending per payment method.
            </p>
            <Button
              size="sm"
              variant="outline"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setAccountToEdit(null);
                setAccountModalOpen(true);
              }}
            >
              Add First Account
            </Button>
          </Card>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {/* All Accounts Tile */}
            <AllAccountsTile
              isSelected={selectedAccountId === 'all'}
              onSelect={() => setSelectedAccountId('all')}
              totalSpentThisMonth={totalSpentAllAccountsThisMonth}
            />

            {/* Individual Account Tiles */}
            {accounts.map((account) => {
              const stats = calculateAccountStats(account, allExpenses, currentMonth);

              return (
                <AccountTile
                  key={account.id}
                  account={account}
                  stats={stats}
                  isSelected={selectedAccountId === account.id}
                  onSelect={(id) => {
                    // Toggle selection: if clicked again when already selected, open detail
                    if (selectedAccountId === id) {
                      handleOpenDetail(account);
                    } else {
                      setSelectedAccountId(id);
                    }
                  }}
                  onViewDetail={handleOpenDetail}
                />
              );
            })}

            <AddAccountTile
              onClick={() => {
                setAccountToEdit(null);
                setAccountModalOpen(true);
              }}
            />
          </div>
        )}
      </div>

      {/* Account Modals */}
      <AccountModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        accountToEdit={accountToEdit}
        onSaved={fetchAccounts}
      />

      <AccountDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        account={accountForDetail}
        allExpenses={allExpenses}
        onEdit={handleOpenEdit}
        onDelete={handleDeleteAccount}
      />

      {/* Extra Money & Balance Adjustment Modals */}
      <MoveToBalanceModal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        availableExtraMoney={extraMoneyPool.availableExtraMoney}
        currentSpendableBudget={calculation.spendableBudget}
        spentSoFarThisMonth={spentSoFarThisMonth}
        spentToday={spentToday}
        targetMonth={currentMonth}
        onMoved={refreshBudget}
      />

      <BalanceAdjustmentModal
        isOpen={adjustmentModalOpen}
        onClose={() => {
          setAdjustmentModalOpen(false);
          setAdjustmentToEdit(null);
        }}
        currentSpendableBudget={calculation.spendableBudget}
        spentSoFarThisMonth={spentSoFarThisMonth}
        spentToday={spentToday}
        targetMonth={currentMonth}
        adjustmentToEdit={adjustmentToEdit}
        onSaved={refreshBudget}
      />

      <BalanceHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        month={currentMonth}
        adjustments={balanceAdjustments}
        transfers={extraTransfers}
        onEditAdjustment={(adj) => {
          setAdjustmentToEdit(adj);
          setAdjustmentModalOpen(true);
          setHistoryModalOpen(false);
        }}
        onDeleteAdjustment={async (id) => {
          await StorageService.deleteBalanceAdjustment(id, userId);
          await triggerAlertEvaluation({ userId, month: currentMonth });
          refreshBudget();
        }}
        onUndoTransfer={async (id) => {
          await StorageService.undoExtraMoneyTransfer(id, userId);
          await triggerAlertEvaluation({ userId, month: currentMonth });
          refreshBudget();
        }}
      />
    </div>
  );
}
