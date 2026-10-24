import { describe, it, expect } from 'vitest';
import {
  calculateAccountStats,
  matchAccountFromSMS,
  validateAccount,
} from '../lib/accountCalculations';
import { Account, Expense } from '../lib/types';

describe('Account Calculations & Statistics', () => {
  const mockBank: Account = {
    id: 'acc-bank-1',
    nickname: 'HDFC Salary A/c',
    type: 'bank',
    bank_or_app_name: 'HDFC Bank',
    last_4_digits: '8910',
    opening_balance: 50000,
  };

  const mockCard: Account = {
    id: 'acc-card-1',
    nickname: 'ICICI Amazon Pay',
    type: 'credit_card',
    bank_or_app_name: 'ICICI Bank',
    last_4_digits: '4592',
    credit_limit: 100000,
    billing_date: 15,
  };

  const mockCash: Account = {
    id: 'acc-cash-1',
    nickname: 'Cash Wallet',
    type: 'cash',
    opening_balance: 5000,
  };

  const mockExpenses: Expense[] = [
    // This month (2026-10) for HDFC Bank
    {
      id: 'e-1',
      account_id: 'acc-bank-1',
      amount: 4500,
      category: 'Bills',
      date: '2026-10-05T10:00:00Z',
    },
    {
      id: 'e-2',
      account_id: 'acc-bank-1',
      amount: 1500,
      category: 'Food',
      date: '2026-10-12T14:30:00Z',
    },
    // Previous month (2026-09) for HDFC Bank
    {
      id: 'e-3',
      account_id: 'acc-bank-1',
      amount: 10000,
      category: 'Rent',
      date: '2026-09-01T09:00:00Z',
    },
    // Credit card spending in 2026-10
    {
      id: 'e-4',
      account_id: 'acc-card-1',
      amount: 82000, // 82% of 100,000 limit
      category: 'Shopping',
      date: '2026-10-20T18:00:00Z',
    },
    // Cash spending
    {
      id: 'e-5',
      account_id: 'acc-cash-1',
      amount: 1200,
      category: 'Food',
      date: '2026-10-22T12:00:00Z',
    },
  ];

  it('calculates spent this month and total spent per account', () => {
    const bankStats = calculateAccountStats(mockBank, mockExpenses, '2026-10');
    expect(bankStats.spentThisMonth).toBe(6000); // 4500 + 1500
    expect(bankStats.totalSpent).toBe(16000); // 4500 + 1500 + 10000
    expect(bankStats.expenseCount).toBe(3);
  });

  it('calculates estimated bank balance: opening balance minus total spent', () => {
    const bankStats = calculateAccountStats(mockBank, mockExpenses, '2026-10');
    // Opening balance 50,000 - Total spent 16,000 = 34,000
    expect(bankStats.estimatedBalance).toBe(34000);
  });

  it('calculates cash wallet balance correctly', () => {
    const cashStats = calculateAccountStats(mockCash, mockExpenses, '2026-10');
    // Opening balance 5,000 - Total spent 1,200 = 3,800
    expect(cashStats.estimatedBalance).toBe(3800);
    expect(cashStats.spentThisMonth).toBe(1200);
  });

  it('calculates credit card utilization and flags >= 80% as high utilization', () => {
    const cardStats = calculateAccountStats(mockCard, mockExpenses, '2026-10');
    // Spent 82,000 / Limit 100,000 = 82%
    expect(cardStats.spentThisMonth).toBe(82000);
    expect(cardStats.creditUtilizationPercent).toBe(82);
    expect(cardStats.isHighUtilization).toBe(true);
  });

  it('does not flag high utilization when credit card spending is below 80%', () => {
    const lowExpenses: Expense[] = [
      {
        id: 'e-low',
        account_id: 'acc-card-1',
        amount: 25000, // 25%
        category: 'Shopping',
        date: '2026-10-15T10:00:00Z',
      },
    ];

    const cardStats = calculateAccountStats(mockCard, lowExpenses, '2026-10');
    expect(cardStats.creditUtilizationPercent).toBe(25);
    expect(cardStats.isHighUtilization).toBe(false);
  });
});

describe('SMS Account Matching', () => {
  const accounts: Account[] = [
    {
      id: 'acc-hdfc',
      nickname: 'HDFC Salary',
      type: 'bank',
      bank_or_app_name: 'HDFC Bank',
      last_4_digits: '8910',
    },
    {
      id: 'acc-icici',
      nickname: 'Amazon Pay ICICI',
      type: 'credit_card',
      bank_or_app_name: 'ICICI Bank',
      last_4_digits: '4592',
    },
    {
      id: 'acc-sbi',
      nickname: 'SBI Savings',
      type: 'bank',
      bank_or_app_name: 'State Bank of India',
      last_4_digits: '3411',
    },
    {
      id: 'acc-phonepe',
      nickname: 'PhonePe UPI',
      type: 'upi',
      bank_or_app_name: 'PhonePe',
    },
  ];

  it('matches account by last 4 digits in card transaction SMS', () => {
    const sms = 'Alert: Rs 1,499.00 spent on ICICI Bank Card ending 4592 at Zomato on 23-Oct-26.';
    const matched = matchAccountFromSMS(sms, accounts);
    expect(matched).not.toBeNull();
    expect(matched?.id).toBe('acc-icici');
  });

  it('matches account by A/c digits format (*8910)', () => {
    const sms = 'Rs 450 debited from A/c *8910 to Swiggy on 22-Oct-26. Avl bal Rs 34,200. HDFC Bank';
    const matched = matchAccountFromSMS(sms, accounts);
    expect(matched).not.toBeNull();
    expect(matched?.id).toBe('acc-hdfc');
  });

  it('matches account by bank name when digits are not present', () => {
    const sms = 'Dear Customer, your SBI account has been debited by Rs 2,000 for UPI txn.';
    const matched = matchAccountFromSMS(sms, accounts);
    expect(matched).not.toBeNull();
    expect(matched?.id).toBe('acc-sbi');
  });

  it('matches account by UPI app name', () => {
    const sms = 'You paid Rs 150 to Sharma Groceries using PhonePe.';
    const matched = matchAccountFromSMS(sms, accounts);
    expect(matched).not.toBeNull();
    expect(matched?.id).toBe('acc-phonepe');
  });

  it('returns null when no account matches SMS text', () => {
    const sms = 'Your Citibank card ending 9999 was charged Rs 500.';
    const matched = matchAccountFromSMS(sms, accounts);
    expect(matched).toBeNull();
  });
});

describe('Account Validation', () => {
  it('rejects empty nickname', () => {
    const result = validateAccount({ nickname: '', type: 'bank' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('nickname is required');
  });

  it('rejects invalid last 4 digits (e.g. 3 digits or non-numeric)', () => {
    const result3 = validateAccount({ nickname: 'HDFC', type: 'bank', last_4_digits: '123' });
    expect(result3.valid).toBe(false);

    const resultChars = validateAccount({ nickname: 'HDFC', type: 'bank', last_4_digits: '12a4' });
    expect(resultChars.valid).toBe(false);
  });

  it('rejects invalid billing date (> 31 or < 1)', () => {
    const resultOver = validateAccount({ nickname: 'Card', type: 'credit_card', billing_date: 32 });
    expect(resultOver.valid).toBe(false);

    const resultZero = validateAccount({ nickname: 'Card', type: 'credit_card', billing_date: 0 });
    expect(resultZero.valid).toBe(false);
  });

  it('accepts valid account details', () => {
    const validResult = validateAccount({
      nickname: 'HDFC Salary A/c',
      type: 'bank',
      last_4_digits: '8910',
      opening_balance: 25000,
    });
    expect(validResult.valid).toBe(true);
  });
});
