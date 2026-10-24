import { createClient, isSupabaseConfigured } from './supabase/client';
import {
  MonthlyBudget,
  FixedExpense,
  Expense,
  Account,
  Category,
  UserProfile,
  AlertItem,
  UserAlertSettings,
  PushSubscriptionItem,
  ExtraMoneyEntry,
  ExtraMoneyTransfer,
  BalanceAdjustment,
  ExtraMoneyPool,
  ReconciliationRecord,
  DailyCheckInStatus,
  BankStatementMapping,
} from './types';
import { getCurrentMonthKey } from './formatters';
import { DEFAULT_ALERT_SETTINGS } from './alertsEngine';

const STORAGE_KEYS = {
  BUDGET: 'savemoney_budget_',
  FIXED_EXPENSES: 'savemoney_fixed_expenses_',
  EXPENSES: 'savemoney_expenses_',
  PROFILE: 'savemoney_profile',
  DEMO_MODE: 'savemoney_is_demo',
  ALERTS: 'savemoney_alerts',
  ALERT_SETTINGS: 'savemoney_alert_settings',
  PUSH_SUBSCRIPTIONS: 'savemoney_push_subs',
  ACCOUNTS: 'savemoney_accounts',
  EXTRA_MONEY_ENTRIES: 'savemoney_extra_money_entries',
  EXTRA_MONEY_TRANSFERS: 'savemoney_extra_money_transfers',
  BALANCE_ADJUSTMENTS: 'savemoney_balance_adjustments',
  RECONCILIATION_HISTORY: 'savemoney_reconciliations',
  STATEMENT_MAPPINGS: 'savemoney_statement_mappings',
  DAILY_CHECKIN: 'savemoney_daily_checkin',
  LAST_AUTO_CAPTURE: 'savemoney_last_auto_capture',
};

const memoryFallback: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      return window.localStorage.getItem(key);
    } catch {}
  }
  return memoryFallback[key] || null;
}

function safeSetItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }
  memoryFallback[key] = value;
}

function safeRemoveItem(key: string): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
  delete memoryFallback[key];
}

export interface MonthSpendingSummary {
  expenses: Expense[];
  spentSoFarThisMonth: number;
  spentToday: number;
  spentThisWeek: number;
  dailySpending: { date: string; dayNumber: number; amount: number }[];
}

export class StorageService {
  /**
   * Resets the in-memory fallback store (useful in test suites)
   */
  static clearMemoryStore(): void {
    for (const key of Object.keys(memoryFallback)) {
      delete memoryFallback[key];
    }
  }

  /**
   * Loads monthly budget for a specific month (e.g. '2026-10')
   * Strictly returns null if no budget has been configured yet by the user!
   */
  static async getMonthlyBudget(
    month: string = getCurrentMonthKey(),
    userId?: string
  ): Promise<{
    budget: MonthlyBudget | null;
    isFromDemo: boolean;
  }> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('monthly_budgets')
          .select('*')
          .eq('user_id', userId)
          .eq('month', month)
          .maybeSingle();

        if (error) {
          console.error('Supabase getMonthlyBudget error:', error);
        } else if (data) {
          return {
            budget: {
              id: data.id,
              user_id: data.user_id,
              month: data.month,
              income: Number(data.income) || 0,
              savings_target: Number(data.savings_target) || 0,
              created_at: data.created_at,
              updated_at: data.updated_at,
            },
            isFromDemo: false,
          };
        } else {
          // No budget configured yet for this month
          return { budget: null, isFromDemo: false };
        }
      } catch (err) {
        console.warn('Supabase fetch failed, checking local storage', err);
      }
    }

    // LocalStorage fallback (only returns what user saved, never fake data)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`${STORAGE_KEYS.BUDGET}${month}`);
      if (stored) {
        try {
          return { budget: JSON.parse(stored), isFromDemo: true };
        } catch {}
      }
    }

    return { budget: null, isFromDemo: !canUseSupabase };
  }

  /**
   * Saves or updates monthly budget
   */
  static async saveMonthlyBudget(
    month: string,
    income: number,
    savingsTarget: number,
    userId?: string
  ): Promise<MonthlyBudget> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      const payload = {
        user_id: userId,
        month,
        income,
        savings_target: savingsTarget,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('monthly_budgets')
        .upsert(payload, { onConflict: 'user_id,month' })
        .select()
        .single();

      if (error) {
        console.error('Supabase saveMonthlyBudget error:', error);
        throw error;
      }

      const budget: MonthlyBudget = {
        id: data.id,
        user_id: data.user_id,
        month: data.month,
        income: Number(data.income),
        savings_target: Number(data.savings_target),
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEYS.BUDGET}${month}`, JSON.stringify(budget));
      }

      return budget;
    }

    // LocalStorage mode
    const budget: MonthlyBudget = {
      id: 'budget-' + month,
      user_id: userId || 'local-user',
      month,
      income,
      savings_target: savingsTarget,
      updated_at: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEYS.BUDGET}${month}`, JSON.stringify(budget));
    }

    return budget;
  }

  /**
   * Loads fixed expenses for a given month
   * Strictly returns [] if no fixed expenses have been added by the user!
   */
  static async getFixedExpenses(
    month: string = getCurrentMonthKey(),
    userId?: string
  ): Promise<FixedExpense[]> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('fixed_expenses')
          .select('*')
          .eq('user_id', userId)
          .eq('month', month)
          .order('amount', { ascending: false });

        if (!error && data) {
          return data.map((item) => ({
            id: item.id,
            user_id: item.user_id,
            month: item.month,
            title: item.title,
            amount: Number(item.amount),
            category: item.category,
            due_day: item.due_day,
            is_paid: item.is_paid,
            created_at: item.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase fixed_expenses fetch error:', err);
      }
    }

    // LocalStorage fallback
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`${STORAGE_KEYS.FIXED_EXPENSES}${month}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }

    // Default to clean empty list
    return [];
  }

  /**
   * Adds or updates a fixed expense
   */
  static async upsertFixedExpense(
    expense: Omit<FixedExpense, 'id'> & { id?: string },
    userId?: string
  ): Promise<FixedExpense> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const finalId = expense.id || `fe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const record: FixedExpense = {
      id: finalId,
      user_id: userId || 'local-user',
      month: expense.month,
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      due_day: expense.due_day,
      is_paid: expense.is_paid || false,
      created_at: new Date().toISOString(),
    };

    if (canUseSupabase) {
      const { data, error } = await supabase
        .from('fixed_expenses')
        .upsert(
          expense.id
            ? { ...record, id: expense.id }
            : {
                user_id: userId,
                month: expense.month,
                title: expense.title,
                amount: expense.amount,
                category: expense.category,
                due_day: expense.due_day,
                is_paid: expense.is_paid || false,
              }
        )
        .select()
        .single();

      if (error) {
        console.error('Failed to upsert fixed expense:', error);
        throw error;
      }
      return {
        id: data.id,
        user_id: data.user_id,
        month: data.month,
        title: data.title,
        amount: Number(data.amount),
        category: data.category,
        due_day: data.due_day,
        is_paid: data.is_paid,
        created_at: data.created_at,
      };
    }

    // Local storage
    if (typeof window !== 'undefined') {
      const currentList = await this.getFixedExpenses(expense.month, userId);
      const index = currentList.findIndex((item) => item.id === record.id);
      let updatedList: FixedExpense[];
      if (index >= 0) {
        updatedList = [...currentList];
        updatedList[index] = record;
      } else {
        updatedList = [record, ...currentList];
      }
      localStorage.setItem(`${STORAGE_KEYS.FIXED_EXPENSES}${expense.month}`, JSON.stringify(updatedList));
    }

    return record;
  }

  /**
   * Deletes a fixed expense
   */
  static async deleteFixedExpense(id: string, month: string, userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      const { error } = await supabase
        .from('fixed_expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    }

    if (typeof window !== 'undefined') {
      const currentList = await this.getFixedExpenses(month, userId);
      const filtered = currentList.filter((item) => item.id !== id);
      localStorage.setItem(`${STORAGE_KEYS.FIXED_EXPENSES}${month}`, JSON.stringify(filtered));
    }
  }

  /**
   * Loads real expenses for a given month and computes exact spending aggregates.
   * Strictly returns 0s and empty lists when no real expenses exist!
   */
  static async getMonthSpendingSummary(
    month: string = getCurrentMonthKey(),
    userId?: string
  ): Promise<MonthSpendingSummary> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    let realExpenses: Expense[] = [];

    if (canUseSupabase) {
      try {
        const [yearStr, monthStr] = month.split('-');
        const startDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1).toISOString();
        const endDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0, 23, 59, 59, 999).toISOString();

        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        if (!error && data) {
          realExpenses = data.map((e) => ({
            id: e.id,
            user_id: e.user_id,
            account_id: e.account_id || null,
            amount: Number(e.amount) || 0,
            category: e.category,
            note: e.note,
            merchant: e.merchant,
            date: e.date,
            created_at: e.created_at,
          }));
        }
      } catch (err) {
        console.warn('Error fetching expenses from Supabase:', err);
      }
    } else {
      const stored = safeGetItem(`${STORAGE_KEYS.EXPENSES}${month}`);
      if (stored) {
        try {
          realExpenses = JSON.parse(stored);
        } catch {}
      }
    }

    // Now calculate exact aggregations based on real data
    const now = new Date();
    const todayString = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let spentSoFarThisMonth = 0;
    let spentToday = 0;
    let spentThisWeek = 0;

    const dailyMap: { [day: number]: number } = {};

    for (const exp of realExpenses) {
      const amt = Number(exp.amount) || 0;
      spentSoFarThisMonth += amt;

      const expDate = new Date(exp.date);
      if (exp.date.slice(0, 10) === todayString) {
        spentToday += amt;
      }
      if (expDate >= sevenDaysAgo && expDate <= now) {
        spentThisWeek += amt;
      }

      const dayNum = expDate.getDate();
      dailyMap[dayNum] = (dailyMap[dayNum] || 0) + amt;
    }

    // Build daily spending series for the month
    const [yearNum, monthNum] = month.split('-').map(Number);
    const totalDaysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const dailySpending: { date: string; dayNumber: number; amount: number }[] = [];

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateLabel = `${String(day).padStart(2, '0')} ${now.toLocaleString('en-IN', { month: 'short' })}`;
      dailySpending.push({
        date: dateLabel,
        dayNumber: day,
        amount: dailyMap[day] || 0,
      });
    }

    return {
      expenses: realExpenses,
      spentSoFarThisMonth,
      spentToday,
      spentThisWeek,
      dailySpending,
    };
  }

  /**
   * Adds a new expense (with Supabase RLS)
   */
  static async addExpense(
    expense: Omit<Expense, 'id'>,
    userId?: string
  ): Promise<Expense> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const finalId = `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newExpense: Expense = {
      ...expense,
      id: finalId,
      user_id: userId || 'local-user',
      source: expense.source || 'manual',
      created_at: new Date().toISOString(),
    };

    if (newExpense.source === 'sms' || newExpense.source === 'notification') {
      this.recordAutoCapture(newExpense.date, userId);
    }

    if (canUseSupabase) {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          user_id: userId,
          account_id: newExpense.account_id || null,
          amount: newExpense.amount,
          category: newExpense.category,
          note: newExpense.note || null,
          merchant: newExpense.merchant || null,
          date: newExpense.date || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase addExpense error:', error);
        throw error;
      }

      return {
        id: data.id,
        user_id: data.user_id,
        account_id: data.account_id || null,
        amount: Number(data.amount),
        category: data.category,
        note: data.note,
        merchant: data.merchant,
        date: data.date,
        source: newExpense.source,
        created_at: data.created_at,
      };
    }

    // LocalStorage fallback
    const month = expense.date ? expense.date.slice(0, 7) : getCurrentMonthKey();
    const current = await this.getMonthExpenses(month, userId);
    const updated = [newExpense, ...current];
    safeSetItem(`${STORAGE_KEYS.EXPENSES}${month}`, JSON.stringify(updated));

    return newExpense;
  }

  /**
   * Updates an existing expense
   */
  static async updateExpense(expense: Expense, userId?: string): Promise<Expense> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          account_id: expense.account_id || null,
          amount: expense.amount,
          category: expense.category,
          note: expense.note || null,
          merchant: expense.merchant || null,
          date: expense.date,
        })
        .eq('id', expense.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Supabase updateExpense error:', error);
        throw error;
      }

      return {
        id: data.id,
        user_id: data.user_id,
        account_id: data.account_id || null,
        amount: Number(data.amount),
        category: data.category,
        note: data.note,
        merchant: data.merchant,
        date: data.date,
        created_at: data.created_at,
      };
    }

    // LocalStorage
    if (typeof window !== 'undefined') {
      const month = expense.date ? expense.date.slice(0, 7) : getCurrentMonthKey();
      const current = await this.getMonthExpenses(month, userId);
      const updated = current.map((e) => (e.id === expense.id ? expense : e));
      localStorage.setItem(`${STORAGE_KEYS.EXPENSES}${month}`, JSON.stringify(updated));
    }

    return expense;
  }

  /**
   * Deletes an expense
   */
  static async deleteExpense(id: string, date?: string, userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase deleteExpense error:', error);
        throw error;
      }
    }

    if (typeof window !== 'undefined') {
      const month = date ? date.slice(0, 7) : getCurrentMonthKey();
      const current = await this.getMonthExpenses(month, userId);
      const filtered = current.filter((e) => e.id !== id);
      localStorage.setItem(`${STORAGE_KEYS.EXPENSES}${month}`, JSON.stringify(filtered));
    }
  }

  /**
   * Helper to get raw expenses for a specific month
   */
  static async getMonthExpenses(month: string, userId?: string): Promise<Expense[]> {
    const summary = await this.getMonthSpendingSummary(month, userId);
    return summary.expenses;
  }

  /**
   * Loads all recorded expenses across all months (for multi-range charts and totals)
   */
  static async getAllExpenses(userId?: string): Promise<Expense[]> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .order('date', { ascending: false });

        if (!error && data) {
          return data.map((item) => ({
            id: item.id,
            user_id: item.user_id,
            account_id: item.account_id || null,
            amount: Number(item.amount),
            category: item.category,
            note: item.note,
            merchant: item.merchant,
            date: item.date,
            created_at: item.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase getAllExpenses error, falling back to local storage:', err);
      }
    }

    // LocalStorage fallback: collect all keys starting with STORAGE_KEYS.EXPENSES
    const all: Expense[] = [];
    const prefix = STORAGE_KEYS.EXPENSES;

    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) all.push(...parsed);
            }
          } catch {}
        }
      }
    }

    for (const key of Object.keys(memoryFallback)) {
      if (key.startsWith(prefix)) {
        try {
          const raw = memoryFallback[key];
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) all.push(...parsed);
          }
        } catch {}
      }
    }

    // Deduplicate by id if same expense in both
    const idMap = new Map<string, Expense>();
    for (const item of all) {
      if (!idMap.has(item.id)) {
        idMap.set(item.id, item);
      }
    }

    return Array.from(idMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  /**
   * Helper to deduplicate categories by lowercase name
   */
  static deduplicateCategories(cats: Category[]): { unique: Category[]; duplicateIds: string[] } {
    const map = new Map<string, Category>();
    const duplicateIds: string[] = [];

    for (const cat of cats) {
      if (!cat || !cat.name) continue;
      const key = cat.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, cat);
      } else {
        const existing = map.get(key)!;
        // Prefer user-customized category over global default (null user_id)
        if (!existing.user_id && cat.user_id) {
          duplicateIds.push(existing.id);
          map.set(key, cat);
        } else {
          duplicateIds.push(cat.id);
        }
      }
    }

    return { unique: Array.from(map.values()), duplicateIds };
  }

  /**
   * Loads all categories (defaults + user custom categories, guaranteed deduplicated)
   */
  static async getCategories(userId?: string): Promise<Category[]> {
    const defaultCategories: Category[] = [
      { id: 'cat-1', name: 'Food', icon: 'Utensils', color: '#F7931A' },
      { id: 'cat-2', name: 'Travel', icon: 'Car', color: '#3B82F6' },
      { id: 'cat-3', name: 'Shopping', icon: 'ShoppingBag', color: '#EC4899' },
      { id: 'cat-4', name: 'Bills', icon: 'FileText', color: '#EAB308' },
      { id: 'cat-5', name: 'Entertainment', icon: 'Film', color: '#8B5CF6' },
      { id: 'cat-6', name: 'Health', icon: 'HeartPulse', color: '#10B981' },
      { id: 'cat-7', name: 'Other', icon: 'MoreHorizontal', color: '#64748B' },
    ];

    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured();

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name');

        if (!error && data && data.length > 0) {
          const { unique, duplicateIds } = this.deduplicateCategories(data);

          // Clean up duplicate rows in Supabase in background
          if (duplicateIds.length > 0) {
            supabase
              .from('categories')
              .delete()
              .in('id', duplicateIds)
              .then(({ error: delErr }) => {
                if (delErr) console.warn('Note on duplicate category cleanup:', delErr);
              });
          }

          // Sync deduplicated list to localStorage as offline mirror
          if (typeof window !== 'undefined') {
            localStorage.setItem('savemoney_categories', JSON.stringify(unique));
          }
          return unique;
        }
      } catch (err) {
        console.warn('Error fetching categories from Supabase:', err);
      }
    }

    // LocalStorage fallback
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('savemoney_categories');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const { unique } = this.deduplicateCategories(parsed);
            localStorage.setItem('savemoney_categories', JSON.stringify(unique));
            return unique;
          }
        } catch {}
      }
      // Initialize local storage with defaults if not present
      localStorage.setItem('savemoney_categories', JSON.stringify(defaultCategories));
    }

    return defaultCategories;
  }

  /**
   * Creates a custom category in Supabase with localStorage sync
   */
  static async createCategory(
    category: { name: string; icon?: string; color?: string },
    userId?: string
  ): Promise<Category> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const finalId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newCat: Category = {
      id: finalId,
      user_id: userId || 'local-user',
      name: category.name.trim(),
      icon: category.icon || 'Tag',
      color: category.color || '#F7931A',
      created_at: new Date().toISOString(),
    };

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .insert({
            user_id: userId,
            name: newCat.name,
            icon: newCat.icon,
            color: newCat.color,
          })
          .select()
          .single();

        if (error) {
          console.warn('Supabase createCategory error, saving to local fallback:', error);
        } else if (data) {
          if (typeof window !== 'undefined') {
            const current = await this.getCategories(userId);
            const exists = current.some((c) => c.id === data.id);
            const updated = exists ? current : [...current, data];
            localStorage.setItem('savemoney_categories', JSON.stringify(updated));
          }
          return data;
        }
      } catch (err) {
        console.warn('Supabase createCategory exception:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const current = await this.getCategories(userId);
      const updated = [...current, newCat];
      localStorage.setItem('savemoney_categories', JSON.stringify(updated));
    }

    return newCat;
  }

  /**
   * Updates an existing category
   */
  static async updateCategory(
    id: string,
    updates: { name: string; color?: string; icon?: string },
    userId?: string
  ): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { error } = await supabase
          .from('categories')
          .update({
            name: updates.name.trim(),
            color: updates.color,
            icon: updates.icon,
          })
          .eq('id', id);

        if (error) {
          console.warn('Supabase updateCategory error:', error);
        }
      } catch (err) {
        console.warn('Supabase updateCategory exception:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const current = await this.getCategories(userId);
      const updated = current.map((c) => (c.id === id ? { ...c, ...updates, name: updates.name.trim() } : c));
      localStorage.setItem('savemoney_categories', JSON.stringify(updated));
    }
  }

  /**
   * Deletes a category
   */
  static async deleteCategory(id: string, userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn('Supabase deleteCategory error:', error);
        }
      } catch (err) {
        console.warn('Supabase deleteCategory exception:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const current = await this.getCategories(userId);
      const updated = current.filter((c) => c.id !== id);
      localStorage.setItem('savemoney_categories', JSON.stringify(updated));
    }
  }

  /**
   * Loads all in-app alerts for user
   */
  static async getAlerts(userId?: string): Promise<AlertItem[]> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(data));
          }
          return data;
        }
      } catch (err) {
        console.warn('Supabase getAlerts error, falling back to local:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.ALERTS);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }

    return [];
  }

  /**
   * Saves a new alert
   */
  static async saveAlert(
    alert: Omit<AlertItem, 'id'>,
    userId?: string
  ): Promise<AlertItem> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const finalId = `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newAlert: AlertItem = {
      ...alert,
      id: finalId,
      user_id: userId || 'local-user',
      created_at: alert.created_at || new Date().toISOString(),
    };

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .insert({
            user_id: userId,
            type: newAlert.type,
            severity: newAlert.severity,
            message: newAlert.message,
            is_read: newAlert.is_read || false,
            month: newAlert.month,
            dedupe_key: newAlert.dedupe_key || null,
          })
          .select()
          .single();

        if (!error && data) {
          if (typeof window !== 'undefined') {
            const current = await this.getAlerts(userId);
            localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify([data, ...current]));
          }
          return data;
        }
      } catch (err) {
        console.warn('Supabase saveAlert error, saving to local:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const current = await this.getAlerts(userId);
      const updated = [newAlert, ...current];
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(updated));
    }

    return newAlert;
  }

  /**
   * Marks a single alert as read
   */
  static async markAlertAsRead(id: string, userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        await supabase
          .from('alerts')
          .update({ is_read: true })
          .eq('id', id)
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase markAlertAsRead error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const current = await this.getAlerts(userId);
      const updated = current.map((a) => (a.id === id ? { ...a, is_read: true } : a));
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(updated));
    }
  }

  /**
   * Marks all alerts as read
   */
  static async markAllAlertsAsRead(userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        await supabase
          .from('alerts')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('is_read', false);
      } catch (err) {
        console.warn('Supabase markAllAlertsAsRead error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const current = await this.getAlerts(userId);
      const updated = current.map((a) => ({ ...a, is_read: true }));
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(updated));
    }
  }

  /**
   * Clears/deletes all alerts
   */
  static async clearAlerts(userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        await supabase
          .from('alerts')
          .delete()
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase clearAlerts error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.ALERTS);
    }
  }

  /**
   * Loads user alert preferences
   */
  static async getAlertSettings(userId?: string): Promise<UserAlertSettings> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('user_alert_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data) {
          const settings: UserAlertSettings = {
            overDaily: data.over_daily ?? DEFAULT_ALERT_SETTINGS.overDaily,
            underDaily: data.under_daily ?? DEFAULT_ALERT_SETTINGS.underDaily,
            budgetThresholds: data.budget_thresholds ?? DEFAULT_ALERT_SETTINGS.budgetThresholds,
            thresholds: data.thresholds || DEFAULT_ALERT_SETTINGS.thresholds,
            projectionWarning: data.projection_warning ?? DEFAULT_ALERT_SETTINGS.projectionWarning,
            savingsAtRisk: data.savings_at_risk ?? DEFAULT_ALERT_SETTINGS.savingsAtRisk,
            pushNotifications: data.push_notifications ?? DEFAULT_ALERT_SETTINGS.pushNotifications,
          };
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.ALERT_SETTINGS, JSON.stringify(settings));
          }
          return settings;
        }
      } catch (err) {
        console.warn('Supabase getAlertSettings error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.ALERT_SETTINGS);
      if (stored) {
        try {
          return { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(stored) };
        } catch {}
      }
    }

    return DEFAULT_ALERT_SETTINGS;
  }

  /**
   * Saves user alert preferences
   */
  static async saveAlertSettings(
    settings: UserAlertSettings,
    userId?: string
  ): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        await supabase
          .from('user_alert_settings')
          .upsert({
            user_id: userId,
            over_daily: settings.overDaily,
            under_daily: settings.underDaily,
            budget_thresholds: settings.budgetThresholds,
            thresholds: settings.thresholds,
            projection_warning: settings.projectionWarning,
            savings_at_risk: settings.savingsAtRisk,
            push_notifications: settings.pushNotifications,
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn('Supabase saveAlertSettings error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ALERT_SETTINGS, JSON.stringify(settings));
    }
  }

  /**
   * Saves browser push subscription
   */
  static async savePushSubscription(
    sub: PushSubscriptionItem,
    userId?: string
  ): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        await supabase
          .from('push_subscriptions')
          .upsert(
            {
              user_id: userId,
              endpoint: sub.endpoint,
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
            { onConflict: 'user_id,endpoint' }
          );
      } catch (err) {
        console.warn('Supabase savePushSubscription error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.PUSH_SUBSCRIPTIONS, JSON.stringify(sub));
    }
  }

  /**
   * Deletes push subscription
   */
  static async deletePushSubscription(endpoint: string, userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint)
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase deletePushSubscription error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.PUSH_SUBSCRIPTIONS);
    }
  }

  /**
   * Retrieves push subscriptions for user
   */
  static async getPushSubscriptions(userId?: string): Promise<PushSubscriptionItem[]> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId);

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase getPushSubscriptions error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.PUSH_SUBSCRIPTIONS);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {}
      }
    }

    return [];
  }

  /**
   * ==========================================
   * ACCOUNTS MANAGEMENT (Stage: Accounts)
   * ==========================================
   */

  /**
   * Loads all user accounts (Bank accounts, Credit cards, UPI apps, Cash)
   */
  static async getAccounts(userId?: string): Promise<Account[]> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          const accounts: Account[] = data.map((item) => ({
            id: item.id,
            user_id: item.user_id,
            nickname: item.nickname,
            type: item.type,
            bank_or_app_name: item.bank_or_app_name || undefined,
            last_4_digits: item.last_4_digits || undefined,
            color: item.color || undefined,
            icon: item.icon || undefined,
            credit_limit: item.credit_limit !== null ? Number(item.credit_limit) : undefined,
            billing_date: item.billing_date !== null ? Number(item.billing_date) : undefined,
            opening_balance: item.opening_balance !== null ? Number(item.opening_balance) : undefined,
            created_at: item.created_at,
            updated_at: item.updated_at,
          }));

          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
          }
          return accounts;
        }
      } catch (err) {
        console.warn('Supabase getAccounts error, falling back to localStorage:', err);
      }
    }

    // LocalStorage fallback
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }

    return [];
  }

  /**
   * Adds a new user account
   */
  static async addAccount(
    account: Omit<Account, 'id' | 'created_at'>,
    userId?: string
  ): Promise<Account> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const finalId = `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newAccount: Account = {
      ...account,
      id: finalId,
      user_id: userId || 'local-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (canUseSupabase) {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          user_id: userId,
          nickname: account.nickname,
          type: account.type,
          bank_or_app_name: account.bank_or_app_name || null,
          last_4_digits: account.last_4_digits || null,
          color: account.color || null,
          icon: account.icon || null,
          credit_limit: account.credit_limit ?? null,
          billing_date: account.billing_date ?? null,
          opening_balance: account.opening_balance ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase addAccount error:', error);
        throw error;
      }

      const created: Account = {
        id: data.id,
        user_id: data.user_id,
        nickname: data.nickname,
        type: data.type,
        bank_or_app_name: data.bank_or_app_name || undefined,
        last_4_digits: data.last_4_digits || undefined,
        color: data.color || undefined,
        icon: data.icon || undefined,
        credit_limit: data.credit_limit !== null ? Number(data.credit_limit) : undefined,
        billing_date: data.billing_date !== null ? Number(data.billing_date) : undefined,
        opening_balance: data.opening_balance !== null ? Number(data.opening_balance) : undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      if (typeof window !== 'undefined') {
        const current = await this.getAccounts(userId);
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify([...current, created]));
      }

      return created;
    }

    // LocalStorage fallback
    if (typeof window !== 'undefined') {
      const current = await this.getAccounts(userId);
      const updated = [...current, newAccount];
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
    }

    return newAccount;
  }

  /**
   * Updates an existing account
   */
  static async updateAccount(account: Account, userId?: string): Promise<Account> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      const { data, error } = await supabase
        .from('accounts')
        .update({
          nickname: account.nickname,
          type: account.type,
          bank_or_app_name: account.bank_or_app_name || null,
          last_4_digits: account.last_4_digits || null,
          color: account.color || null,
          icon: account.icon || null,
          credit_limit: account.credit_limit ?? null,
          billing_date: account.billing_date ?? null,
          opening_balance: account.opening_balance ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Supabase updateAccount error:', error);
        throw error;
      }

      const updatedAccount: Account = {
        id: data.id,
        user_id: data.user_id,
        nickname: data.nickname,
        type: data.type,
        bank_or_app_name: data.bank_or_app_name || undefined,
        last_4_digits: data.last_4_digits || undefined,
        color: data.color || undefined,
        icon: data.icon || undefined,
        credit_limit: data.credit_limit !== null ? Number(data.credit_limit) : undefined,
        billing_date: data.billing_date !== null ? Number(data.billing_date) : undefined,
        opening_balance: data.opening_balance !== null ? Number(data.opening_balance) : undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      if (typeof window !== 'undefined') {
        const current = await this.getAccounts(userId);
        const mapped = current.map((a) => (a.id === account.id ? updatedAccount : a));
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(mapped));
      }

      return updatedAccount;
    }

    // LocalStorage fallback
    if (typeof window !== 'undefined') {
      const current = await this.getAccounts(userId);
      const updated = current.map((a) => (a.id === account.id ? { ...account, updated_at: new Date().toISOString() } : a));
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
    }

    return account;
  }

  /**
   * Deletes an account (and dissociates linked expenses)
   */
  static async deleteAccount(id: string, userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase deleteAccount error:', error);
        throw error;
      }
    }

    if (typeof window !== 'undefined') {
      const current = await this.getAccounts(userId);
      const filtered = current.filter((a) => a.id !== id);
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(filtered));
    }
  }

  // ===========================================================================
  // EXTRA MONEY ENTRIES
  // ===========================================================================

  /**
   * Retrieves all extra money entries for a user
   */
  static async getExtraMoneyEntries(userId?: string): Promise<ExtraMoneyEntry[]> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('extra_money_entries')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            user_id: d.user_id,
            amount: Number(d.amount) || 0,
            source: d.source,
            date: d.date,
            note: d.note,
            created_at: d.created_at,
            updated_at: d.updated_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase getExtraMoneyEntries error:', err);
      }
    }

    const stored = safeGetItem(STORAGE_KEYS.EXTRA_MONEY_ENTRIES);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }

    return [];
  }

  /**
   * Adds an extra money entry
   */
  static async addExtraMoneyEntry(
    entry: Omit<ExtraMoneyEntry, 'id' | 'created_at' | 'updated_at'>,
    userId?: string
  ): Promise<ExtraMoneyEntry> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const finalId = `em-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const record: ExtraMoneyEntry = {
      id: finalId,
      user_id: userId || 'local-user',
      amount: Number(entry.amount),
      source: entry.source.trim(),
      date: entry.date || now,
      note: entry.note?.trim() || undefined,
      created_at: now,
      updated_at: now,
    };

    if (canUseSupabase) {
      const { data, error } = await supabase
        .from('extra_money_entries')
        .insert({
          user_id: userId,
          amount: record.amount,
          source: record.source,
          date: record.date,
          note: record.note,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase addExtraMoneyEntry error:', error);
        throw error;
      }

      record.id = data.id;
    }

    const current = await this.getExtraMoneyEntries(userId);
    const updated = [record, ...current.filter((e) => e.id !== record.id)];
    safeSetItem(STORAGE_KEYS.EXTRA_MONEY_ENTRIES, JSON.stringify(updated));

    return record;
  }

  /**
   * Updates an extra money entry
   */
  static async updateExtraMoneyEntry(
    entry: ExtraMoneyEntry,
    userId?: string
  ): Promise<ExtraMoneyEntry> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const now = new Date().toISOString();

    const current = await this.getExtraMoneyEntries(userId);
    const existing = current.find((e) => e.id === entry.id);

    const record: ExtraMoneyEntry = {
      ...(existing || {}),
      ...entry,
      amount: Number(entry.amount),
      source: entry.source.trim(),
      note: entry.note !== undefined ? entry.note?.trim() || undefined : existing?.note,
      updated_at: now,
    };

    if (canUseSupabase) {
      const { error } = await supabase
        .from('extra_money_entries')
        .update({
          amount: record.amount,
          source: record.source,
          date: record.date,
          note: record.note,
          updated_at: now,
        })
        .eq('id', record.id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase updateExtraMoneyEntry error:', error);
        throw error;
      }
    }

    const updated = current.map((e) => (e.id === record.id ? record : e));
    safeSetItem(STORAGE_KEYS.EXTRA_MONEY_ENTRIES, JSON.stringify(updated));

    return record;
  }

  /**
   * Deletes an extra money entry
   */
  static async deleteExtraMoneyEntry(id: string, userId?: string): Promise<void> {
    const pool = await this.getExtraMoneyPool(userId);
    const current = await this.getExtraMoneyEntries(userId);
    const target = current.find((e) => e.id === id);

    if (target && pool.availableExtraMoney - target.amount < 0) {
      throw new Error(
        `Cannot delete this extra money entry because ₹${pool.totalTransferred} has already been transferred to monthly budgets. Undo transfers first.`
      );
    }

    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      const { error } = await supabase
        .from('extra_money_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase deleteExtraMoneyEntry error:', error);
        throw error;
      }
    }

    const filtered = current.filter((e) => e.id !== id);
    safeSetItem(STORAGE_KEYS.EXTRA_MONEY_ENTRIES, JSON.stringify(filtered));
  }

  // ===========================================================================
  // EXTRA MONEY TRANSFERS ("Move to Balance")
  // ===========================================================================

  /**
   * Retrieves all extra money transfers for a user
   */
  static async getExtraMoneyTransfers(userId?: string): Promise<ExtraMoneyTransfer[]> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('extra_money_transfers')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            user_id: d.user_id,
            amount: Number(d.amount) || 0,
            date: d.date,
            month: d.month,
            note: d.note,
            created_at: d.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase getExtraMoneyTransfers error:', err);
      }
    }

    const stored = safeGetItem(STORAGE_KEYS.EXTRA_MONEY_TRANSFERS);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }

    return [];
  }

  /**
   * Retrieves extra money transfers moved into a specific month
   */
  static async getMonthExtraMoneyTransfers(
    month: string,
    userId?: string
  ): Promise<ExtraMoneyTransfer[]> {
    const all = await this.getExtraMoneyTransfers(userId);
    return all.filter((t) => t.month === month);
  }

  /**
   * Records a move from extra money pool to monthly spendable balance
   */
  static async addExtraMoneyTransfer(
    transfer: Omit<ExtraMoneyTransfer, 'id' | 'created_at'>,
    userId?: string
  ): Promise<ExtraMoneyTransfer> {
    const pool = await this.getExtraMoneyPool(userId);
    const numAmount = Number(transfer.amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Transfer amount must be greater than ₹0');
    }

    if (numAmount > pool.availableExtraMoney) {
      throw new Error(
        `Cannot transfer ₹${numAmount}. Only ₹${pool.availableExtraMoney} available in extra money pool.`
      );
    }

    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const finalId = `emt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const record: ExtraMoneyTransfer = {
      id: finalId,
      user_id: userId || 'local-user',
      amount: numAmount,
      date: transfer.date || now,
      month: transfer.month,
      note: transfer.note?.trim() || undefined,
      created_at: now,
    };

    if (canUseSupabase) {
      const { data, error } = await supabase
        .from('extra_money_transfers')
        .insert({
          user_id: userId,
          amount: record.amount,
          date: record.date,
          month: record.month,
          note: record.note,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase addExtraMoneyTransfer error:', error);
        throw error;
      }

      record.id = data.id;
    }

    const current = await this.getExtraMoneyTransfers(userId);
    const updated = [record, ...current];
    safeSetItem(STORAGE_KEYS.EXTRA_MONEY_TRANSFERS, JSON.stringify(updated));

    return record;
  }

  /**
   * Undoes a transfer, restoring the amount back into the extra money pool
   * and reducing the month's spendable budget back to normal.
   */
  static async undoExtraMoneyTransfer(id: string, userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      const { error } = await supabase
        .from('extra_money_transfers')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase undoExtraMoneyTransfer error:', error);
        throw error;
      }
    }

    const current = await this.getExtraMoneyTransfers(userId);
    const filtered = current.filter((t) => t.id !== id);
    safeSetItem(STORAGE_KEYS.EXTRA_MONEY_TRANSFERS, JSON.stringify(filtered));
  }

  // ===========================================================================
  // BALANCE ADJUSTMENTS (Direct add/subtract to month spendable budget)
  // ===========================================================================

  /**
   * Retrieves balance adjustments for a specific month or all adjustments
   */
  static async getBalanceAdjustments(
    month?: string,
    userId?: string
  ): Promise<BalanceAdjustment[]> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    let adjustments: BalanceAdjustment[] = [];

    if (canUseSupabase) {
      try {
        let query = supabase
          .from('balance_adjustments')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (month) {
          query = query.eq('month', month);
        }

        const { data, error } = await query;

        if (!error && data) {
          adjustments = data.map((d) => ({
            id: d.id,
            user_id: d.user_id,
            amount: Number(d.amount) || 0,
            reason: d.reason,
            date: d.date,
            month: d.month,
            created_at: d.created_at,
            updated_at: d.updated_at,
          }));
          return adjustments;
        }
      } catch (err) {
        console.warn('Supabase getBalanceAdjustments error:', err);
      }
    }

    const stored = safeGetItem(STORAGE_KEYS.BALANCE_ADJUSTMENTS);
    if (stored) {
      try {
        const parsed: BalanceAdjustment[] = JSON.parse(stored);
        return month ? parsed.filter((a) => a.month === month) : parsed;
      } catch {}
    }

    return [];
  }

  /**
   * Adds a balance adjustment
   */
  static async addBalanceAdjustment(
    adjustment: Omit<BalanceAdjustment, 'id' | 'created_at' | 'updated_at'>,
    userId?: string
  ): Promise<BalanceAdjustment> {
    const numAmount = Number(adjustment.amount);
    if (isNaN(numAmount) || numAmount === 0) {
      throw new Error('Adjustment amount cannot be zero');
    }
    if (!adjustment.reason?.trim()) {
      throw new Error('A reason is required for balance adjustment');
    }

    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const finalId = `adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const record: BalanceAdjustment = {
      id: finalId,
      user_id: userId || 'local-user',
      amount: numAmount,
      reason: adjustment.reason.trim(),
      date: adjustment.date || now,
      month: adjustment.month,
      created_at: now,
      updated_at: now,
    };

    if (canUseSupabase) {
      const { data, error } = await supabase
        .from('balance_adjustments')
        .insert({
          user_id: userId,
          amount: record.amount,
          reason: record.reason,
          date: record.date,
          month: record.month,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase addBalanceAdjustment error:', error);
        throw error;
      }

      record.id = data.id;
    }

    const current = await this.getBalanceAdjustments(undefined, userId);
    const updated = [record, ...current.filter((a) => a.id !== record.id)];
    safeSetItem(STORAGE_KEYS.BALANCE_ADJUSTMENTS, JSON.stringify(updated));

    return record;
  }

  /**
   * Updates an existing balance adjustment
   */
  static async updateBalanceAdjustment(
    adjustment: BalanceAdjustment,
    userId?: string
  ): Promise<BalanceAdjustment> {
    const numAmount = Number(adjustment.amount);
    if (isNaN(numAmount) || numAmount === 0) {
      throw new Error('Adjustment amount cannot be zero');
    }
    if (!adjustment.reason?.trim()) {
      throw new Error('A reason is required for balance adjustment');
    }

    const current = await this.getBalanceAdjustments(undefined, userId);
    const existing = current.find((a) => a.id === adjustment.id);

    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const now = new Date().toISOString();

    const record: BalanceAdjustment = {
      ...(existing || {}),
      ...adjustment,
      amount: numAmount,
      reason: adjustment.reason.trim(),
      month: adjustment.month || existing?.month || getCurrentMonthKey(),
      updated_at: now,
    };

    if (canUseSupabase) {
      const { error } = await supabase
        .from('balance_adjustments')
        .update({
          amount: record.amount,
          reason: record.reason,
          date: record.date,
          month: record.month,
          updated_at: now,
        })
        .eq('id', record.id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase updateBalanceAdjustment error:', error);
        throw error;
      }
    }

    const updated = current.map((a) => (a.id === record.id ? record : a));
    safeSetItem(STORAGE_KEYS.BALANCE_ADJUSTMENTS, JSON.stringify(updated));

    return record;
  }

  /**
   * Deletes a balance adjustment
   */
  static async deleteBalanceAdjustment(id: string, userId?: string): Promise<void> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      const { error } = await supabase
        .from('balance_adjustments')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase deleteBalanceAdjustment error:', error);
        throw error;
      }
    }

    const current = await this.getBalanceAdjustments(undefined, userId);
    const filtered = current.filter((a) => a.id !== id);
    safeSetItem(STORAGE_KEYS.BALANCE_ADJUSTMENTS, JSON.stringify(filtered));
  }

  // ===========================================================================
  // EXTRA MONEY POOL CALCULATION
  // Available extra money = total received - total already moved to balance.
  // Carries over across months until used.
  // ===========================================================================

  static async getExtraMoneyPool(userId?: string): Promise<ExtraMoneyPool> {
    const [entries, transfers] = await Promise.all([
      this.getExtraMoneyEntries(userId),
      this.getExtraMoneyTransfers(userId),
    ]);

    const totalReceived = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalTransferred = transfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const availableExtraMoney = Math.max(0, totalReceived - totalTransferred);

    return {
      totalReceived,
      totalTransferred,
      availableExtraMoney,
    };
  }

  // ===========================================================================
  // BALANCE RECONCILIATIONS
  // ===========================================================================

  static async getReconciliations(
    accountId?: string,
    userId?: string
  ): Promise<ReconciliationRecord[]> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;

    if (canUseSupabase) {
      try {
        let query = supabase
          .from('account_reconciliations')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (accountId) {
          query = query.eq('account_id', accountId);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            user_id: d.user_id,
            account_id: d.account_id,
            actual_balance: Number(d.actual_balance) || 0,
            estimated_balance: Number(d.estimated_balance) || 0,
            difference: Number(d.difference) || 0,
            resolved_method: d.resolved_method,
            note: d.note,
            date: d.date,
            created_at: d.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase getReconciliations error:', err);
      }
    }

    const stored = safeGetItem(STORAGE_KEYS.RECONCILIATION_HISTORY);
    if (stored) {
      try {
        const parsed: ReconciliationRecord[] = JSON.parse(stored);
        return accountId ? parsed.filter((r) => r.account_id === accountId) : parsed;
      } catch {}
    }

    return [];
  }

  static async addReconciliation(
    record: Omit<ReconciliationRecord, 'id' | 'created_at'>,
    userId?: string
  ): Promise<ReconciliationRecord> {
    const supabase = createClient();
    const canUseSupabase = isSupabaseConfigured() && userId;
    const finalId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const entry: ReconciliationRecord = {
      id: finalId,
      user_id: userId || 'local-user',
      account_id: record.account_id,
      actual_balance: Number(record.actual_balance) || 0,
      estimated_balance: Number(record.estimated_balance) || 0,
      difference: Number(record.difference) || 0,
      resolved_method: record.resolved_method || 'none',
      note: record.note?.trim() || undefined,
      date: record.date || now,
      created_at: now,
    };

    if (canUseSupabase) {
      try {
        const { data, error } = await supabase
          .from('account_reconciliations')
          .insert({
            user_id: userId,
            account_id: entry.account_id,
            actual_balance: entry.actual_balance,
            estimated_balance: entry.estimated_balance,
            difference: entry.difference,
            resolved_method: entry.resolved_method,
            note: entry.note,
            date: entry.date,
          })
          .select()
          .single();

        if (!error && data) {
          entry.id = data.id;
        }
      } catch (err) {
        console.warn('Supabase addReconciliation error:', err);
      }
    }

    const all = await this.getReconciliations(undefined, userId);
    const updated = [entry, ...all];
    safeSetItem(STORAGE_KEYS.RECONCILIATION_HISTORY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('savemoney-reconciliations-updated'));
    }

    return entry;
  }

  static async getLatestReconciliation(
    accountId: string,
    userId?: string
  ): Promise<ReconciliationRecord | null> {
    const list = await this.getReconciliations(accountId, userId);
    return list.length > 0 ? list[0] : null;
  }

  // ===========================================================================
  // DAILY CHECK-IN CONFIRMATIONS
  // ===========================================================================

  static async getDailyCheckInStatus(
    dateStr?: string,
    userId?: string
  ): Promise<DailyCheckInStatus | null> {
    const targetDate = dateStr || new Date().toISOString().slice(0, 10);
    const stored = safeGetItem(`${STORAGE_KEYS.DAILY_CHECKIN}_${targetDate}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return null;
  }

  static async confirmDailyCheckIn(
    dateStr: string,
    type: 'nothing_missed' | 'zero_spend_confirmed',
    userId?: string
  ): Promise<DailyCheckInStatus> {
    const status: DailyCheckInStatus = {
      date: dateStr,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      type,
    };

    safeSetItem(`${STORAGE_KEYS.DAILY_CHECKIN}_${dateStr}`, JSON.stringify(status));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('savemoney-checkin-updated'));
    }

    return status;
  }

  // ===========================================================================
  // STATEMENT COLUMN MAPPINGS (Saved per bank)
  // ===========================================================================

  static async getStatementMappings(): Promise<BankStatementMapping[]> {
    const defaultPresets: BankStatementMapping[] = [
      {
        id: 'hdfc-default',
        bankName: 'HDFC Bank',
        dateCol: 'Date',
        descCol: 'Narration',
        debitCol: 'Withdrawal Amount',
        creditCol: 'Deposit Amount',
        dateFormat: 'DD/MM/YYYY',
      },
      {
        id: 'icici-default',
        bankName: 'ICICI Bank',
        dateCol: 'Transaction Date',
        descCol: 'Description',
        debitCol: 'Debit',
        creditCol: 'Credit',
        dateFormat: 'DD/MM/YYYY',
      },
      {
        id: 'sbi-default',
        bankName: 'SBI',
        dateCol: 'Txn Date',
        descCol: 'Description',
        debitCol: 'Debit',
        creditCol: 'Credit',
        dateFormat: 'DD-MMM-YYYY',
      },
      {
        id: 'standard-csv',
        bankName: 'Standard CSV',
        dateCol: 'Date',
        descCol: 'Description',
        debitCol: 'Debit',
        creditCol: 'Credit',
      },
    ];

    const stored = safeGetItem(STORAGE_KEYS.STATEMENT_MAPPINGS);
    if (stored) {
      try {
        const saved: BankStatementMapping[] = JSON.parse(stored);
        // Merge saved mappings with defaults (saved takes precedence by bankName)
        const savedNames = new Set(saved.map((m) => m.bankName.toLowerCase()));
        return [...saved, ...defaultPresets.filter((d) => !savedNames.has(d.bankName.toLowerCase()))];
      } catch {}
    }

    return defaultPresets;
  }

  static async saveStatementMapping(mapping: BankStatementMapping): Promise<void> {
    const existing = await this.getStatementMappings();
    const updated = [
      mapping,
      ...existing.filter((m) => m.bankName.toLowerCase() !== mapping.bankName.toLowerCase() && m.id !== mapping.id),
    ];
    safeSetItem(STORAGE_KEYS.STATEMENT_MAPPINGS, JSON.stringify(updated));
  }

  // ===========================================================================
  // AUTO-CAPTURE TRACKING (Capture Health)
  // ===========================================================================

  static async getLastAutoCaptureTime(userId?: string): Promise<string | null> {
    return safeGetItem(STORAGE_KEYS.LAST_AUTO_CAPTURE);
  }

  static async recordAutoCapture(timestamp?: string, userId?: string): Promise<void> {
    const ts = timestamp || new Date().toISOString();
    safeSetItem(STORAGE_KEYS.LAST_AUTO_CAPTURE, ts);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('savemoney-capture-health-updated'));
    }
  }
}



