import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateAlerts, getAlertDiagnostics } from '../lib/alertEngine';
import { StorageService } from '../lib/storage';

describe('Server-Side Alert Engine (evaluateAlerts)', () => {
  const userId = 'test-user-123';
  const month = '2026-10';

  async function setupTestBudget(
    m: string,
    income: number,
    savingsTarget: number,
    fixedExpenses: { name: string; amount: number }[] = [],
    uid: string = userId
  ) {
    await StorageService.saveMonthlyBudget(m, income, savingsTarget, uid);
    for (const f of fixedExpenses) {
      await StorageService.upsertFixedExpense({ name: f.name, amount: f.amount, month: m }, uid);
    }
  }

  beforeEach(async () => {
    StorageService.clearMemoryStore();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }

    await StorageService.saveAlertSettings(
      {
        overDaily: true,
        underDaily: true,
        budgetThresholds: true,
        thresholds: [50, 80, 100],
        projectionWarning: true,
        savingsAtRisk: true,
        pushNotifications: false,
      },
      userId
    );
  });

  // ==========================================================================
  // 1. ALL 5 RULES WITH INPUT NUMBERS AND EXPECTED ALERTS
  // ==========================================================================
  describe('Rule 1 & 2: Daily Allowance (Over Limit vs Under Limit with Amount Left)', () => {
    it('triggers under_daily alert with remaining safe-to-spend when expense is within daily limit', async () => {
      // Set up budget: Income 50,000, fixed 20,000, savings 10,000 -> spendable 20,000
      await setupTestBudget(month, 50000, 10000, [{ name: 'Rent', amount: 20000 }]);

      // Trigger an expense of ₹300 at Starbucks
      const result = await evaluateAlerts(userId, month, {
        triggerExpense: {
          amount: 300,
          merchant: 'Starbucks',
          category: 'Food',
        },
        sendPush: false,
      });

      const underAlert = result.newAlerts.find((a) => a.type === 'under_daily');
      expect(underAlert).toBeDefined();
      expect(underAlert?.severity).toBe('info');
      expect(underAlert?.title).toBe('Within Daily Limit');
      expect(underAlert?.message).toContain('₹300 spent at Starbucks');
      expect(underAlert?.message).toContain('remaining for today');
      expect(result.numbers.spendableBudget).toBe(20000);
    });

    it('triggers over_daily alert when expense exceeds today\'s allowance', async () => {
      // Small budget: ₹3,100 for October (31 days) -> ~₹100/day allowance
      await setupTestBudget(month, 5000, 1000, [{ name: 'Phone', amount: 900 }]);

      const testDate = new Date('2026-10-15T12:00:00Z');

      // Add expense of ₹500 today (well over daily limit of ~₹100)
      await StorageService.addExpense(
        {
          amount: 500,
          merchant: 'Zara',
          category: 'Shopping',
          date: testDate.toISOString(),
        },
        userId
      );

      const result = await evaluateAlerts(userId, month, {
        referenceDate: testDate,
        triggerExpense: {
          amount: 500,
          merchant: 'Zara',
          category: 'Shopping',
        },
        sendPush: false,
      });

      const overAlert = result.newAlerts.find((a) => a.type === 'over_daily');
      expect(overAlert).toBeDefined();
      expect(overAlert?.severity).toBe('warning');
      expect(overAlert?.title).toBe("Over Today's Limit");
      expect(overAlert?.message).toContain("You are ₹");
      expect(overAlert?.message).toContain("over today's safe limit");
    });
  });

  describe('Rule 3: Monthly Budget Thresholds (50%, 80%, 100%)', () => {
    it('fires 50% threshold when monthly spending crosses 50%', async () => {
      // Spendable budget = 10,000 (Income 15,000 - fixed 2,000 - savings 3,000)
      await setupTestBudget(month, 15000, 3000, [{ name: 'Wi-Fi', amount: 2000 }]);

      // Add expenses totaling 5,500 (55% of 10,000)
      await StorageService.addExpense(
        { amount: 5500, merchant: 'Grocery Hub', category: 'Food', date: '2026-10-10T10:00:00Z' },
        userId
      );

      const result = await evaluateAlerts(userId, month, { sendPush: false });
      const thresh50 = result.newAlerts.find((a) => a.type === 'threshold_50');

      expect(thresh50).toBeDefined();
      expect(thresh50?.severity).toBe('info');
      expect(thresh50?.title).toBe('50% Monthly Budget Reached');
      expect(thresh50?.dedupe_key).toBe(`${userId}_${month}_threshold_50`);
    });

    it('fires 80% threshold when monthly spending crosses 80%', async () => {
      await setupTestBudget(month, 20000, 5000, [{ name: 'Rent', amount: 5000 }]);

      // Spendable = 10,000. Add expenses of 8,500 (85%)
      await StorageService.addExpense(
        { amount: 8500, merchant: 'Electronics', category: 'Shopping', date: '2026-10-18T10:00:00Z' },
        userId
      );

      const result = await evaluateAlerts(userId, month, { sendPush: false });
      const thresh80 = result.newAlerts.find((a) => a.type === 'threshold_80');

      expect(thresh80).toBeDefined();
      expect(thresh80?.severity).toBe('warning');
      expect(thresh80?.dedupe_key).toBe(`${userId}_${month}_threshold_80`);
    });

    it('fires 100% threshold when monthly spending crosses 100%', async () => {
      await setupTestBudget(month, 20000, 5000, [{ name: 'Rent', amount: 5000 }]);

      // Spendable = 10,000. Add expenses of 10,500 (105%)
      await StorageService.addExpense(
        { amount: 10500, merchant: 'Flight', category: 'Travel', date: '2026-10-22T10:00:00Z' },
        userId
      );

      const result = await evaluateAlerts(userId, month, { sendPush: false });
      const thresh100 = result.newAlerts.find((a) => a.type === 'threshold_100');

      expect(thresh100).toBeDefined();
      expect(thresh100?.severity).toBe('danger');
      expect(thresh100?.title).toBe('100% Budget Reached');
      expect(thresh100?.dedupe_key).toBe(`${userId}_${month}_threshold_100`);
    });
  });

  describe('Rule 4 & 5: Projection Over Budget and Savings at Risk', () => {
    it('fires projection warning when daily spending pace projects over budget', async () => {
      // Spendable = 10,000
      await setupTestBudget(month, 20000, 5000, [{ name: 'Rent', amount: 5000 }]);

      // Spent 7,000 by day 10 of October (pacing ~700/day * 31 = ~21,700 spend)
      await StorageService.addExpense(
        { amount: 7000, merchant: 'Mall', category: 'Shopping', date: '2026-10-10T10:00:00Z' },
        userId
      );

      const result = await evaluateAlerts(userId, month, {
        referenceDate: new Date('2026-10-10T12:00:00Z'),
        sendPush: false,
      });
      const proj = result.newAlerts.find((a) => a.type === 'projection_warning');

      expect(proj).toBeDefined();
      expect(proj?.severity).toBe('warning');
      expect(proj?.dedupe_key).toBe(`${userId}_${month}_projection_warning`);
    });

    it('fires savings_risk danger alert when discretionary spending exceeds spendable budget', async () => {
      // Spendable = 10,000
      await setupTestBudget(month, 20000, 5000, [{ name: 'Rent', amount: 5000 }]);

      // Spend 12,000 -> 2,000 eaten into savings target
      await StorageService.addExpense(
        { amount: 12000, merchant: 'Hospital', category: 'Health', date: '2026-10-20T10:00:00Z' },
        userId
      );

      const result = await evaluateAlerts(userId, month, { sendPush: false });
      const savingsRisk = result.newAlerts.find((a) => a.type === 'savings_risk');

      expect(savingsRisk).toBeDefined();
      expect(savingsRisk?.severity).toBe('danger');
      expect(savingsRisk?.title).toBe('Savings Target at Risk');
      expect(savingsRisk?.message).toContain('Savings at risk');
      expect(savingsRisk?.dedupe_key).toBe(`${userId}_${month}_savings_risk`);
    });
  });

  // ==========================================================================
  // 2. DEDUPLICATION (Firing twice produces exactly 1 alert)
  // ==========================================================================
  describe('Deduplication Guarantee', () => {
    it('produces exactly 1 threshold alert even when evaluateAlerts is executed multiple times', async () => {
      await setupTestBudget(month, 20000, 10000, []);

      // Spend 6,000 (60% of 10,000 spendable budget)
      await StorageService.addExpense(
        { amount: 6000, merchant: 'Store', category: 'Shopping', date: '2026-10-10T10:00:00Z' },
        userId
      );

      // First run: 50% threshold fires
      const run1 = await evaluateAlerts(userId, month, { sendPush: false });
      const thresh1 = run1.newAlerts.filter((a) => a.type === 'threshold_50');
      expect(thresh1).toHaveLength(1);

      // Second run immediately after: 50% threshold MUST NOT fire again
      const run2 = await evaluateAlerts(userId, month, { sendPush: false });
      const thresh2 = run2.newAlerts.filter((a) => a.type === 'threshold_50');
      expect(thresh2).toHaveLength(0);

      // All saved alerts for user should have only 1 threshold_50
      const allAlerts = await StorageService.getAlerts(userId);
      const all50s = allAlerts.filter((a) => a.type === 'threshold_50' && a.month === month);
      expect(all50s).toHaveLength(1);
    });
  });

  // ==========================================================================
  // 3. DELETING AN EXPENSE AND RE-EVALUATING
  // ==========================================================================
  describe('Deleting Expense & Re-evaluation', () => {
    it('updates numbers after deleting an expense and avoids duplicate threshold alerts', async () => {
      await setupTestBudget(month, 20000, 10000, []);

      const exp1 = await StorageService.addExpense(
        { amount: 5500, merchant: 'Store 1', category: 'Shopping', date: '2026-10-05T10:00:00Z' },
        userId
      );

      // First evaluation fires 50%
      await evaluateAlerts(userId, month, { sendPush: false });

      // Delete the expense
      await StorageService.deleteExpense(exp1.id, exp1.date, userId);

      // Re-evaluate: spent goes back to 0
      const postDelete = await evaluateAlerts(userId, month, { sendPush: false });
      expect(postDelete.numbers.spentSoFar).toBe(0);

      // Add another 5,500 expense later
      await StorageService.addExpense(
        { amount: 5500, merchant: 'Store 2', category: 'Shopping', date: '2026-10-15T10:00:00Z' },
        userId
      );

      // Re-evaluate: because 50% already fired for this month, dedupe key prevents creating another
      const secondEval = await evaluateAlerts(userId, month, { sendPush: false });
      const new50 = secondEval.newAlerts.find((a) => a.type === 'threshold_50');
      expect(new50).toBeUndefined();
    });
  });

  // ==========================================================================
  // 4. MONTH ROLLOVER
  // ==========================================================================
  describe('Month Rollover', () => {
    it('allows thresholds to fire independently in a new month', async () => {
      // In 2026-10, fire 50% threshold
      await setupTestBudget('2026-10', 20000, 10000, []);
      await StorageService.addExpense(
        { amount: 6000, merchant: 'October Store', category: 'Shopping', date: '2026-10-10T10:00:00Z' },
        userId
      );
      const octRes = await evaluateAlerts(userId, '2026-10', { sendPush: false });
      expect(octRes.newAlerts.find((a) => a.type === 'threshold_50')).toBeDefined();

      // In 2026-11, crossing 50% MUST fire for 2026-11
      await setupTestBudget('2026-11', 20000, 10000, []);
      await StorageService.addExpense(
        { amount: 6000, merchant: 'November Store', category: 'Shopping', date: '2026-11-10T10:00:00Z' },
        userId
      );
      const novRes = await evaluateAlerts(userId, '2026-11', { sendPush: false });
      const nov50 = novRes.newAlerts.find((a) => a.type === 'threshold_50');

      expect(nov50).toBeDefined();
      expect(nov50?.dedupe_key).toBe(`${userId}_2026-11_threshold_50`);
    });
  });

  // ==========================================================================
  // 5. ZERO BUDGET EDGE CASES
  // ==========================================================================
  describe('Zero Budget & Edge Cases', () => {
    it('handles zero income, zero spendable budget, and month end safely without errors or NaN', async () => {
      await setupTestBudget(month, 0, 0, []);

      const result = await evaluateAlerts(userId, month, { sendPush: false });

      expect(result.success).toBe(true);
      expect(result.numbers.spendableBudget).toBe(0);
      expect(isNaN(result.numbers.percentUsed)).toBe(false);
      expect(isFinite(result.numbers.safeToSpendToday)).toBe(true);
      expect(result.newAlerts).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 6. EXTRA MONEY TRANSFERS & BALANCE ADJUSTMENTS AFFECTING THRESHOLDS
  // ==========================================================================
  describe('Extra Money Transfers & Balance Adjustments', () => {
    it('extra money transfer increases spendable budget and prevents false threshold trigger', async () => {
      // Base spendable budget = 10,000 (Income 20,000 - fixed 5,000 - savings 5,000)
      await setupTestBudget(month, 20000, 5000, [{ name: 'Rent', amount: 5000 }]);

      // Add 5,000 to extra money pool first
      await StorageService.addExtraMoneyEntry(
        {
          amount: 5000,
          source: 'Freelance Bonus',
          date: '2026-10-01T10:00:00Z',
        },
        userId
      );

      // Now transfer ₹5,000 into this month -> new spendable = 15,000
      await StorageService.addExtraMoneyTransfer(
        {
          amount: 5000,
          date: '2026-10-02T10:00:00Z',
          month,
          note: 'Freelance bonus moved to budget',
        },
        userId
      );

      // Spend 6,000
      // Against base budget (10,000) this would be 60% (triggering threshold_50)
      // BUT with extra money transferred (15,000), 6,000 is only 40%!
      await StorageService.addExpense(
        { amount: 6000, merchant: 'Shopping Mall', category: 'Shopping', date: '2026-10-05T10:00:00Z' },
        userId
      );

      const result = await evaluateAlerts(userId, month, { sendPush: false });

      expect(result.numbers.spendableBudget).toBe(15000);
      expect(result.numbers.percentUsed).toBe(40);

      const thresh50 = result.newAlerts.find((a) => a.type === 'threshold_50');
      expect(thresh50).toBeUndefined(); // Should NOT trigger 50%!
    });

    it('negative balance adjustment decreases spendable budget and triggers threshold sooner', async () => {
      // Base spendable budget = 10,000
      await setupTestBudget(month, 20000, 5000, [{ name: 'Rent', amount: 5000 }]);

      // Apply negative adjustment: -₹2,000 ("Forgot annual car insurance")
      // New spendable budget becomes ₹8,000
      await StorageService.addBalanceAdjustment(
        {
          amount: -2000,
          reason: 'Forgot annual car insurance',
          date: '2026-10-02T10:00:00Z',
          month,
        },
        userId
      );

      // Spend 4,500.
      // Against base (10,000), 4,500 is only 45% (no alert).
      // Against adjusted (8,000), 4,500 is 56.25% (threshold_50 SHOULD fire)!
      await StorageService.addExpense(
        { amount: 4500, merchant: 'Grocery', category: 'Food', date: '2026-10-08T10:00:00Z' },
        userId
      );

      const result = await evaluateAlerts(userId, month, { sendPush: false });

      expect(result.numbers.spendableBudget).toBe(8000);
      expect(result.numbers.percentUsed).toBe(56.3);

      const thresh50 = result.newAlerts.find((a) => a.type === 'threshold_50');
      expect(thresh50).toBeDefined();
      expect(thresh50?.dedupe_key).toBe(`${userId}_${month}_threshold_50`);
    });
  });

  // ==========================================================================
  // 7. INTEGRATION TEST: Create expense -> evaluateAlerts -> Alert Row Saved
  // ==========================================================================
  describe('Integration: Expense Creation to Alert Row Persistence', () => {
    it('creates an expense, evaluates alerts, and persists alert row with dedupe key', async () => {
      // 1. Setup budget
      await setupTestBudget(month, 10000, 0, []);

      // 2. Add expense of ₹8,500 (85% of budget)
      const expense = await StorageService.addExpense(
        {
          amount: 8500,
          merchant: 'Air India',
          category: 'Travel',
          date: '2026-10-15T12:00:00Z',
        },
        userId
      );
      expect(expense.id).toBeDefined();

      // 3. Trigger alert evaluation
      const evalResult = await evaluateAlerts(userId, month, {
        triggerExpense: {
          amount: expense.amount,
          merchant: expense.merchant,
          category: expense.category,
        },
        sendPush: false,
      });

      expect(evalResult.success).toBe(true);

      // 4. Verify alerts saved in storage
      const savedAlerts = await StorageService.getAlerts(userId);
      expect(savedAlerts.length).toBeGreaterThan(0);

      // Check 80% threshold alert exists and has correct dedupe key
      const thresh80 = savedAlerts.find(
        (a) => a.dedupe_key === `${userId}_${month}_threshold_80`
      );
      expect(thresh80).toBeDefined();
      expect(thresh80?.severity).toBe('warning');
      expect(thresh80?.month).toBe(month);
      expect(thresh80?.is_read).toBe(false);

      // 5. Diagnostics inspector returns all parameters
      const diag = await getAlertDiagnostics(userId, month);
      expect(diag.numbers.spendableBudget).toBe(10000);
      expect(diag.numbers.spentSoFar).toBe(8500);
      expect(diag.recentAlerts.length).toBeGreaterThan(0);
      expect(diag.envChecks).toBeDefined();
    });
  });
});
