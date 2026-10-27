export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  currency: string;
  avatar_url?: string;
}

export interface MonthlyBudget {
  id: string;
  user_id: string;
  month: string; // 'YYYY-MM'
  income: number;
  savings_target: number;
  created_at?: string;
  updated_at?: string;
}

export interface FixedExpense {
  id: string;
  user_id?: string;
  month: string; // 'YYYY-MM'
  title: string;
  amount: number;
  category: 'Rent' | 'EMI' | 'Subscription' | 'Bills' | 'Insurance' | 'Other';
  due_day?: number;
  is_paid?: boolean;
  created_at?: string;
}

export type AccountType = 'bank' | 'upi' | 'credit_card' | 'debit_card' | 'cash';

export interface Account {
  id: string;
  user_id?: string;
  nickname: string;
  type: AccountType;
  bank_or_app_name?: string;
  last_4_digits?: string; // digits only (e.g. '8910')
  color?: string;
  icon?: string;
  credit_limit?: number; // for credit_card
  billing_date?: number; // 1-31, day of month
  opening_balance?: number; // for bank and cash
  created_at?: string;
  updated_at?: string;
}

export interface Expense {
  id: string;
  user_id?: string;
  account_id?: string | null;
  amount: number;
  category: 'Food' | 'Travel' | 'Shopping' | 'Bills' | 'Entertainment' | 'Health' | 'Other' | string;
  note?: string;
  merchant?: string;
  date: string; // ISO string
  source?: 'manual' | 'sms' | 'notification' | 'import';
  external_id?: string;
  created_at?: string;
}

export interface Category {
  id: string;
  user_id?: string | null;
  name: string;
  icon?: string;
  color?: string;
  created_at?: string;
}

export interface BudgetCalculationResult {
  income: number;
  totalFixedExpenses: number;
  savingsTarget: number;
  extraTransfers: number; // Extra money moved into this month's budget
  balanceAdjustments: number; // Net manual adjustments for this month
  baseSpendableBudget: number; // income - fixedExpenses - savingsTarget
  spendableBudget: number; // income - fixedExpenses - savingsTarget + extraTransfers + balanceAdjustments
  savingsRatePercent: number; // (savingsTarget / income) * 100
  fixedExpensesPercent: number; // (totalFixedExpenses / income) * 100
  spendablePercent: number; // (spendableBudget / income) * 100
  isDeficit: boolean;
}

export interface SafeToSpendResult {
  spendableBudget: number;
  spentSoFar: number;
  spentToday: number;
  remainingBudget: number; // spendableBudget - spentSoFar
  daysLeftInMonth: number;
  dailyAllowanceForToday: number; // Daily benchmark budget for today
  safeToSpendRemainingToday: number; // dailyAllowanceForToday - spentToday (clamped at 0)
  safeToSpendToday: number; // Alias for safeToSpendRemainingToday
  isOverBudget: boolean; // Month's total budget exceeded
  isOverToday: boolean; // Spent more than today's daily allowance
  overTodayBy: number; // Amount over today's allowance
  overBudgetBy: number; // Amount over monthly spendable budget
  dailyBudgetBaseline: number; // spendableBudget / totalDays
}

export interface MonthEndProjectionResult {
  spentSoFar: number;
  daysPassed: number;
  totalDaysInMonth: number;
  averageDailySpend: number;
  projectedMonthEndSpend: number;
  spendableBudget: number;
  projectedDifference: number; // spendableBudget - projectedMonthEndSpend
  isProjectedOverBudget: boolean;
  projectedSurplusOrDeficit: number; // Math.abs(projectedDifference)
}

export interface TimeTabTotals {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
}

export interface CategorySpendingBreakdown {
  category: string;
  amount: number;
  percentage: number;
  color?: string;
  icon?: string;
  count: number;
}

export interface ChartDataPoint {
  date: string;
  fullDate: string;
  amount: number;
  safeLimit?: number;
}

export type AlertType =
  | 'over_daily'
  | 'under_daily'
  | 'threshold_50'
  | 'threshold_80'
  | 'threshold_100'
  | 'projection_warning'
  | 'savings_risk'
  | 'test';

export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface AlertItem {
  id: string;
  user_id?: string;
  type: AlertType;
  severity: AlertSeverity;
  title?: string;
  message: string;
  is_read: boolean;
  month: string; // 'YYYY-MM'
  dedupe_key?: string | null;
  push_sent_at?: string | null;
  push_error?: string | null;
  created_at: string;
}

export interface UserAlertSettings {
  overDaily: boolean;
  underDaily: boolean;
  budgetThresholds: boolean;
  thresholds: number[];
  projectionWarning: boolean;
  savingsAtRisk: boolean;
  pushNotifications: boolean;
  dailyCheckInEnabled?: boolean;
  dailyCheckInTime?: string; // e.g. "21:00" (default 9 PM)
  weeklyReconciliationReminder?: boolean;
}

export interface PushSubscriptionItem {
  id?: string;
  user_id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExtraMoneyEntry {
  id: string;
  user_id?: string;
  amount: number; // positive number > 0
  source: string; // free text e.g. "gift", "refund", "freelance"
  date: string; // ISO string
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExtraMoneyTransfer {
  id: string;
  user_id?: string;
  amount: number; // positive number > 0
  date: string; // ISO string
  month: string; // Destination month 'YYYY-MM'
  note?: string;
  created_at?: string;
}

export interface BalanceAdjustment {
  id: string;
  user_id?: string;
  amount: number; // non-zero, can be positive (+) or negative (-)
  reason: string; // required reason e.g. "Cash found", "Forgot a bill", "Correction"
  date: string; // ISO string
  month: string; // 'YYYY-MM'
  created_at?: string;
  updated_at?: string;
}

export interface ExtraMoneyPool {
  totalReceived: number;
  totalTransferred: number;
  availableExtraMoney: number;
}

// ==============================================================================
// SAFEGUARDS FOR MISSED / INCOMPLETE EXPENSE CAPTURE
// ==============================================================================

export interface ReconciliationRecord {
  id: string;
  user_id?: string;
  account_id: string;
  actual_balance: number;
  estimated_balance: number;
  difference: number; // actual_balance - estimated_balance
  resolved_method?: 'none' | 'expense_added' | 'balance_adjusted' | 'confirmed_match';
  note?: string;
  date: string; // ISO string
  created_at?: string;
}

export interface DailyCheckInStatus {
  date: string; // 'YYYY-MM-DD'
  confirmed: boolean;
  confirmedAt?: string;
  type?: 'nothing_missed' | 'zero_spend_confirmed';
}

export interface BankStatementMapping {
  id: string;
  bankName: string;
  dateCol: string;
  descCol: string;
  debitCol: string;
  creditCol?: string;
  dateFormat?: string; // e.g. 'DD/MM/YYYY'
}

export interface BankStatementRow {
  id: string;
  date: string; // ISO string
  rawDate: string;
  description: string;
  debitAmount: number;
  creditAmount?: number;
  isDebit: boolean;
  isDuplicate?: boolean;
  matchedExpenseId?: string;
  suggestedCategory: string;
  selected: boolean;
}

export interface CaptureHealthStatus {
  lastAutoCaptureTime?: string | null;
  isSilent24h: boolean;
  hasManualExpensesRecently: boolean;
  showWarning: boolean;
}

export interface VoiceSettings {
  autoSaveConfident: boolean;
  saveVoiceNoteAsExpenseNote: boolean;
}




