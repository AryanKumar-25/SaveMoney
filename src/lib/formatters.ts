/**
 * Indian Currency & Number Formatters for SaveMoney
 * 
 * Uses 'en-IN' locale to follow the Indian numbering system:
 * e.g., ₹1,25,000 (Lakhs / Crores grouping: 2, 2, 3)
 */

export function formatINR(amount: number | null | undefined, includeDecimals = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  });

  return formatter.format(amount);
}

/**
 * Formats a plain number in Indian format without the currency symbol
 * e.g. 125000 -> "1,25,000"
 */
export function formatIndianNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }

  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Returns month string in 'YYYY-MM' format (e.g., '2026-10')
 */
export function getCurrentMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns human-readable month label (e.g., "October 2026")
 */
export function formatMonthName(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [yearStr, monthStr] = monthKey.split('-');
  const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

/**
 * Calculates remaining days in the month (including today)
 */
export function getDaysRemainingInMonth(date: Date = new Date()): {
  daysLeft: number;
  totalDays: number;
  currentDay: number;
} {
  const year = date.getFullYear();
  const month = date.getMonth();
  const currentDay = date.getDate();
  
  // Total days in current month (passing day 0 of next month returns total days in current)
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  // Days left including today
  const daysLeft = Math.max(1, totalDays - currentDay + 1);

  return { daysLeft, totalDays, currentDay };
}
