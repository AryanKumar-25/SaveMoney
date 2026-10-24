import { Expense, Category, ReconciliationRecord, DailyCheckInStatus, BankStatementMapping, BankStatementRow, CaptureHealthStatus } from './types';
import { formatINR } from './formatters';

// Common Indian merchant keyword mappings for auto-categorization
export const MERCHANT_CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: [
    'swiggy', 'zomato', 'mcdonald', 'starbucks', 'dominos', 'pizza', 'kfc',
    'burger', 'chai', 'tea', 'coffee', 'cafe', 'restaurant', 'eats', 'dhaba',
    'biryani', 'bakery', 'subway', 'barbeque', 'sweet', 'mithai'
  ],
  Travel: [
    'uber', 'ola', 'rapido', 'irctc', 'makemytrip', 'goibibo', 'indigo',
    'air india', 'petrol', 'fuel', 'indian oil', 'hpcl', 'bpcl', 'shell',
    'metro', 'fastag', 'toll', 'parking', 'flight', 'railway', 'bus'
  ],
  Shopping: [
    'amazon', 'flipkart', 'myntra', 'zara', 'h&m', 'ajio', 'dmart',
    'blinkit', 'zepto', 'instamart', 'bigbasket', 'croma', 'reliance',
    'nykaa', 'tata cliq', 'ikea', 'decathlon', 'supermarket', 'mall', 'store'
  ],
  Entertainment: [
    'netflix', 'spotify', 'hotstar', 'prime', 'bookmyshow', 'pvr', 'inox',
    'cinema', 'theatre', 'youtube', 'apple music', 'gaming', 'steam', 'playstation'
  ],
  Bills: [
    'airtel', 'jio', 'vi', 'vodafone', 'bescom', 'tata power', 'adani',
    'electricity', 'broadband', 'wifi', 'gas', 'water', 'recharge', 'bill',
    'postpaid', 'dth', 'tata sky', 'act fibernet'
  ],
  Health: [
    'apollo', '1mg', 'pharmeasy', 'medplus', 'practo', 'netmeds', 'hospital',
    'clinic', 'pharmacy', 'chemist', 'lab', 'diagnostics', 'dental'
  ],
};

/**
 * 1. Balance Reconciliation Difference Calculation
 * Compares real balance entered from bank app against app's estimated balance.
 */
export interface ReconciliationDiffResult {
  actualBalance: number;
  estimatedBalance: number;
  difference: number; // actual - estimated
  unaccountedAmount: number;
  isMatch: boolean;
  status: 'match' | 'unaccounted' | 'extra';
  formattedDiff: string;
  differenceFormatted: string;
  explanation: string;
  recommendedAction: 'none' | 'add_missing_expense' | 'save_balance_adjustment' | 'confirm' | 'add_expense' | 'adjust_balance';
}

export function calculateReconciliationDifference(
  actualOrParams: number | { actualBalance: number; estimatedBalance: number },
  estimatedBalanceParam?: number
): ReconciliationDiffResult {
  let actualRaw = 0;
  let estimatedRaw = 0;

  if (typeof actualOrParams === 'object' && actualOrParams !== null) {
    actualRaw = actualOrParams.actualBalance;
    estimatedRaw = actualOrParams.estimatedBalance;
  } else {
    actualRaw = actualOrParams;
    estimatedRaw = estimatedBalanceParam ?? 0;
  }

  const actual = Math.round((Number(actualRaw) || 0) * 100) / 100;
  const estimated = Math.round((Number(estimatedRaw) || 0) * 100) / 100;
  const difference = Math.round((actual - estimated) * 100) / 100;
  const unaccountedAmount = Math.abs(difference);

  if (Math.abs(difference) < 0.01) {
    return {
      actualBalance: actual,
      estimatedBalance: estimated,
      difference: 0,
      unaccountedAmount: 0,
      isMatch: true,
      status: 'match',
      formattedDiff: 'Balances match perfectly (₹0 difference)',
      differenceFormatted: 'Balances match perfectly (₹0 difference)',
      explanation: 'Your bank balance matches your tracked expenses perfectly.',
      recommendedAction: 'confirm',
    };
  }

  if (difference < 0) {
    return {
      actualBalance: actual,
      estimatedBalance: estimated,
      difference,
      unaccountedAmount,
      isMatch: false,
      status: 'unaccounted',
      formattedDiff: `${formatINR(unaccountedAmount)} unaccounted for`,
      differenceFormatted: `${formatINR(unaccountedAmount)} unaccounted for`,
      explanation: `You have ${formatINR(unaccountedAmount)} less in your bank than tracked. You likely missed logging an expense of ${formatINR(unaccountedAmount)}.`,
      recommendedAction: 'add_expense',
    };
  }

  // difference > 0 (Actual > Estimated)
  return {
    actualBalance: actual,
    estimatedBalance: estimated,
    difference,
    unaccountedAmount,
    isMatch: false,
    status: 'extra',
    formattedDiff: `${formatINR(difference)} extra in bank`,
    differenceFormatted: `${formatINR(difference)} extra in bank`,
    explanation: `You have ${formatINR(difference)} more in your bank than tracked. Possible untracked refund, cash deposit, or cashback.`,
    recommendedAction: 'adjust_balance',
  };
}

/**
 * Checks if an account needs reconciliation based on last reconciliation date
 * Triggers weekly reminder if > 7 days have passed.
 */
export function needsReconciliationReminder(
  lastReconciledDate?: string | null,
  currentDate: Date = new Date(),
  enabled: boolean = true
): boolean {
  if (!enabled) return false;
  if (!lastReconciledDate) return true;

  const last = new Date(lastReconciledDate).getTime();
  const now = currentDate.getTime();
  const diffDays = (now - last) / (1000 * 60 * 60 * 24);

  return diffDays >= 7;
}

/**
 * 2. Daily Check-in & Zero-Spend Day Verification
 */
export function isZeroSpendDay(
  expenses: Expense[],
  targetDateStr?: string
): boolean {
  const todayStr = targetDateStr || new Date().toISOString().slice(0, 10);
  const todayExpenses = expenses.filter((e) => e.date && e.date.slice(0, 10) === todayStr);
  const total = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  return total === 0 || todayExpenses.length === 0;
}

export interface DailyCheckInEvaluation {
  shouldShow: boolean;
  isZeroSpend: boolean;
  todaySpent: number;
  todayCount: number;
  title: string;
  subtitle: string;
  isConfirmed: boolean;
}

export function evaluateDailyCheckIn(params: {
  expenses: Expense[];
  checkInStatus?: DailyCheckInStatus | null;
  currentTime?: Date;
  configuredTime?: string; // 'HH:mm' e.g. '21:00'
  enabled?: boolean;
  targetDateStr?: string;
  ignoreTimeWindow?: boolean; // For testing or preview
}): DailyCheckInEvaluation {
  const {
    expenses,
    checkInStatus,
    currentTime = new Date(),
    configuredTime = '21:00',
    enabled = true,
    targetDateStr,
    ignoreTimeWindow = false,
  } = params;

  const todayKey = targetDateStr || currentTime.toISOString().slice(0, 10);
  const isConfirmed = Boolean(checkInStatus && checkInStatus.date === todayKey && checkInStatus.confirmed);

  if (!enabled) {
    return {
      shouldShow: false,
      isZeroSpend: false,
      todaySpent: 0,
      todayCount: 0,
      title: '',
      subtitle: '',
      isConfirmed: false,
    };
  }

  // Filter today's expenses
  const todayExpenses = expenses.filter((e) => e.date && e.date.slice(0, 10) === todayKey);
  const todaySpent = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const todayCount = todayExpenses.length;
  const isZeroSpend = todayCount === 0 || todaySpent === 0;

  // Determine if it is evening / check-in time
  let isEveningTime = ignoreTimeWindow;
  if (!ignoreTimeWindow) {
    const [cfgHours, cfgMins] = configuredTime.split(':').map((v) => parseInt(v, 10) || 0);
    const currentHours = currentTime.getHours();
    const currentMins = currentTime.getMinutes();

    // Check-in window opens at the configured time (or 18:00 / 6 PM earliest)
    const currentMinutesOfDay = currentHours * 60 + currentMins;
    const targetMinutesOfDay = cfgHours * 60 + cfgMins;

    // Show if current time is within or past check-in time (e.g. >= 21:00 or >= 18:00 evening)
    isEveningTime = currentMinutesOfDay >= Math.min(targetMinutesOfDay, 18 * 60);
  }

  const shouldShow = isEveningTime && !isConfirmed;

  if (isZeroSpend) {
    return {
      shouldShow,
      isZeroSpend: true,
      todaySpent: 0,
      todayCount: 0,
      title: 'No spending recorded today. Is that right?',
      subtitle: 'If you made any cash, card, or UPI payments today, log them now so your safe-to-spend stays accurate.',
      isConfirmed,
    };
  }

  return {
    shouldShow,
    isZeroSpend: false,
    todaySpent,
    todayCount,
    title: 'Daily Check-in: Anything not logged today?',
    subtitle: `You've logged ${formatINR(todaySpent)} across ${todayCount} expense${todayCount !== 1 ? 's' : ''} today.`,
    isConfirmed,
  };
}

/**
 * 3. Duplicate Detection for Statement Import & Multi-source payments (SMS + UPI Notification)
 * Detects if an existing transaction matches candidate:
 * - Exact amount
 * - Date within 1 day (24 hours)
 * - Matching or similar merchant
 */
export function detectDuplicateExpense(
  candidate: {
    amount: number;
    date: string | Date;
    merchant?: string;
    note?: string;
    account_id?: string | null;
  },
  existingExpenses: Expense[]
): { isDuplicate: boolean; matchedExpense?: Expense; reason?: string } {
  const candAmt = Number(candidate.amount);
  if (isNaN(candAmt) || candAmt <= 0) {
    return { isDuplicate: false };
  }

  const candDate = new Date(candidate.date);
  const candTime = isNaN(candDate.getTime()) ? Date.now() : candDate.getTime();
  const candDesc = normalizeMerchantString(`${candidate.merchant || ''} ${candidate.note || ''}`);

  for (const existing of existingExpenses) {
    const existAmt = Number(existing.amount);
    // 1. Amount match
    if (Math.abs(existAmt - candAmt) > 0.01) {
      continue;
    }

    // 2. Date within 1 day (86,400,000 ms)
    const existDate = new Date(existing.date);
    const existTime = isNaN(existDate.getTime()) ? 0 : existDate.getTime();
    const timeDiffMs = Math.abs(candTime - existTime);
    const isWithinOneDay = timeDiffMs <= 24 * 60 * 60 * 1000 + 60 * 1000; // 24h + 1m grace

    if (!isWithinOneDay) {
      continue;
    }

    // 3. Merchant / Description comparison
    const existDesc = normalizeMerchantString(`${existing.merchant || ''} ${existing.note || ''}`);

    const hasMerchantMatch =
      candDesc.length === 0 ||
      existDesc.length === 0 ||
      candDesc === existDesc ||
      candDesc.includes(existDesc) ||
      existDesc.includes(candDesc) ||
      checkSharedKeywords(candDesc, existDesc);

    // If candidate account matches or is unspecified, and merchant matches
    if (hasMerchantMatch) {
      return {
        isDuplicate: true,
        matchedExpense: existing,
        reason: `Matches existing expense of ${formatINR(existAmt)} on ${existDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} (${existing.merchant || existing.category})`,
      };
    }
  }

  return { isDuplicate: false };
}

function normalizeMerchantString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkSharedKeywords(strA: string, strB: string): boolean {
  const wordsA = strA.split(' ').filter((w) => w.length >= 3);
  const wordsB = strB.split(' ').filter((w) => w.length >= 3);

  for (const wa of wordsA) {
    if (wordsB.includes(wa)) return true;
  }
  return false;
}

/**
 * 4. Auto-categorize a merchant description using keywords or merchant rules
 */
export function autoCategorizeMerchant(
  description: string,
  categories: Category[] = []
): { category: string; isNeedsReview: boolean } {
  if (!description || description.trim().length === 0) {
    return { category: 'Needs review', isNeedsReview: true };
  }

  const clean = description.toLowerCase();

  // 1. Check user-defined categories
  for (const cat of categories) {
    if (clean.includes(cat.name.toLowerCase())) {
      return { category: cat.name, isNeedsReview: false };
    }
  }

  // 2. Check predefined merchant keywords
  for (const [catName, keywords] of Object.entries(MERCHANT_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (clean.includes(kw)) {
        // Find matching user category if available (e.g. Food -> Food & Dining, Travel -> Transportation)
        const matchedUserCat = categories.find((c) => {
          const cLower = c.name.toLowerCase();
          const targetLower = catName.toLowerCase();
          return (
            cLower === targetLower ||
            cLower.includes(targetLower) ||
            targetLower.includes(cLower) ||
            (targetLower === 'travel' && (cLower.includes('transport') || cLower.includes('travel') || cLower.includes('commute')))
          );
        });

        return { category: matchedUserCat ? matchedUserCat.name : catName, isNeedsReview: false };
      }
    }
  }

  // Unknown merchant goes to "Needs review"
  return { category: 'Needs review', isNeedsReview: true };
}

/**
 * 5. Bank Statement CSV Parser
 * - Maps date, description, debit, credit
 * - Imports ONLY debits
 * - Detects duplicates against existing expenses
 * - Auto-categorizes with fallback to "Needs review"
 */
export function parseCSVStatement(params: {
  csvText: string;
  mapping: BankStatementMapping;
  existingExpenses: Expense[];
  categories?: Category[];
}): {
  rows: BankStatementRow[];
  newCount: number;
  duplicateCount: number;
  creditCount: number;
  totalDebits: number;
} {
  const { csvText, mapping, existingExpenses, categories = [] } = params;

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], newCount: 0, duplicateCount: 0, creditCount: 0, totalDebits: 0 };
  }

  // Parse header
  const header = parseCSVLine(lines[0]);
  const colIndexMap = new Map<string, number>();
  header.forEach((col, idx) => {
    colIndexMap.set(col.trim().toLowerCase(), idx);
  });

  const getIdx = (colName?: string) => {
    if (!colName) return -1;
    return colIndexMap.get(colName.trim().toLowerCase()) ?? -1;
  };

  const dateIdx = getIdx(mapping.dateCol);
  const descIdx = getIdx(mapping.descCol);
  const debitIdx = getIdx(mapping.debitCol);
  const creditIdx = mapping.creditCol ? getIdx(mapping.creditCol) : -1;

  const rows: BankStatementRow[] = [];
  let newCount = 0;
  let duplicateCount = 0;
  let creditCount = 0;
  let totalDebits = 0;

  for (let i = 1; i < lines.length; i++) {
    const rawCols = parseCSVLine(lines[i]);
    if (rawCols.length === 0) continue;

    const rawDate = dateIdx >= 0 ? rawCols[dateIdx]?.trim() || '' : '';
    const description = descIdx >= 0 ? rawCols[descIdx]?.trim() || 'Statement Transaction' : 'Transaction';
    
    // Parse amounts (cleaning commas, currency symbols)
    const rawDebit = debitIdx >= 0 ? rawCols[debitIdx] : '';
    const rawCredit = creditIdx >= 0 ? rawCols[creditIdx] : '';

    const debitAmount = parseCleanAmount(rawDebit);
    const creditAmount = parseCleanAmount(rawCredit);

    // If credit column has amount > 0 and debit is 0, this is a deposit/credit
    if (creditAmount > 0 && debitAmount === 0) {
      creditCount++;
      continue; // Skip credits from expense import
    }

    if (debitAmount <= 0) {
      continue;
    }

    const isoDate = parseStatementDate(rawDate);
    const { category, isNeedsReview } = autoCategorizeMerchant(description, categories);

    // Check duplicate
    const dupCheck = detectDuplicateExpense(
      {
        amount: debitAmount,
        date: isoDate,
        merchant: description,
      },
      existingExpenses
    );

    const isDuplicate = dupCheck.isDuplicate;
    if (isDuplicate) {
      duplicateCount++;
    } else {
      newCount++;
    }

    totalDebits += debitAmount;

    rows.push({
      id: `stmt-${i}-${Date.now()}`,
      date: isoDate,
      rawDate,
      description,
      debitAmount,
      creditAmount: creditAmount > 0 ? creditAmount : undefined,
      isDebit: true,
      isDuplicate,
      matchedExpenseId: dupCheck.matchedExpense?.id,
      suggestedCategory: category,
      selected: !isDuplicate, // Default: pre-select only new transactions
    });
  }

  return {
    rows,
    newCount,
    duplicateCount,
    creditCount,
    totalDebits: Math.round(totalDebits * 100) / 100,
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCleanAmount(val?: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[₹Rs,INR\s"']/gi, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

function parseStatementDate(raw: string): string {
  if (!raw) return new Date().toISOString();

  // Try standard formats e.g. 'DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY'
  const dmyMatch = raw.match(/^(\d{1,2})[-/.](\d{1,2}|[A-Za-z]{3})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const mPart = dmyMatch[2];
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    let month = -1;
    if (isNaN(Number(mPart))) {
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      month = monthNames.indexOf(mPart.toLowerCase().slice(0, 3));
    } else {
      month = parseInt(mPart, 10) - 1;
    }

    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const d = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  const fallback = new Date(raw);
  if (!isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }

  return new Date().toISOString();
}

/**
 * 6. Capture Health Evaluation
 * Shows "Last auto-captured expense: [time]"
 * If auto-capture has been silent for 24+ hours while manual expenses were added,
 * raises gentle warning that phone automation may have stopped.
 */
export function evaluateCaptureHealth(
  expenses: Expense[],
  lastAutoCaptureTime?: string | null,
  currentTime: Date = new Date()
): CaptureHealthStatus {
  const now = currentTime.getTime();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Find last auto-captured expense from expenses array or explicitly recorded timestamp
  let latestAutoTime = lastAutoCaptureTime ? new Date(lastAutoCaptureTime).getTime() : 0;

  for (const exp of expenses) {
    if (exp.source === 'sms' || exp.source === 'notification' || exp.source === 'import') {
      const t = new Date(exp.date).getTime();
      if (t > latestAutoTime) {
        latestAutoTime = t;
      }
    }
  }

  const isSilent24h = latestAutoTime === 0 || latestAutoTime < oneDayAgo;

  // Check if manual expenses were logged in the last 24-48 hours
  const hasManualExpensesRecently = expenses.some((e) => {
    const isManual = !e.source || e.source === 'manual';
    const t = new Date(e.date).getTime();
    return isManual && t >= oneDayAgo && t <= now + 60000;
  });

  const showWarning = isSilent24h && hasManualExpensesRecently;

  return {
    lastAutoCaptureTime: latestAutoTime > 0 ? new Date(latestAutoTime).toISOString() : null,
    isSilent24h,
    hasManualExpensesRecently,
    showWarning,
  };
}
