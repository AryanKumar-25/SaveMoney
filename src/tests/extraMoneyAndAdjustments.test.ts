import { describe, it, expect, beforeEach } from 'vitest';
import { calculateSpendableBudget, calculateSafeToSpendToday } from '../lib/calculations';
import { StorageService } from '../lib/storage';
import { ExtraMoneyEntry, ExtraMoneyTransfer, BalanceAdjustment } from '../lib/types';

describe('Extra Money and Balance Adjustments', () => {
  beforeEach(() => {
    StorageService.clearMemoryStore();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  describe('Shared Spendable Budget Calculation Formula', () => {
    it('calculates spendable budget accurately with extra transfers and positive balance adjustments', () => {
      // Salary = 1,00,000, Fixed = 30,000, Savings = 25,000
      // Base spendable = 1,00,000 - 30,000 - 25,000 = 45,000
      // Extra transfers = 10,000, Adjustments = +5,000
      // Final spendable = 45,000 + 10,000 + 5,000 = 60,000
      const result = calculateSpendableBudget(100000, 30000, 25000, 10000, 5000);

      expect(result.income).toBe(100000);
      expect(result.totalFixedExpenses).toBe(30000);
      expect(result.savingsTarget).toBe(25000);
      expect(result.extraTransfers).toBe(10000);
      expect(result.balanceAdjustments).toBe(5000);
      expect(result.baseSpendableBudget).toBe(45000);
      expect(result.spendableBudget).toBe(60000);
      expect(result.isDeficit).toBe(false);
    });

    it('calculates spendable budget accurately with negative balance adjustments', () => {
      // Salary = 80,000, Fixed = 20,000, Savings = 20,000
      // Base spendable = 40,000
      // Extra transfers = 0, Adjustments = -7,500 (e.g. forgot an annual subscription / correction)
      // Final spendable = 40,000 - 7,500 = 32,500
      const result = calculateSpendableBudget(80000, 20000, 20000, 0, -7500);

      expect(result.baseSpendableBudget).toBe(40000);
      expect(result.balanceAdjustments).toBe(-7500);
      expect(result.spendableBudget).toBe(32500);
      expect(result.isDeficit).toBe(false);
    });

    it('detects deficit when negative adjustment exceeds spendable balance', () => {
      // Base spendable = 10,000, Negative adjustment = -15,000 -> spendable = -5,000
      const result = calculateSpendableBudget(50000, 25000, 15000, 0, -15000);
      expect(result.spendableBudget).toBe(-5000);
      expect(result.isDeficit).toBe(true);
    });

    it('recalculates daily safe-to-spend today allowance based on the new spendable budget', () => {
      // October 10th in a 31-day month has 22 days left (10th through 31st inclusive)
      const referenceDate = new Date(2026, 9, 10);
      const oldSpendable = 42000;
      const newSpendable = 52500;
      const spentSoFar = 10000;
      const spentToday = 500;

      const before = calculateSafeToSpendToday(oldSpendable, spentSoFar, spentToday, referenceDate);
      const after = calculateSafeToSpendToday(newSpendable, spentSoFar, spentToday, referenceDate);

      expect(before.dailyAllowanceForToday).toBe(1477);
      expect(after.dailyAllowanceForToday).toBe(1955);
      expect(after.safeToSpendRemainingToday).toBe(1955 - 500);
      expect(after.safeToSpendRemainingToday).toBeGreaterThan(before.safeToSpendRemainingToday);
    });
  });

  describe('Extra Money Pool & Transfer Limits', () => {
    it('tracks total received, total transferred, and available extra money in the pool', async () => {
      const userId = 'user-test-1';

      // Initially pool is empty
      let pool = await StorageService.getExtraMoneyPool(userId);
      expect(pool.totalReceived).toBe(0);
      expect(pool.totalTransferred).toBe(0);
      expect(pool.availableExtraMoney).toBe(0);

      // Add two extra money receipts (gift of ₹5,000 and freelance payout of ₹15,000)
      await StorageService.addExtraMoneyEntry(
        { amount: 5000, source: 'Birthday gift', date: '2026-10-05', note: 'From uncle' },
        userId
      );
      await StorageService.addExtraMoneyEntry(
        { amount: 15000, source: 'Freelance web design', date: '2026-10-12' },
        userId
      );

      pool = await StorageService.getExtraMoneyPool(userId);
      expect(pool.totalReceived).toBe(20000);
      expect(pool.totalTransferred).toBe(0);
      expect(pool.availableExtraMoney).toBe(20000);

      // Transfer ₹8,000 to this month's balance
      await StorageService.addExtraMoneyTransfer(
        { amount: 8000, month: '2026-10', note: 'Transferred for festival shopping' },
        userId
      );

      pool = await StorageService.getExtraMoneyPool(userId);
      expect(pool.totalReceived).toBe(20000);
      expect(pool.totalTransferred).toBe(8000);
      expect(pool.availableExtraMoney).toBe(12000);
    });

    it('rejects transfers exceeding available extra money pool', async () => {
      const userId = 'user-test-2';

      await StorageService.addExtraMoneyEntry(
        { amount: 5000, source: 'Refund', date: '2026-10-01' },
        userId
      );

      // Attempting to transfer ₹6,000 when only ₹5,000 is available must throw
      await expect(
        StorageService.addExtraMoneyTransfer(
          { amount: 6000, month: '2026-10' },
          userId
        )
      ).rejects.toThrow(/Cannot transfer ₹6000\. Only ₹5000 available in extra money pool\./i);

      // Pool remains intact
      const pool = await StorageService.getExtraMoneyPool(userId);
      expect(pool.availableExtraMoney).toBe(5000);
      expect(pool.totalTransferred).toBe(0);
    });

    it('undoes an extra money transfer, restoring the available pool and clearing the transfer record', async () => {
      const userId = 'user-test-3';

      await StorageService.addExtraMoneyEntry(
        { amount: 10000, source: 'Festival bonus', date: '2026-10-02' },
        userId
      );

      const transfer = await StorageService.addExtraMoneyTransfer(
        { amount: 4000, month: '2026-10', note: 'Test transfer' },
        userId
      );

      let pool = await StorageService.getExtraMoneyPool(userId);
      expect(pool.availableExtraMoney).toBe(6000);

      // Undo the transfer
      await StorageService.undoExtraMoneyTransfer(transfer.id, userId);

      pool = await StorageService.getExtraMoneyPool(userId);
      expect(pool.availableExtraMoney).toBe(10000);
      expect(pool.totalTransferred).toBe(0);

      const monthTransfers = await StorageService.getMonthExtraMoneyTransfers('2026-10', userId);
      expect(monthTransfers.length).toBe(0);
    });

    it('prevents deleting an extra money entry if it would cause the available pool to become negative', async () => {
      const userId = 'user-test-4';

      const entry1 = await StorageService.addExtraMoneyEntry(
        { amount: 10000, source: 'Freelance gig', date: '2026-10-01' },
        userId
      );

      // Transfer ₹8,000 to monthly balance
      await StorageService.addExtraMoneyTransfer(
        { amount: 8000, month: '2026-10' },
        userId
      );

      // Trying to delete entry1 (₹10,000) when ₹8,000 is already transferred must be rejected
      await expect(
        StorageService.deleteExtraMoneyEntry(entry1.id, userId)
      ).rejects.toThrow(/Cannot delete this extra money entry because/i);

      // Pool should still have ₹2,000 available
      const pool = await StorageService.getExtraMoneyPool(userId);
      expect(pool.availableExtraMoney).toBe(2000);
    });
  });

  describe('Direct Balance Adjustments CRUD & Audit Trail', () => {
    it('creates separate audit records for balance adjustments without overwriting', async () => {
      const userId = 'user-test-5';

      const adj1 = await StorageService.addBalanceAdjustment(
        {
          amount: 2000,
          reason: 'Cash found in drawer',
          month: '2026-10',
          date: '2026-10-05',
        },
        userId
      );

      const adj2 = await StorageService.addBalanceAdjustment(
        {
          amount: -1500,
          reason: 'Forgot a bill',
          month: '2026-10',
          date: '2026-10-10',
        },
        userId
      );

      const adjustments = await StorageService.getBalanceAdjustments('2026-10', userId);
      expect(adjustments.length).toBe(2);
      expect(adjustments.find((a) => a.id === adj1.id)?.amount).toBe(2000);
      expect(adjustments.find((a) => a.id === adj2.id)?.amount).toBe(-1500);

      // Net adjustments total
      const total = adjustments.reduce((sum, a) => sum + a.amount, 0);
      expect(total).toBe(500);
    });

    it('updates an existing adjustment and recalculates correctly', async () => {
      const userId = 'user-test-6';

      const adj = await StorageService.addBalanceAdjustment(
        {
          amount: 1000,
          reason: 'Found some cash',
          month: '2026-10',
          date: '2026-10-03',
        },
        userId
      );

      // User realizes they found ₹3,000 instead of ₹1,000
      await StorageService.updateBalanceAdjustment(
        {
          id: adj.id,
          amount: 3000,
          reason: 'Cash found in travel bag (corrected)',
          date: '2026-10-03',
        },
        userId
      );

      const adjustments = await StorageService.getBalanceAdjustments('2026-10', userId);
      expect(adjustments.length).toBe(1);
      expect(adjustments[0].amount).toBe(3000);
      expect(adjustments[0].reason).toBe('Cash found in travel bag (corrected)');
    });

    it('deletes an adjustment, recalculating the month adjustments back to previous state', async () => {
      const userId = 'user-test-7';

      const adj = await StorageService.addBalanceAdjustment(
        {
          amount: 5000,
          reason: 'Temporary test adjustment',
          month: '2026-10',
          date: '2026-10-15',
        },
        userId
      );

      let adjustments = await StorageService.getBalanceAdjustments('2026-10', userId);
      expect(adjustments.length).toBe(1);

      await StorageService.deleteBalanceAdjustment(adj.id, userId);

      adjustments = await StorageService.getBalanceAdjustments('2026-10', userId);
      expect(adjustments.length).toBe(0);
    });
  });

  describe('Month Rollover & Extra Money Pool Carryover', () => {
    it('keeps past month transfers and adjustments isolated, while unused extra money carries over', async () => {
      const userId = 'user-test-8';

      // 1. User receives ₹50,000 extra money (e.g. annual bonus)
      await StorageService.addExtraMoneyEntry(
        { amount: 50000, source: 'Annual performance bonus', date: '2026-09-15' },
        userId
      );

      // 2. In September (2026-09), user transfers ₹15,000 to September balance
      await StorageService.addExtraMoneyTransfer(
        { amount: 15000, month: '2026-09', note: 'September buffer' },
        userId
      );

      // And adds a September adjustment of -₹2,000
      await StorageService.addBalanceAdjustment(
        { amount: -2000, reason: 'Forgot Sept electricity bill', month: '2026-09', date: '2026-09-20' },
        userId
      );

      // Verify September records
      const septTransfers = await StorageService.getMonthExtraMoneyTransfers('2026-09', userId);
      const septAdjustments = await StorageService.getBalanceAdjustments('2026-09', userId);
      expect(septTransfers.length).toBe(1);
      expect(septTransfers[0].amount).toBe(15000);
      expect(septAdjustments.length).toBe(1);
      expect(septAdjustments[0].amount).toBe(-2000);

      // 3. In October (2026-10), verify October starts clean with NO transfers or adjustments
      const octTransfers = await StorageService.getMonthExtraMoneyTransfers('2026-10', userId);
      const octAdjustments = await StorageService.getBalanceAdjustments('2026-10', userId);
      expect(octTransfers.length).toBe(0);
      expect(octAdjustments.length).toBe(0);

      // 4. BUT the remaining ₹35,000 (50,000 - 15,000) carries over in the global extra money pool!
      const pool = await StorageService.getExtraMoneyPool(userId);
      expect(pool.totalReceived).toBe(50000);
      expect(pool.totalTransferred).toBe(15000);
      expect(pool.availableExtraMoney).toBe(35000);

      // 5. User can now transfer from the carried-over pool into October
      await StorageService.addExtraMoneyTransfer(
        { amount: 10000, month: '2026-10', note: 'Carried over from Sept bonus' },
        userId
      );

      const octTransfersAfter = await StorageService.getMonthExtraMoneyTransfers('2026-10', userId);
      expect(octTransfersAfter.length).toBe(1);
      expect(octTransfersAfter[0].amount).toBe(10000);

      // September remains untouched
      const septTransfersAfter = await StorageService.getMonthExtraMoneyTransfers('2026-09', userId);
      expect(septTransfersAfter.length).toBe(1);
      expect(septTransfersAfter[0].amount).toBe(15000);

      // Remaining pool is now ₹25,000
      const finalPool = await StorageService.getExtraMoneyPool(userId);
      expect(finalPool.availableExtraMoney).toBe(25000);
    });
  });
});
