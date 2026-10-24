import { Expense, Account, MonthlyBudget, FixedExpense, Category, AlertItem, UserAlertSettings } from './types';
import { StorageService } from './storage';

/**
 * Escapes a cell value for standard CSV formatting (RFC 4180)
 */
function escapeCSVField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports expenses to a CSV file with an optional date range filter
 */
export function exportExpensesToCSV(params: {
  expenses: Expense[];
  accounts?: Account[];
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD'
  filename?: string;
}): { success: boolean; count: number } {
  const { expenses, accounts = [], startDate, endDate, filename } = params;

  // Build account lookup map
  const accountMap = new Map<string, string>();
  for (const acc of accounts) {
    accountMap.set(
      acc.id,
      acc.last_4_digits
        ? `${acc.nickname} (•••• ${acc.last_4_digits})`
        : acc.nickname
    );
  }

  // Filter expenses by date range if provided
  const filtered = expenses.filter((e) => {
    if (!e.date) return false;
    const dateStr = e.date.slice(0, 10);
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  });

  // Sort descending by date
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Headers
  const headers = ['Date', 'Time', 'Amount (INR)', 'Category', 'Merchant', 'Note', 'Account'];
  const rows: string[] = [headers.join(',')];

  for (const exp of filtered) {
    let dateStr = '';
    let timeStr = '';
    try {
      const d = new Date(exp.date);
      dateStr = d.toISOString().slice(0, 10);
      timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      dateStr = exp.date;
    }

    const accountName = exp.account_id ? accountMap.get(exp.account_id) || 'Unlinked Account' : 'None';

    const row = [
      escapeCSVField(dateStr),
      escapeCSVField(timeStr),
      escapeCSVField(exp.amount),
      escapeCSVField(exp.category),
      escapeCSVField(exp.merchant || ''),
      escapeCSVField(exp.note || ''),
      escapeCSVField(accountName),
    ];

    rows.push(row.join(','));
  }

  const csvContent = rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const defaultFilename = `savemoney_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename || defaultFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, count: filtered.length };
}

/**
 * Gathers all user data and triggers a full JSON backup download
 */
export async function exportAllDataToJSON(userId?: string): Promise<{ success: boolean }> {
  try {
    const [allExpenses, accounts, categories, alerts, alertSettings] = await Promise.all([
      StorageService.getAllExpenses(userId),
      StorageService.getAccounts(userId),
      StorageService.getCategories(userId),
      StorageService.getAlerts(userId),
      StorageService.getAlertSettings(userId),
    ]);

    // Gather local storage budgets and fixed expenses if available
    const backupBudgets: Record<string, unknown> = {};
    const backupFixedExpenses: Record<string, unknown> = {};

    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('savemoney_budget_')) {
          const month = key.replace('savemoney_budget_', '');
          try {
            backupBudgets[month] = JSON.parse(localStorage.getItem(key) || '{}');
          } catch {}
        } else if (key?.startsWith('savemoney_fixed_expenses_')) {
          const month = key.replace('savemoney_fixed_expenses_', '');
          try {
            backupFixedExpenses[month] = JSON.parse(localStorage.getItem(key) || '[]');
          } catch {}
        }
      }
    }

    const backupData = {
      app: 'SaveMoney',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: userId || 'local-user',
      },
      summary: {
        expensesCount: allExpenses.length,
        accountsCount: accounts.length,
        categoriesCount: categories.length,
        alertsCount: alerts.length,
      },
      data: {
        expenses: allExpenses,
        accounts,
        categories,
        alerts,
        alertSettings,
        budgets: backupBudgets,
        fixedExpenses: backupFixedExpenses,
      },
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const defaultFilename = `savemoney_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', defaultFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (err) {
    console.error('Failed to export all data:', err);
    throw err;
  }
}
