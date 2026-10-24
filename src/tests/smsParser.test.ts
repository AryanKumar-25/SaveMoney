import { describe, it, expect } from 'vitest';
import { parseTransactionSMS } from '../lib/smsParser';

describe('parseTransactionSMS - Indian Bank & UPI Formats', () => {
  it('1. parses HDFC Bank Card SMS correctly', () => {
    const sms = 'Alert: You have spent Rs.450 on HDFC Bank Card ending 1234 at SWIGGY on 23-OCT-26. Avail limit: INR 45,000.';
    const result = parseTransactionSMS(sms);

    expect(result.success).toBe(true);
    expect(result.amount).toBe(450);
    expect(result.merchant?.toUpperCase()).toContain('SWIGGY');
    expect(result.suggestedCategory).toBe('Food');
  });

  it('2. parses SBI Bank UPI SMS with comma amount', () => {
    const sms = 'Dear SBI User, your A/c ending 3411 debited by Rs.1,200.00 on 23Oct26 transfer to Zomato UPI Ref 328912891. Bal Rs 18,200.';
    const result = parseTransactionSMS(sms);

    expect(result.success).toBe(true);
    expect(result.amount).toBe(1200);
    expect(result.merchant?.toUpperCase()).toContain('ZOMATO');
    expect(result.suggestedCategory).toBe('Food');
  });

  it('3. parses ICICI Bank UPI SMS with Info header', () => {
    const sms = 'ICICI Bank Acct XX4592 debited for Rs 850.00 on 23-Oct-26. Info: UPI/328912/Uber India. Available Bal INR 45,210.00.';
    const result = parseTransactionSMS(sms);

    expect(result.success).toBe(true);
    expect(result.amount).toBe(850);
    expect(result.merchant?.toUpperCase()).toContain('UBER');
    expect(result.suggestedCategory).toBe('Travel');
  });

  it('4. parses Axis Bank debit SMS with subscription service', () => {
    const sms = 'Rs 299.00 debited from Axis Bank A/c ending 7890 on 23-10-26 to NETFLIX. Ref no 987123. Avail bal INR 12,400.';
    const result = parseTransactionSMS(sms);

    expect(result.success).toBe(true);
    expect(result.amount).toBe(299);
    expect(result.merchant?.toUpperCase()).toContain('NETFLIX');
    expect(result.suggestedCategory).toBe('Entertainment');
  });

  it('5. parses Google Pay transaction notification', () => {
    const sms = 'Paid Rs. 150 to Chai Point on Google Pay. Transaction ID: GPAY1234.';
    const result = parseTransactionSMS(sms);

    expect(result.success).toBe(true);
    expect(result.amount).toBe(150);
    expect(result.merchant?.toUpperCase()).toContain('CHAI POINT');
    expect(result.suggestedCategory).toBe('Food');
  });

  it('6. parses PhonePe transfer notification', () => {
    const sms = 'Sent Rs. 420 to Ramesh Kumar via PhonePe on 23-10-2026. Ref: 456789.';
    const result = parseTransactionSMS(sms);

    expect(result.success).toBe(true);
    expect(result.amount).toBe(420);
    expect(result.merchant?.toUpperCase()).toContain('RAMESH KUMAR');
  });

  it('7. parses Paytm UPI with ecommerce merchant', () => {
    const sms = 'Rs. 2,499 paid to Amazon India using Paytm UPI on 23/10/26.';
    const result = parseTransactionSMS(sms);

    expect(result.success).toBe(true);
    expect(result.amount).toBe(2499);
    expect(result.merchant?.toUpperCase()).toContain('AMAZON');
    expect(result.suggestedCategory).toBe('Shopping');
  });

  it('8. parses Kotak Mahindra Bank transfer with health merchant', () => {
    const sms = 'Sent Rs. 650.00 from Kotak Bank AC X9912 to Apollo Pharmacy on 23-Oct-26. Ref 112233.';
    const result = parseTransactionSMS(sms);

    expect(result.success).toBe(true);
    expect(result.amount).toBe(650);
    expect(result.merchant?.toUpperCase()).toContain('APOLLO');
    expect(result.suggestedCategory).toBe('Health');
  });

  it('9. handles invalid or non-transaction messages gracefully', () => {
    const sms = 'Your OTP for logging into NetBanking is 591244. Do not share it with anyone.';
    const result = parseTransactionSMS(sms);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
