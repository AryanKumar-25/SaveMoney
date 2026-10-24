import {
  FixedExpense,
  BudgetCalculationResult,
  SafeToSpendResult,
  MonthEndProjectionResult,
  TimeTabTotals,
  CategorySpendingBreakdown,
  ChartDataPoint,
  Expense,
  Category,
} from './types';
import { getDaysRemainingInMonth } from './formatters';

/**
 * Calculates the monthly spendable discretionary budget.
 * 
 * CORE FORMULA (ONE SHARED CALCULATION FUNCTION USED EVERYWHERE):
 * Spendable Budget = Income - Total Fixed Expenses - Savings Target + Extra Transfers + Balance Adjustments
 */
export function calculateSpendableBudget(
  income: number,
  fixedExpenses: FixedExpense[] | number,
  savingsTarget: number,
  extraTransfers: number = 0,
  balanceAdjustments: number = 0
): BudgetCalculationResult {
  const sanitizedIncome = Math.max(0, Number(income) || 0);
  const sanitizedSavings = Math.max(0, Number(savingsTarget) || 0);
  const sanitizedTransfers = Math.max(0, Number(extraTransfers) || 0);
  const sanitizedAdjustments = Number(balanceAdjustments) || 0;

  const totalFixedExpenses = Array.isArray(fixedExpenses)
    ? fixedExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : Math.max(0, Number(fixedExpenses) || 0);

  const baseSpendableBudget = sanitizedIncome - totalFixedExpenses - sanitizedSavings;
  const spendableBudget = baseSpendableBudget + sanitizedTransfers + sanitizedAdjustments;

  const incomeBase = sanitizedIncome > 0 ? sanitizedIncome : 1;
  const savingsRatePercent = sanitizedIncome > 0 ? (sanitizedSavings / incomeBase) * 100 : 0;
  const fixedExpensesPercent = sanitizedIncome > 0 ? (totalFixedExpenses / incomeBase) * 100 : 0;
  const spendablePercent = sanitizedIncome > 0 ? (spendableBudget / incomeBase) * 100 : 0;

  return {
    income: sanitizedIncome,
    totalFixedExpenses,
    savingsTarget: sanitizedSavings,
    extraTransfers: sanitizedTransfers,
    balanceAdjustments: sanitizedAdjustments,
    baseSpendableBudget,
    spendableBudget,
    savingsRatePercent: Math.round(savingsRatePercent * 10) / 10,
    fixedExpensesPercent: Math.round(fixedExpensesPercent * 10) / 10,
    spendablePercent: Math.round(spendablePercent * 10) / 10,
    isDeficit: spendableBudget < 0,
  };
}

/**
 * Calculates the daily "Safe to spend today" allowance.
 * 
 * CORE FORMULA:
 * Safe To Spend Today = (Spendable Budget - Spent So Far This Month) / Days Left In The Month
 * 
 * If spent today exceeds today's allowance, reports overToday in red.
 * If whole month's budget is exceeded, reports overBudget in red.
 */
export function calculateSafeToSpendToday(
  spendableBudget: number,
  spentSoFar: number,
  spentTodayOrDate?: number | Date,
  referenceDateParam?: Date
): SafeToSpendResult {
  let spentTodayNum = 0;
  let referenceDate = new Date();

  if (spentTodayOrDate instanceof Date) {
    referenceDate = spentTodayOrDate;
    spentTodayNum = 0;
  } else if (typeof spentTodayOrDate === 'number') {
    spentTodayNum = spentTodayOrDate;
    if (referenceDateParam instanceof Date) {
      referenceDate = referenceDateParam;
    }
  }

  const budget = Number(spendableBudget) || 0;
  const spentTotal = Math.max(0, Number(spentSoFar) || 0);
  const spentToday = Math.max(0, Number(spentTodayNum) || 0);

  const { daysLeft, totalDays } = getDaysRemainingInMonth(referenceDate);
  const remainingBudget = budget - spentTotal;

  // The spendable budget remaining at the start of today
  const spentBeforeToday = Math.max(0, spentTotal - spentToday);
  const remainingAtStartOfToday = budget - spentBeforeToday;

  // Daily allowance allocated for today:
  // (spendable budget - spent before today) / days remaining in month (including today)
  const dailyAllowanceForToday = remainingAtStartOfToday > 0 && daysLeft > 0
    ? Math.round(remainingAtStartOfToday / daysLeft)
    : 0;

  // Remaining safe allowance for today after deducting what was already spent today
  const safeToSpendRemainingToday = Math.max(0, dailyAllowanceForToday - spentToday);

  // If already spent more than today's allowance
  const isOverToday = spentToday > dailyAllowanceForToday && dailyAllowanceForToday >= 0;
  const overTodayBy = isOverToday ? spentToday - dailyAllowanceForToday : 0;

  // If whole month's budget is exceeded
  const isOverBudget = remainingBudget < 0 || (budget > 0 && spentTotal > budget);
  const overBudgetBy = isOverBudget ? Math.abs(remainingBudget) : 0;

  const dailyBudgetBaseline = totalDays > 0 && budget > 0 ? Math.round(budget / totalDays) : 0;

  return {
    spendableBudget: budget,
    spentSoFar: spentTotal,
    spentToday,
    remainingBudget,
    daysLeftInMonth: daysLeft,
    dailyAllowanceForToday,
    safeToSpendRemainingToday,
    safeToSpendToday: safeToSpendRemainingToday,
    isOverBudget,
    isOverToday,
    overTodayBy,
    overBudgetBy,
    dailyBudgetBaseline,
  };
}

/**
 * Calculates Month-End Projection based on average daily spend so far.
 */
export function calculateMonthEndProjection(
  spentSoFarThisMonth: number,
  spendableBudget: number,
  referenceDate: Date = new Date()
): MonthEndProjectionResult {
  const spent = Math.max(0, Number(spentSoFarThisMonth) || 0);
  const budget = Number(spendableBudget) || 0;

  const daysPassed = referenceDate.getDate();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const averageDailySpend = daysPassed > 0 ? spent / daysPassed : 0;
  const projectedMonthEndSpend = Math.round(averageDailySpend * totalDaysInMonth);

  const projectedDifference = budget - projectedMonthEndSpend;
  const isProjectedOverBudget = budget > 0 ? projectedMonthEndSpend > budget : spent > 0;
  const projectedSurplusOrDeficit = Math.abs(projectedDifference);

  return {
    spentSoFar: spent,
    daysPassed,
    totalDaysInMonth,
    averageDailySpend: Math.round(averageDailySpend),
    projectedMonthEndSpend,
    spendableBudget: budget,
    projectedDifference,
    isProjectedOverBudget,
    projectedSurplusOrDeficit,
  };
}

/**
 * Calculates total spent for the Time Tabs (Today, This week, This month, This year).
 */
export function calculateTimeTabTotals(
  expenses: Expense[],
  referenceDate: Date = new Date()
): TimeTabTotals {
  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;
  let thisYear = 0;

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDate = referenceDate.getDate();

  // Start of today: 00:00:00 local
  const startOfToday = new Date(refYear, refMonth, refDate, 0, 0, 0, 0);
  const endOfToday = new Date(refYear, refMonth, refDate, 23, 59, 59, 999);

  // Current week (Monday to Sunday)
  const dayOfWeek = referenceDate.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(refYear, refMonth, refDate - distanceToMonday, 0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  // Current month
  const startOfMonth = new Date(refYear, refMonth, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(refYear, refMonth + 1, 0, 23, 59, 59, 999);

  // Current year
  const startOfYear = new Date(refYear, 0, 1, 0, 0, 0, 0);
  const endOfYear = new Date(refYear, 11, 31, 23, 59, 59, 999);

  for (const exp of expenses) {
    const amt = Number(exp.amount) || 0;
    if (amt <= 0) continue;
    const d = new Date(exp.date);

    if (d >= startOfToday && d <= endOfToday) {
      today += amt;
    }
    if (d >= startOfWeek && d <= endOfWeek) {
      thisWeek += amt;
    }
    if (d >= startOfMonth && d <= endOfMonth) {
      thisMonth += amt;
    }
    if (d >= startOfYear && d <= endOfYear) {
      thisYear += amt;
    }
  }

  return { today, thisWeek, thisMonth, thisYear };
}

/**
 * Calculates Category Spending Breakdown for any list of expenses.
 */
export function calculateCategoryBreakdown(
  expenses: Expense[],
  categoriesInput?: Category[] | Map<string, { color?: string; icon?: string }>
): CategorySpendingBreakdown[] {
  let categoriesMap: Map<string, { color?: string; icon?: string }> | undefined;
  if (Array.isArray(categoriesInput)) {
    categoriesMap = new Map();
    for (const c of categoriesInput) {
      if (c && c.name) {
        categoriesMap.set(c.name.toLowerCase(), { color: c.color, icon: c.icon });
      }
    }
  } else {
    categoriesMap = categoriesInput;
  }

  const totals: { [category: string]: { amount: number; count: number } } = {};
  let overallTotal = 0;

  for (const exp of expenses) {
    const amt = Number(exp.amount) || 0;
    if (amt <= 0) continue;
    const cat = exp.category || 'Other';
    if (!totals[cat]) {
      totals[cat] = { amount: 0, count: 0 };
    }
    totals[cat].amount += amt;
    totals[cat].count += 1;
    overallTotal += amt;
  }

  const breakdown: CategorySpendingBreakdown[] = Object.entries(totals).map(([category, info]) => {
    const percentage = overallTotal > 0 ? Math.round((info.amount / overallTotal) * 1000) / 10 : 0;
    const meta = categoriesMap?.get(category.toLowerCase());
    return {
      category,
      amount: info.amount,
      percentage,
      count: info.count,
      color: meta?.color,
      icon: meta?.icon,
    };
  });

  // Sort descending by amount
  return breakdown.sort((a, b) => b.amount - a.amount);
}

/**
 * Aggregates daily spending for charts across specified time range.
 */
export function calculateChartDataForRange(
  expenses: Expense[],
  range: '1D' | '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL',
  dailySafeLimit: number = 0,
  referenceDate: Date = new Date()
): { points: ChartDataPoint[]; totalSpent: number; filteredExpenses: Expense[] } {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDate = referenceDate.getDate();

  let startDate = new Date(refYear, refMonth, 1, 0, 0, 0, 0);
  const endDate = new Date(refYear, refMonth, refDate, 23, 59, 59, 999);

  if (range === '1D') {
    startDate = new Date(refYear, refMonth, refDate, 0, 0, 0, 0);
  } else if (range === '7D') {
    startDate = new Date(refYear, refMonth, refDate - 6, 0, 0, 0, 0);
  } else if (range === '1M') {
    startDate = new Date(refYear, refMonth, 1, 0, 0, 0, 0);
  } else if (range === '3M') {
    startDate = new Date(refYear, refMonth - 2, 1, 0, 0, 0, 0);
  } else if (range === '6M') {
    startDate = new Date(refYear, refMonth - 5, 1, 0, 0, 0, 0);
  } else if (range === '1Y') {
    startDate = new Date(refYear - 1, refMonth + 1, 1, 0, 0, 0, 0);
    // ALL: Find earliest expense date or default to 1 year ago
    let minTime = new Date(refYear - 1, refMonth, 1, 0, 0, 0, 0).getTime();
    for (const exp of expenses) {
      const t = new Date(exp.date).getTime();
      if (t < minTime) minTime = t;
    }
    startDate = new Date(minTime);
    startDate.setHours(0, 0, 0, 0);
  }

  // Filter expenses within date range
  const filteredExpenses = expenses.filter((exp) => {
    const d = new Date(exp.date);
    return d >= startDate && d <= endDate;
  });

  const totalSpent = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Group by day key (YYYY-MM-DD)
  const dayMap: { [dateKey: string]: number } = {};
  for (const exp of filteredExpenses) {
    const d = new Date(exp.date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dayMap[dateKey] = (dayMap[dateKey] || 0) + (Number(exp.amount) || 0);
  }

  const points: ChartDataPoint[] = [];

  // 1D: Group by 4-hour slots of today
  if (range === '1D') {
    const slots = [
      { label: 'Night (12-6 AM)', start: 0, end: 5 },
      { label: 'Morning (6-12 PM)', start: 6, end: 11 },
      { label: 'Afternoon (12-4 PM)', start: 12, end: 15 },
      { label: 'Evening (4-8 PM)', start: 16, end: 19 },
      { label: 'Night (8-12 AM)', start: 20, end: 23 },
    ];

    for (const slot of slots) {
      let slotAmt = 0;
      for (const exp of filteredExpenses) {
        const h = new Date(exp.date).getHours();
        if (h >= slot.start && h <= slot.end) slotAmt += Number(exp.amount) || 0;
      }
      points.push({
        date: slot.label,
        fullDate: `${slot.label}`,
        amount: slotAmt,
        safeLimit: dailySafeLimit > 0 ? Math.round(dailySafeLimit / slots.length) : undefined,
      });
    }

    return { points, totalSpent, filteredExpenses };
  }

  // Monthly / multi-month view: generate sequential days or months
  if (range === '1M') {
    const totalDaysInMonth = new Date(refYear, refMonth + 1, 0).getDate();
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateKey = `${refYear}-${String(refMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(refYear, refMonth, day);
      const label = `${String(day).padStart(2, '0')} ${dObj.toLocaleString('en-IN', { month: 'short' })}`;
      points.push({
        date: label,
        fullDate: dateKey,
        amount: dayMap[dateKey] || 0,
        safeLimit: dailySafeLimit > 0 ? dailySafeLimit : undefined,
      });
    }
    return { points, totalSpent, filteredExpenses };
  }

  // 7D: past 7 days sequentially
  if (range === '7D') {
    for (let i = 6; i >= 0; i--) {
      const cur = new Date(refYear, refMonth, refDate - i);
      const dateKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      const isToday = i === 0;
      const label = isToday ? 'Today' : `${cur.getDate()} ${cur.toLocaleString('en-IN', { month: 'short' })}`;
      points.push({
        date: label,
        fullDate: dateKey,
        amount: dayMap[dateKey] || 0,
        safeLimit: dailySafeLimit > 0 ? dailySafeLimit : undefined,
      });
    }
    return { points, totalSpent, filteredExpenses };
  }

  // 3M, 6M, 1Y, ALL: Group by month for readability
  const monthMap: { [monthKey: string]: { label: string; amount: number } } = {};
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor <= endCursor) {
    const mKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const mLabel = `${cursor.toLocaleString('en-IN', { month: 'short' })} '${String(cursor.getFullYear()).slice(-2)}`;
    monthMap[mKey] = { label: mLabel, amount: 0 };
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const exp of filteredExpenses) {
    const expDate = new Date(exp.date);
    const mKey = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap[mKey]) {
      monthMap[mKey].amount += Number(exp.amount) || 0;
    }
  }

  for (const [mKey, info] of Object.entries(monthMap)) {
    points.push({
      date: info.label,
      fullDate: mKey,
      amount: info.amount,
    });
  }

  return { points, totalSpent, filteredExpenses };
}

