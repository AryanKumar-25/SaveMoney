import { describe, it, expect } from 'vitest';
import { evaluateAlertRules } from '../lib/alertsEngine';

describe('evaluateAlertRules', () => {
  const currentMonth = '2026-10';
  const spendableBudget = 10000;
  const daysRemaining = 9;

  it('triggers under_daily alert when expense is within daily allowance', () => {
    // spendableBudget = 10,000, daysRemaining = 9 -> daily allowance ~1,111
    // spentBeforeToday = 0, spentToday = 400
    const alerts = evaluateAlertRules({
      currentMonth,
      spendableBudget,
      spentSoFar: 400,
      spentToday: 400,
      daysRemaining,
      lastExpense: { amount: 400, merchant: 'Swiggy', date: '2026-10-23T12:00:00' },
      existingFiredKeys: new Set(),
    });

    const underDaily = alerts.find((a) => a.type === 'under_daily');
    expect(underDaily).toBeDefined();
    expect(underDaily?.severity).toBe('info');
    expect(underDaily?.message).toContain('₹400 spent at Swiggy');
    expect(underDaily?.message).toContain('left for today');
  });

  it('triggers over_daily alert when expense exceeds daily allowance', () => {
    // spendableBudget = 10,000, daysRemaining = 9 -> daily allowance ~1,111
    // spentBeforeToday = 0, spentToday = 1500 -> over by 389
    const alerts = evaluateAlertRules({
      currentMonth,
      spendableBudget,
      spentSoFar: 1500,
      spentToday: 1500,
      daysRemaining,
      lastExpense: { amount: 1500, merchant: 'Amazon', date: '2026-10-23T12:00:00' },
      existingFiredKeys: new Set(),
    });

    const overDaily = alerts.find((a) => a.type === 'over_daily');
    expect(overDaily).toBeDefined();
    expect(overDaily?.severity).toBe('warning');
    expect(overDaily?.message).toContain("You're ₹389 over today's limit");
  });

  it('triggers 50%, 80%, and 100% threshold alerts with once-per-month deduplication', () => {
    // Cross 50% threshold (spentSoFar = 5500 of 10000)
    const alerts1 = evaluateAlertRules({
      currentMonth,
      spendableBudget,
      spentSoFar: 5500,
      spentToday: 500,
      daysRemaining: 15,
      lastExpense: { amount: 500, date: '2026-10-15T10:00:00' },
      existingFiredKeys: new Set(),
    });

    const thresh50 = alerts1.find((a) => a.type === 'threshold_50');
    expect(thresh50).toBeDefined();
    expect(thresh50?.severity).toBe('info');
    expect(thresh50?.dedupe_key).toBe('threshold_50_2026-10');

    // Simulate deleting expense and re-crossing 50%: should NOT fire again because key exists
    const firedKeys = new Set(['threshold_50_2026-10']);
    const alerts2 = evaluateAlertRules({
      currentMonth,
      spendableBudget,
      spentSoFar: 5200,
      spentToday: 200,
      daysRemaining: 14,
      lastExpense: { amount: 200, date: '2026-10-16T10:00:00' },
      existingFiredKeys: firedKeys,
    });

    expect(alerts2.find((a) => a.type === 'threshold_50')).toBeUndefined();

    // Now cross 80% (spentSoFar = 8200)
    const alerts3 = evaluateAlertRules({
      currentMonth,
      spendableBudget,
      spentSoFar: 8200,
      spentToday: 3000,
      daysRemaining: 10,
      lastExpense: { amount: 3000, date: '2026-10-20T10:00:00' },
      existingFiredKeys: firedKeys,
    });

    const thresh80 = alerts3.find((a) => a.type === 'threshold_80');
    expect(thresh80).toBeDefined();
    expect(thresh80?.severity).toBe('warning');
    expect(thresh80?.dedupe_key).toBe('threshold_80_2026-10');

    // Cross 100% (spentSoFar = 10500)
    firedKeys.add('threshold_80_2026-10');
    const alerts4 = evaluateAlertRules({
      currentMonth,
      spendableBudget,
      spentSoFar: 10500,
      spentToday: 2300,
      daysRemaining: 5,
      lastExpense: { amount: 2300, date: '2026-10-25T10:00:00' },
      existingFiredKeys: firedKeys,
    });

    const thresh100 = alerts4.find((a) => a.type === 'threshold_100');
    expect(thresh100).toBeDefined();
    expect(thresh100?.severity).toBe('danger');
    expect(thresh100?.message).toContain('over budget by ₹500');

    // Also should trigger savings_risk alert
    const savingsRisk = alerts4.find((a) => a.type === 'savings_risk');
    expect(savingsRisk).toBeDefined();
    expect(savingsRisk?.severity).toBe('danger');
  });

  it('allows threshold alert to fire again in a new month (month rollover)', () => {
    // 2026-10 had fired threshold_50
    const firedKeys = new Set(['threshold_50_2026-10']);

    // Next month: 2026-11 crossing 50%
    const alerts = evaluateAlertRules({
      currentMonth: '2026-11',
      spendableBudget: 10000,
      spentSoFar: 5500,
      spentToday: 500,
      daysRemaining: 15,
      lastExpense: { amount: 500, date: '2026-11-15T10:00:00' },
      existingFiredKeys: firedKeys,
    });

    const thresh50 = alerts.find((a) => a.type === 'threshold_50');
    expect(thresh50).toBeDefined();
    expect(thresh50?.dedupe_key).toBe('threshold_50_2026-11');
  });

  it('triggers projection warning when average daily spend paces over budget', () => {
    // Day 10 of 31-day month (October). Spent 6,000 so far. Budget = 10,000.
    // Average daily = 600/day. Projected = 600 * 31 = 18,600 (exceeds 10,000)
    const mockDate = new Date(2026, 9, 10);
    const alerts = evaluateAlertRules({
      currentMonth,
      spendableBudget,
      spentSoFar: 6000,
      spentToday: 1000,
      daysRemaining: 22,
      lastExpense: { amount: 1000, date: '2026-10-10T10:00:00' },
      existingFiredKeys: new Set(),
      referenceDate: mockDate,
    });

    const projWarning = alerts.find((a) => a.type === 'projection_warning');
    expect(projWarning).toBeDefined();
    expect(projWarning?.severity).toBe('warning');
    expect(projWarning?.message).toContain("At this pace");
    expect(projWarning?.dedupe_key).toBe('projection_warning_2026-10');
  });

  it('respects user disabled settings', () => {
    const alerts = evaluateAlertRules({
      currentMonth,
      spendableBudget,
      spentSoFar: 1500,
      spentToday: 1500,
      daysRemaining,
      lastExpense: { amount: 1500, date: '2026-10-23T12:00:00' },
      existingFiredKeys: new Set(),
      settings: {
        overDaily: false,
        underDaily: false,
        budgetThresholds: false,
        projectionWarning: false,
        savingsAtRisk: false,
      },
    });

    expect(alerts).toHaveLength(0);
  });

  it('handles zero budget gracefully without errors or spam', () => {
    const alerts = evaluateAlertRules({
      currentMonth,
      spendableBudget: 0,
      spentSoFar: 0,
      spentToday: 0,
      daysRemaining: 10,
      existingFiredKeys: new Set(),
    });

    expect(alerts).toHaveLength(0);
  });
});
