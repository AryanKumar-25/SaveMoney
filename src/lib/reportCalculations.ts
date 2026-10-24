import { Expense, MonthlyBudget, Category, Account } from './types';
import { calculateSpendableBudget } from './calculations';

export interface TopCategoryItem {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  color?: string;
  icon?: string;
}

export interface TopMerchantItem {
  merchant: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface MonthlyReportResult {
  month: string; // 'YYYY-MM'
  totalSpent: number;
  spendableBudget: number;
  baseSpendableBudget: number;
  extraTransfersTotal: number;
  balanceAdjustmentsTotal: number;
  extraMoneyReceivedTotal: number;
  budgetUsedPercent: number;
  isOverBudget: boolean;
  overBudgetAmount: number;
  remainingBudget: number;
  lastMonthSpent: number;
  monthOverMonthDifference: number; // current - last
  monthOverMonthPercentChange: number; // ((current - last) / last) * 100
  isIncreaseVsLastMonth: boolean;
  top5Categories: TopCategoryItem[];
  top5Merchants: TopMerchantItem[];
  biggestExpense: Expense | null;
  dailyAverage: number;
  daysConsidered: number;
  transactionCount: number;
}

export interface MonthYearlySummary {
  monthKey: string; // 'YYYY-MM'
  monthLabel: string; // 'Jan', 'Feb', etc.
  totalSpent: number;
  income: number;
  savingsTarget: number;
  spendableBudget: number;
  fixedExpensesTotal: number;
  isConfigured: boolean;
  savingsTargetHit: boolean;
  actualSavings: number; // income - totalSpent - fixedExpenses
  savingsDeficit: number; // Math.max(0, savingsTarget - actualSavings)
}

export interface YearlyReportResult {
  year: number;
  totalSpentYear: number;
  averageMonthlySpent: number;
  monthsData: MonthYearlySummary[];
  totalSavingsTargetYear: number;
  totalActualSavingsYear: number;
  monthsTargetHitCount: number;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Calculates all metrics for a Monthly Report
 */
export function calculateMonthlyReport(params: {
  month: string; // 'YYYY-MM'
  expenses: Expense[];
  lastMonthExpenses: Expense[];
  budget: MonthlyBudget | null;
  fixedExpensesTotal?: number;
  extraTransfers?: number;
  balanceAdjustments?: number;
  extraMoneyReceived?: number;
  categories?: Category[];
  totalDaysInMonth?: number;
  daysPassed?: number;
}): MonthlyReportResult {
  const {
    month,
    expenses,
    lastMonthExpenses,
    budget,
    fixedExpensesTotal = 0,
    extraTransfers = 0,
    balanceAdjustments = 0,
    extraMoneyReceived = 0,
    categories = [],
    totalDaysInMonth,
    daysPassed,
  } = params;

  // Filter expenses strictly belonging to the target month
  const monthExpenses = expenses.filter((e) => e.date && e.date.startsWith(month));
  const totalSpent = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Past month total
  const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Month over month
  const momDiff = totalSpent - lastMonthTotal;
  const momPercent = lastMonthTotal > 0
    ? ((totalSpent - lastMonthTotal) / lastMonthTotal) * 100
    : totalSpent > 0 ? 100 : 0;

  // Budget calculations using the single shared calculation function
  const income = budget ? Number(budget.income) || 0 : 0;
  const savingsTarget = budget ? Number(budget.savings_target) || 0 : 0;
  const budgetResult = calculateSpendableBudget(
    income,
    fixedExpensesTotal,
    savingsTarget,
    extraTransfers,
    balanceAdjustments
  );
  const spendableBudget = budgetResult.spendableBudget;
  const baseSpendableBudget = budgetResult.baseSpendableBudget;

  const budgetUsedPercent = spendableBudget > 0
    ? (totalSpent / spendableBudget) * 100
    : 0;
  const isOverBudget = spendableBudget > 0 && totalSpent > spendableBudget;
  const overBudgetAmount = isOverBudget ? totalSpent - spendableBudget : 0;
  const remainingBudget = Math.max(0, spendableBudget - totalSpent);

  // Days in month calculation for daily average
  const [yearStr, mStr] = month.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(mStr, 10);
  const daysInMonthCount = totalDaysInMonth || new Date(y, m, 0).getDate();

  // If calculating for current ongoing month, use days passed; otherwise use total days
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m;
  const effectiveDays = daysPassed || (isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonthCount);
  const dailyAverage = effectiveDays > 0 ? totalSpent / effectiveDays : 0;

  // Top 5 Categories
  const categoryMap = new Map<string, { amount: number; count: number }>();
  for (const exp of monthExpenses) {
    const cat = exp.category || 'Other';
    const existing = categoryMap.get(cat) || { amount: 0, count: 0 };
    categoryMap.set(cat, {
      amount: existing.amount + (Number(exp.amount) || 0),
      count: existing.count + 1,
    });
  }

  const catMetaMap = new Map<string, { color?: string; icon?: string }>();
  for (const c of categories) {
    catMetaMap.set(c.name.toLowerCase(), { color: c.color, icon: c.icon });
  }

  const top5Categories: TopCategoryItem[] = Array.from(categoryMap.entries())
    .map(([category, stats]) => {
      const meta = catMetaMap.get(category.toLowerCase());
      return {
        category,
        amount: stats.amount,
        count: stats.count,
        percentage: totalSpent > 0 ? Math.round((stats.amount / totalSpent) * 100) : 0,
        color: meta?.color,
        icon: meta?.icon,
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Top 5 Merchants
  const merchantMap = new Map<string, { amount: number; count: number }>();
  for (const exp of monthExpenses) {
    const merchantName = (exp.merchant || exp.note || exp.category || 'Unknown').trim();
    const existing = merchantMap.get(merchantName) || { amount: 0, count: 0 };
    merchantMap.set(merchantName, {
      amount: existing.amount + (Number(exp.amount) || 0),
      count: existing.count + 1,
    });
  }

  const top5Merchants: TopMerchantItem[] = Array.from(merchantMap.entries())
    .map(([merchant, stats]) => ({
      merchant,
      amount: stats.amount,
      count: stats.count,
      percentage: totalSpent > 0 ? Math.round((stats.amount / totalSpent) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Biggest single expense
  let biggestExpense: Expense | null = null;
  for (const exp of monthExpenses) {
    if (!biggestExpense || Number(exp.amount) > Number(biggestExpense.amount)) {
      biggestExpense = exp;
    }
  }

  return {
    month,
    totalSpent,
    spendableBudget,
    baseSpendableBudget,
    extraTransfersTotal: extraTransfers,
    balanceAdjustmentsTotal: balanceAdjustments,
    extraMoneyReceivedTotal: extraMoneyReceived,
    budgetUsedPercent: Math.round(budgetUsedPercent),
    isOverBudget,
    overBudgetAmount,
    remainingBudget,
    lastMonthSpent: lastMonthTotal,
    monthOverMonthDifference: momDiff,
    monthOverMonthPercentChange: Math.round(momPercent),
    isIncreaseVsLastMonth: momDiff > 0,
    top5Categories,
    top5Merchants,
    biggestExpense,
    dailyAverage: Math.round(dailyAverage),
    daysConsidered: effectiveDays,
    transactionCount: monthExpenses.length,
  };
}

/**
 * Calculates Yearly spending breakdown and savings target hit/missed per month
 */
export function calculateYearlyReport(params: {
  year: number;
  allExpenses: Expense[];
  monthlyBudgets: MonthlyBudget[];
  fixedExpensesByMonth?: Record<string, number>;
}): YearlyReportResult {
  const { year, allExpenses, monthlyBudgets, fixedExpensesByMonth = {} } = params;

  const budgetMap = new Map<string, MonthlyBudget>();
  for (const b of monthlyBudgets) {
    budgetMap.set(b.month, b);
  }

  let totalSpentYear = 0;
  let totalSavingsTargetYear = 0;
  let totalActualSavingsYear = 0;
  let monthsWithDataCount = 0;
  let monthsTargetHitCount = 0;

  const monthsData: MonthYearlySummary[] = [];

  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
    const monthLabel = MONTH_NAMES[m - 1];

    // Filter expenses for this month
    const monthExpenses = allExpenses.filter((e) => e.date && e.date.startsWith(monthKey));
    const totalSpent = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const b = budgetMap.get(monthKey);
    const income = b ? Number(b.income) || 0 : 0;
    const savingsTarget = b ? Number(b.savings_target) || 0 : 0;
    const fixedExpensesTotal = fixedExpensesByMonth[monthKey] || 0;
    const isConfigured = income > 0 || savingsTarget > 0 || fixedExpensesTotal > 0;

    const spendableBudget = Math.max(0, income - fixedExpensesTotal - savingsTarget);

    // Actual savings = income - totalSpent - fixedExpensesTotal
    // If user has not configured income, actual savings can't be calculated accurately
    let actualSavings = 0;
    let savingsTargetHit = false;
    let savingsDeficit = 0;

    if (isConfigured && income > 0) {
      actualSavings = Math.max(0, income - totalSpent - fixedExpensesTotal);
      savingsTargetHit = savingsTarget > 0 ? actualSavings >= savingsTarget : totalSpent <= spendableBudget;
      savingsDeficit = savingsTarget > 0 ? Math.max(0, savingsTarget - actualSavings) : 0;

      if (savingsTargetHit) {
        monthsTargetHitCount++;
      }
    } else if (totalSpent > 0) {
      // If no budget is set but spent something, savings target is neutral/not hit
      savingsTargetHit = false;
    }

    if (totalSpent > 0 || isConfigured) {
      monthsWithDataCount++;
    }

    totalSpentYear += totalSpent;
    totalSavingsTargetYear += savingsTarget;
    totalActualSavingsYear += actualSavings;

    monthsData.push({
      monthKey,
      monthLabel,
      totalSpent,
      income,
      savingsTarget,
      spendableBudget,
      fixedExpensesTotal,
      isConfigured,
      savingsTargetHit,
      actualSavings,
      savingsDeficit,
    });
  }

  const averageMonthlySpent = monthsWithDataCount > 0
    ? Math.round(totalSpentYear / monthsWithDataCount)
    : 0;

  return {
    year,
    totalSpentYear,
    averageMonthlySpent,
    monthsData,
    totalSavingsTargetYear,
    totalActualSavingsYear,
    monthsTargetHitCount,
  };
}
