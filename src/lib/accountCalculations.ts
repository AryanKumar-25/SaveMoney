import { Account, Expense } from './types';

export interface AccountStats {
  spentThisMonth: number;
  totalSpent: number;
  expenseCount: number;
  estimatedBalance?: number;
  creditUtilizationPercent?: number;
  isHighUtilization: boolean;
}

/**
 * Calculates spending, balances, and credit utilization for a given account.
 */
export function calculateAccountStats(
  account: Account,
  expenses: Expense[],
  currentMonthKey?: string
): AccountStats {
  const monthKey = currentMonthKey || new Date().toISOString().slice(0, 7);
  const accountExpenses = expenses.filter((e) => e.account_id === account.id);

  let spentThisMonth = 0;
  let totalSpent = 0;

  for (const exp of accountExpenses) {
    const amt = typeof exp.amount === 'number' ? exp.amount : parseFloat(exp.amount) || 0;
    totalSpent += amt;

    if (exp.date && exp.date.startsWith(monthKey)) {
      spentThisMonth += amt;
    }
  }

  // Estimated Balance for Bank Accounts and Cash: Opening balance minus total spent
  let estimatedBalance: number | undefined;
  if (
    (account.type === 'bank' || account.type === 'cash') &&
    account.opening_balance !== undefined &&
    account.opening_balance !== null
  ) {
    estimatedBalance = Math.round((account.opening_balance - totalSpent) * 100) / 100;
  }

  // Credit Card Utilization: (spentThisMonth / credit_limit) * 100
  let creditUtilizationPercent: number | undefined;
  let isHighUtilization = false;

  if (account.type === 'credit_card' && account.credit_limit && account.credit_limit > 0) {
    creditUtilizationPercent = Math.round((spentThisMonth / account.credit_limit) * 100);
    isHighUtilization = creditUtilizationPercent >= 80;
  }

  return {
    spentThisMonth: Math.round(spentThisMonth * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    expenseCount: accountExpenses.length,
    estimatedBalance,
    creditUtilizationPercent,
    isHighUtilization,
  };
}

/**
 * Intelligent matching of an Indian Bank / UPI SMS to one of the user's accounts.
 * Checks for:
 * 1. Last 4 digits (e.g. "A/c *8910", "card ending 4592", "XX8910", "ending in 8910")
 * 2. Bank or App name mentioned in text (e.g. "HDFC Bank", "ICICI", "SBI", "GPay", "PhonePe")
 */
export function matchAccountFromSMS(smsText: string, accounts: Account[]): Account | null {
  if (!smsText || accounts.length === 0) return null;
  const lowerSMS = smsText.toLowerCase();

  // 1. Try to find 4-digit card or account indicators
  // Matches: "ending 8910", "ending in 8910", "a/c *8910", "card 8910", "xx8910", "**8910", "acct 8910"
  const digitsRegexes = [
    /(?:ending\s+(?:in\s+)?|a\/c\s*(?:no\.?)?\s*[*xX]*|card\s*(?:no\.?)?\s*[*xX]*|[*xX]{2,})([0-9]{4})\b/i,
    /\b([0-9]{4})\s*(?:debited|spent|paid)/i,
  ];

  let foundDigits: string | null = null;
  for (const regex of digitsRegexes) {
    const match = smsText.match(regex);
    if (match && match[1]) {
      foundDigits = match[1];
      break;
    }
  }

  if (foundDigits) {
    const digitMatch = accounts.find((acc) => acc.last_4_digits === foundDigits);
    if (digitMatch) return digitMatch;
  }

  // 2. Try to match by Bank / App Name or Nickname keywords
  for (const acc of accounts) {
    // Check bank_or_app_name
    if (acc.bank_or_app_name && acc.bank_or_app_name.trim().length > 2) {
      const bankName = acc.bank_or_app_name.toLowerCase().trim();
      if (lowerSMS.includes(bankName)) {
        return acc;
      }
    }

    // Check specific common Indian bank abbreviations
    const abbrevMap: Record<string, string[]> = {
      hdfc: ['hdfc'],
      icici: ['icici'],
      sbi: ['sbi', 'state bank'],
      axis: ['axis'],
      kotak: ['kotak'],
      pnb: ['pnb', 'punjab national'],
      bob: ['bob', 'bank of baroda'],
      paytm: ['paytm'],
      gpay: ['gpay', 'google pay'],
      phonepe: ['phonepe'],
    };

    for (const [key, aliases] of Object.entries(abbrevMap)) {
      const accMatches =
        acc.nickname.toLowerCase().includes(key) ||
        (acc.bank_or_app_name && acc.bank_or_app_name.toLowerCase().includes(key));

      if (accMatches) {
        for (const alias of aliases) {
          if (lowerSMS.includes(alias)) {
            return acc;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Validates an Account before creation or update.
 */
export function validateAccount(data: {
  nickname: string;
  type: string;
  last_4_digits?: string;
  credit_limit?: number;
  billing_date?: number;
  opening_balance?: number;
}): { valid: boolean; error?: string } {
  if (!data.nickname || data.nickname.trim().length === 0) {
    return { valid: false, error: 'Account nickname is required (e.g. HDFC Salary, Amazon Pay ICICI).' };
  }

  if (data.nickname.trim().length > 50) {
    return { valid: false, error: 'Nickname must be 50 characters or less.' };
  }

  if (data.last_4_digits && data.last_4_digits.trim()) {
    const digits = data.last_4_digits.trim();
    if (!/^\d{4}$/.test(digits)) {
      return { valid: false, error: 'Last 4 digits must contain exactly 4 numeric digits.' };
    }
  }

  if (data.credit_limit !== undefined && data.credit_limit !== null) {
    if (isNaN(data.credit_limit) || data.credit_limit < 0) {
      return { valid: false, error: 'Credit limit must be a positive number.' };
    }
  }

  if (data.billing_date !== undefined && data.billing_date !== null) {
    if (isNaN(data.billing_date) || data.billing_date < 1 || data.billing_date > 31) {
      return { valid: false, error: 'Billing date must be a valid day of the month (1-31).' };
    }
  }

  if (data.opening_balance !== undefined && data.opening_balance !== null) {
    if (isNaN(data.opening_balance) || data.opening_balance < 0) {
      return { valid: false, error: 'Opening balance cannot be negative.' };
    }
  }

  return { valid: true };
}
