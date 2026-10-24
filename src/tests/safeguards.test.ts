import { describe, it, expect } from 'vitest';
import {
  calculateReconciliationDifference,
  needsReconciliationReminder,
  isZeroSpendDay,
  evaluateDailyCheckIn,
  detectDuplicateExpense,
  autoCategorizeMerchant,
  parseCSVStatement,
  evaluateCaptureHealth,
} from '../lib/safeguardCalculations';
import { Expense, Category, Account } from '../lib/types';

describe('Safeguards for Missed & Incomplete Expense Capture', () => {
  // ============================================================================
  // 1. RECONCILIATION DIFFERENCE CALCULATION
  // ============================================================================
  describe('Reconciliation Difference Calculation', () => {
    it('returns "match" when actual balance equals estimated balance', () => {
      const result = calculateReconciliationDifference({
        actualBalance: 25000,
        estimatedBalance: 25000,
      });

      expect(result.status).toBe('match');
      expect(result.difference).toBe(0);
      expect(result.differenceFormatted).toBe('Balances match perfectly (₹0 difference)');
      expect(result.recommendedAction).toBe('confirm');
    });

    it('handles floating point precision differences (< 1 paisa) as a match', () => {
      const result = calculateReconciliationDifference({
        actualBalance: 10000.004,
        estimatedBalance: 10000.0,
      });

      expect(result.status).toBe('match');
      expect(result.difference).toBe(0);
      expect(result.recommendedAction).toBe('confirm');
    });

    it('correctly calculates unaccounted deficit when real bank balance is lower', () => {
      // User has ₹49,360 in bank, but app estimated ₹50,000 -> ₹640 unaccounted for
      const result = calculateReconciliationDifference({
        actualBalance: 49360,
        estimatedBalance: 50000,
      });

      expect(result.status).toBe('unaccounted');
      expect(result.difference).toBe(-640);
      expect(result.unaccountedAmount).toBe(640);
      expect(result.differenceFormatted).toBe('₹640 unaccounted for');
      expect(result.recommendedAction).toBe('add_expense');
    });

    it('correctly calculates extra surplus when real bank balance is higher', () => {
      // User has ₹52,000 in bank, but app estimated ₹50,000 -> ₹2,000 extra
      const result = calculateReconciliationDifference({
        actualBalance: 52000,
        estimatedBalance: 50000,
      });

      expect(result.status).toBe('extra');
      expect(result.difference).toBe(2000);
      expect(result.unaccountedAmount).toBe(2000);
      expect(result.differenceFormatted).toBe('₹2,000 extra in bank');
      expect(result.recommendedAction).toBe('adjust_balance');
    });

    it('evaluates weekly reconciliation reminder threshold (7 days)', () => {
      const now = new Date('2026-10-24T12:00:00Z');

      // No previous reconciliation -> reminder needed
      expect(needsReconciliationReminder(undefined, now, true)).toBe(true);
      expect(needsReconciliationReminder(null, now, true)).toBe(true);

      // Reconciled 3 days ago -> no reminder
      const threeDaysAgo = '2026-10-21T12:00:00Z';
      expect(needsReconciliationReminder(threeDaysAgo, now, true)).toBe(false);

      // Reconciled 8 days ago -> reminder needed
      const eightDaysAgo = '2026-10-16T12:00:00Z';
      expect(needsReconciliationReminder(eightDaysAgo, now, true)).toBe(true);

      // When weekly reminder setting is disabled -> false regardless of elapsed time
      expect(needsReconciliationReminder(eightDaysAgo, now, false)).toBe(false);
    });
  });

  // ============================================================================
  // 2. ZERO-SPEND-DAY & DAILY CHECK-IN
  // ============================================================================
  describe('Zero-Spend-Day & Daily Check-in', () => {
    const todayStr = '2026-10-24';

    it('identifies a zero-spend day when no expenses exist for today', () => {
      const expenses: Expense[] = [
        { id: '1', amount: 500, category: 'Food', date: '2026-10-23T10:00:00Z', merchant: 'Zomato' },
      ];
      expect(isZeroSpendDay(expenses, todayStr)).toBe(true);
    });

    it('identifies a zero-spend day when expenses exist but sum to 0', () => {
      const expenses: Expense[] = [
        { id: '1', amount: 0, category: 'General', date: `${todayStr}T11:00:00Z` },
      ];
      expect(isZeroSpendDay(expenses, todayStr)).toBe(true);
    });

    it('returns false for zero-spend day when positive spending is recorded today', () => {
      const expenses: Expense[] = [
        { id: '1', amount: 240, category: 'Food', date: `${todayStr}T14:30:00Z`, merchant: 'Chai Point' },
      ];
      expect(isZeroSpendDay(expenses, todayStr)).toBe(false);
    });

    it('evaluates daily check-in prompt for zero-spend day', () => {
      const evalZero = evaluateDailyCheckIn({
        expenses: [],
        checkInStatus: null,
        currentTime: new Date('2026-10-24T21:30:00Z'),
        configuredTime: '21:00',
        ignoreTimeWindow: true,
      });

      expect(evalZero.isZeroSpend).toBe(true);
      expect(evalZero.shouldShow).toBe(true);
      expect(evalZero.title).toBe('No spending recorded today. Is that right?');
    });

    it('evaluates daily check-in prompt when spending was recorded', () => {
      const expenses: Expense[] = [
        { id: '1', amount: 450, category: 'Dining', date: `${new Date().toISOString().slice(0, 10)}T12:00:00Z` },
      ];

      const evalActive = evaluateDailyCheckIn({
        expenses,
        checkInStatus: null,
        ignoreTimeWindow: true,
      });

      expect(evalActive.isZeroSpend).toBe(false);
      expect(evalActive.shouldShow).toBe(true);
      expect(evalActive.title).toBe('Daily Check-in: Anything not logged today?');
      expect(evalActive.todaySpent).toBe(450);
    });

    it('does not show check-in if user already confirmed today', () => {
      const todayKey = new Date().toISOString().slice(0, 10);
      const evalConfirmed = evaluateDailyCheckIn({
        expenses: [],
        checkInStatus: { date: todayKey, confirmed: true, type: 'nothing_missed' },
        ignoreTimeWindow: true,
      });

      expect(evalConfirmed.shouldShow).toBe(false);
      expect(evalConfirmed.isConfirmed).toBe(true);
    });
  });

  // ============================================================================
  // 3. DUPLICATE DETECTION & MULTI-SOURCE (SMS + UPI NOTIFICATION)
  // ============================================================================
  describe('Duplicate Detection & Multi-Source Protection', () => {
    const existingExpenses: Expense[] = [
      {
        id: 'exp-1',
        amount: 320,
        category: 'Food',
        date: '2026-10-24T13:00:00Z',
        merchant: 'Swiggy',
        source: 'notification',
      },
      {
        id: 'exp-2',
        amount: 1500,
        category: 'Groceries',
        date: '2026-10-24T09:00:00Z',
        merchant: 'Blinkit',
        source: 'sms',
      },
    ];

    it('flags exact duplicate matching amount, time window within 24h, and same merchant', () => {
      const candidate = {
        amount: 320,
        date: '2026-10-24T13:05:00Z', // 5 minutes later via SMS
        merchant: 'Swiggy Order #1234',
      };

      const result = detectDuplicateExpense(candidate, existingExpenses);
      expect(result.isDuplicate).toBe(true);
      expect(result.matchedExpense?.id).toBe('exp-1');
    });

    it('supports receiving the same payment from SMS and UPI notification without creating duplicates', () => {
      // Transaction 1: UPI notification arrives immediately
      const upiNotification = {
        amount: 1500,
        date: '2026-10-24T09:01:00Z',
        merchant: 'Blinkit Commerce',
        note: 'UPI ref 987654',
      };

      const dupCheck = detectDuplicateExpense(upiNotification, existingExpenses);
      expect(dupCheck.isDuplicate).toBe(true);
      expect(dupCheck.matchedExpense?.id).toBe('exp-2');
    });

    it('does not flag as duplicate if amount is different', () => {
      const candidate = {
        amount: 450, // different amount
        date: '2026-10-24T13:00:00Z',
        merchant: 'Swiggy',
      };

      const result = detectDuplicateExpense(candidate, existingExpenses);
      expect(result.isDuplicate).toBe(false);
    });

    it('does not flag as duplicate if date is more than 24 hours apart', () => {
      const candidate = {
        amount: 320,
        date: '2026-10-27T13:00:00Z', // 3 days later
        merchant: 'Swiggy',
      };

      const result = detectDuplicateExpense(candidate, existingExpenses);
      expect(result.isDuplicate).toBe(false);
    });

    it('does not flag as duplicate if merchant keywords do not match', () => {
      const candidate = {
        amount: 320,
        date: '2026-10-24T13:00:00Z',
        merchant: 'Uber Trip', // totally different merchant
      };

      const result = detectDuplicateExpense(candidate, existingExpenses);
      expect(result.isDuplicate).toBe(false);
    });
  });

  // ============================================================================
  // 4. BANK STATEMENT CSV PARSER
  // ============================================================================
  describe('Bank Statement CSV Parser', () => {
    const categories: Category[] = [
      { id: 'c1', name: 'Food & Dining', color: '#F7931A' },
      { id: 'c2', name: 'Transportation', color: '#3B82F6' },
      { id: 'c3', name: 'Shopping', color: '#EC4899' },
    ];

    const existingExpenses: Expense[] = [
      {
        id: 'exist-1',
        amount: 1200,
        category: 'Shopping',
        date: '2026-10-20T10:00:00Z',
        merchant: 'Amazon Pay India',
      },
    ];

    const sampleCsv = `Date,Narration,Withdrawal Amount,Deposit Amount
20/10/2026,Amazon Pay India,1200.00,
21/10/2026,Swiggy Bangalore,450.50,
22/10/2026,Uber India Systems,280.00,
23/10/2026,Monthly Salary Credit,,75000.00
24/10/2026,Unknown Corner Kirana,150.00,`;

    it('parses CSV, imports only debits, and skips deposits/credits', () => {
      const parsed = parseCSVStatement({
        csvText: sampleCsv,
        mapping: {
          id: 'hdfc-default',
          bankName: 'HDFC Bank',
          dateCol: 'Date',
          descCol: 'Narration',
          debitCol: 'Withdrawal Amount',
          creditCol: 'Deposit Amount',
        },
        existingExpenses,
        categories,
      });

      // 4 debit rows, 1 credit row skipped
      expect(parsed.rows.length).toBe(4);
      expect(parsed.creditCount).toBe(1);

      // Amazon row (₹1200) should be detected as duplicate of exist-1
      expect(parsed.duplicateCount).toBe(1);
      const amazonRow = parsed.rows.find((r) => r.description.includes('Amazon'));
      expect(amazonRow?.isDuplicate).toBe(true);
      expect(amazonRow?.selected).toBe(false); // Duplicates unticked by default

      // 3 new rows
      expect(parsed.newCount).toBe(3);
      const swiggyRow = parsed.rows.find((r) => r.description.includes('Swiggy'));
      expect(swiggyRow?.isDuplicate).toBe(false);
      expect(swiggyRow?.selected).toBe(true); // New rows ticked by default
      expect(swiggyRow?.debitAmount).toBe(450.5);

      // Auto-categorization: Swiggy -> Food & Dining, Uber -> Transportation, Unknown -> Needs review
      expect(swiggyRow?.suggestedCategory).toBe('Food & Dining');
      const uberRow = parsed.rows.find((r) => r.description.includes('Uber'));
      expect(uberRow?.suggestedCategory).toBe('Transportation');
      const unknownRow = parsed.rows.find((r) => r.description.includes('Unknown Corner Kirana'));
      expect(unknownRow?.suggestedCategory).toBe('Needs review');
    });
  });

  // ============================================================================
  // 5. CAPTURE HEALTH EVALUATION
  // ============================================================================
  describe('Capture Health Evaluation', () => {
    it('shows warning when auto-capture is silent for 24+ hours while manual entries were recorded', () => {
      const currentTime = new Date('2026-10-24T18:00:00Z');
      const twoDaysAgo = '2026-10-22T10:00:00Z';
      const twoHoursAgo = '2026-10-24T16:00:00Z';

      const expenses: Expense[] = [
        {
          id: 'e1',
          amount: 250,
          category: 'Food',
          date: twoHoursAgo,
          source: 'manual', // manual entry added today!
        },
      ];

      const health = evaluateCaptureHealth(expenses, twoDaysAgo, currentTime);

      expect(health.isSilent24h).toBe(true);
      expect(health.hasManualExpensesRecently).toBe(true);
      expect(health.showWarning).toBe(true);
    });

    it('does not show warning when auto-capture occurred recently', () => {
      const currentTime = new Date('2026-10-24T18:00:00Z');
      const threeHoursAgo = '2026-10-24T15:00:00Z';

      const expenses: Expense[] = [
        {
          id: 'e1',
          amount: 250,
          category: 'Food',
          date: threeHoursAgo,
          source: 'sms',
        },
      ];

      const health = evaluateCaptureHealth(expenses, threeHoursAgo, currentTime);

      expect(health.isSilent24h).toBe(false);
      expect(health.showWarning).toBe(false);
    });

    it('does not show warning when no manual expenses were added recently', () => {
      const currentTime = new Date('2026-10-24T18:00:00Z');
      const fourDaysAgo = '2026-10-20T10:00:00Z';

      const health = evaluateCaptureHealth([], fourDaysAgo, currentTime);

      // Silent, but user hasn't added any manual expenses either (just quiet period)
      expect(health.isSilent24h).toBe(true);
      expect(health.hasManualExpensesRecently).toBe(false);
      expect(health.showWarning).toBe(false);
    });
  });
});
