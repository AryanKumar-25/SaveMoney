'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AccountTile, AddAccountTile } from '@/components/common/AccountTile';
import { AccountModal } from '@/components/accounts/AccountModal';
import { AccountDetailModal } from '@/components/accounts/AccountDetailModal';
import { AccountReconciliationModal } from '@/components/accounts/AccountReconciliationModal';
import { useAuth } from '@/hooks/useAuth';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import { StorageService } from '@/lib/storage';
import { Account, Expense, UserAlertSettings } from '@/lib/types';
import { calculateAccountStats } from '@/lib/accountCalculations';
import { needsReconciliationReminder } from '@/lib/safeguardCalculations';
import {
  Plus,
  Shield,
  CreditCard,
  Building2,
  Smartphone,
  Banknote,
  Wallet,
  Sparkles,
  Scale,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export default function AccountsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const { openQuickAdd } = useExpenseModal();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [alertSettings, setAlertSettings] = useState<UserAlertSettings | null>(null);
  const [latestReconciledMap, setLatestReconciledMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [accountForDetail, setAccountForDetail] = useState<Account | null>(null);

  // Reconciliation state
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);
  const [accountToReconcile, setAccountToReconcile] = useState<Account | null>(null);

  const currentMonthKey = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accs, exps, settings] = await Promise.all([
        StorageService.getAccounts(userId),
        StorageService.getAllExpenses(userId),
        StorageService.getAlertSettings(userId),
      ]);
      setAccounts(accs);
      setAllExpenses(exps);
      setAlertSettings(settings);

      // Load latest reconciliation record for each bank and cash account
      const recMap: Record<string, string> = {};
      const eligibleAccs = accs.filter((a) => a.type === 'bank' || a.type === 'cash');
      await Promise.all(
        eligibleAccs.map(async (acc) => {
          const latest = await StorageService.getLatestReconciliation(acc.id, userId);
          if (latest) {
            recMap[acc.id] = latest.date;
          }
        })
      );
      setLatestReconciledMap(recMap);

      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
    } catch (err) {
      console.warn('Failed to load accounts data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-accounts-updated', handleUpdate);
      window.addEventListener('savemoney-expense-updated', handleUpdate);
      window.addEventListener('savemoney-reconciliations-updated', handleUpdate);
      return () => {
        window.removeEventListener('savemoney-accounts-updated', handleUpdate);
        window.removeEventListener('savemoney-expense-updated', handleUpdate);
        window.removeEventListener('savemoney-reconciliations-updated', handleUpdate);
      };
    }
  }, [userId]);

  const handleOpenAdd = () => {
    setAccountToEdit(null);
    setAccountModalOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setAccountToEdit(acc);
    setAccountModalOpen(true);
    setDetailModalOpen(false);
  };

  const handleOpenDetail = (acc: Account) => {
    setAccountForDetail(acc);
    setSelectedAccountId(acc.id);
    setDetailModalOpen(true);
  };

  const handleOpenReconcile = (acc: Account) => {
    setAccountToReconcile(acc);
    setReconciliationModalOpen(true);
  };

  const handleAddMissingExpenseFromReconciliation = (amount: number, accountId: string) => {
    openQuickAdd({
      amount,
      account_id: accountId,
      note: 'Reconciliation: Missed expense',
    });
  };

  // Check if any bank or cash account needs weekly reconciliation
  const overdueAccounts = useMemo(() => {
    const weeklyEnabled = alertSettings?.weeklyReconciliationReminder !== false;
    if (!weeklyEnabled) return [];

    return accounts.filter((a) => {
      if (a.type !== 'bank' && a.type !== 'cash') return false;
      const lastDate = latestReconciledMap[a.id];
      return needsReconciliationReminder(lastDate, new Date(), true);
    });
  }, [accounts, latestReconciledMap, alertSettings]);

  const handleDelete = async (acc: Account) => {
    if (!confirm(`Are you sure you want to delete "${acc.nickname}"? Past expenses will remain safe.`)) {
      return;
    }

    try {
      await StorageService.deleteAccount(acc.id, userId);
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
      if (selectedAccountId === acc.id) {
        setSelectedAccountId(null);
      }
      setDetailModalOpen(false);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-accounts-updated'));
      }
    } catch (err) {
      alert('Failed to delete account');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-brand-light text-brand-primary dark:bg-brand-primary/20">
              <CreditCard className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Payment Methods
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            My Accounts & Cards
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track expenses by bank account, credit card, UPI app, or physical cash
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={handleOpenAdd}
        >
          Add Payment Method
        </Button>
      </div>

      {/* Security Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
        <Shield className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <span className="font-bold">Zero-Risk Security: </span>
          SaveMoney strictly stores nicknames and last 4 digits only. Never enter full card numbers, CVVs, PINs, or UPI passwords.
        </div>
      </div>

      {/* Weekly Reconciliation Reminder Banner */}
      {overdueAccounts.length > 0 && (
        <div className="p-4 rounded-2xl bg-brand-primary/10 border border-brand-primary/30 text-navy-900 dark:text-brand-light text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-primary/20 flex items-center justify-center shrink-0 text-brand-primary">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-navy-900 dark:text-white">
                Weekly Balance Check Reminder
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                You haven&apos;t reconciled {overdueAccounts.map((a) => a.nickname).join(', ')} in over 7 days. Compare your balance against your bank app to ensure no expenses were missed.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleOpenReconcile(overdueAccounts[0])}
            className="shrink-0 self-start sm:self-center"
          >
            Check {overdueAccounts[0].nickname}
          </Button>
        </div>
      )}

      {/* Loading state with skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : accounts.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={<Wallet className="w-7 h-7 stroke-[1.8]" />}
          title="No accounts yet. Add your first payment method"
          description="Add your bank accounts, credit cards, UPI handles, or cash wallet to automatically tag expenses and monitor limits."
          actionText="Add First Account"
          actionIcon={<Plus className="w-3.5 h-3.5" />}
          onAction={handleOpenAdd}
        />
      ) : (
        /* Accounts Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const stats = calculateAccountStats(account, allExpenses, currentMonthKey);

            return (
              <AccountTile
                key={account.id}
                account={account}
                stats={stats}
                isSelected={selectedAccountId === account.id}
                onSelect={(id) => {
                  setSelectedAccountId(id);
                  handleOpenDetail(account);
                }}
                onViewDetail={handleOpenDetail}
                onReconcile={handleOpenReconcile}
              />
            );
          })}

          <AddAccountTile onClick={handleOpenAdd} />
        </div>
      )}

      {/* Account Creation & Edit Modal */}
      <AccountModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        accountToEdit={accountToEdit}
        onSaved={loadData}
      />

      {/* Account Detail Modal */}
      <AccountDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        account={accountForDetail}
        allExpenses={allExpenses}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        onReconcile={handleOpenReconcile}
      />

      {/* Account Reconciliation Modal */}
      <AccountReconciliationModal
        isOpen={reconciliationModalOpen}
        onClose={() => {
          setReconciliationModalOpen(false);
          setAccountToReconcile(null);
        }}
        account={accountToReconcile}
        allExpenses={allExpenses}
        userId={userId}
        onAddMissingExpense={handleAddMissingExpenseFromReconciliation}
        onSaved={loadData}
      />
    </div>
  );
}
