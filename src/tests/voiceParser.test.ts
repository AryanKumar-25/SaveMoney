import { describe, it, expect } from 'vitest';
import {
  parseExpenseText,
  parseSpokenAmount,
  parseSpokenDate,
  inferCategory,
  isLikelyPersonName,
} from '../lib/voiceParser';

describe('Voice Expense Parser Suite', () => {
  const mockRefDate = new Date('2026-10-27T12:00:00.000Z');

  // ============================================================================
  // 1. AMOUNT PARSING (DIGITS, DECIMALS, SPOKEN NUMBERS, HINDI WORDS)
  // ============================================================================
  describe('parseSpokenAmount', () => {
    it('1. parses plain integer digits', () => {
      const res = parseSpokenAmount('200');
      expect(res.amount).toBe(200);
      expect(res.confidence).toBe('high');
    });

    it('2. parses currency prefixed digits (₹500)', () => {
      const res = parseSpokenAmount('₹500');
      expect(res.amount).toBe(500);
    });

    it('3. parses Rs prefix (rs 350)', () => {
      const res = parseSpokenAmount('rs 350');
      expect(res.amount).toBe(350);
    });

    it('4. parses rupees suffix (450 rupees)', () => {
      const res = parseSpokenAmount('450 rupees');
      expect(res.amount).toBe(450);
    });

    it('5. parses decimals (125.50)', () => {
      const res = parseSpokenAmount('125.50');
      expect(res.amount).toBe(125.5);
    });

    it('6. parses k notation (2.5k)', () => {
      const res = parseSpokenAmount('2.5k');
      expect(res.amount).toBe(2500);
    });

    it('7. parses English spoken single numbers ("eighty")', () => {
      const res = parseSpokenAmount('eighty');
      expect(res.amount).toBe(80);
    });

    it('8. parses English compound hundreds ("two hundred")', () => {
      const res = parseSpokenAmount('two hundred');
      expect(res.amount).toBe(200);
    });

    it('9. parses English complex number ("one thousand five hundred")', () => {
      const res = parseSpokenAmount('one thousand five hundred');
      expect(res.amount).toBe(1500);
    });

    it('10. parses English colloquial ("two fifty")', () => {
      const res = parseSpokenAmount('two fifty');
      expect(res.amount).toBe(250);
    });

    it('11. parses English colloquial ("three fifty")', () => {
      const res = parseSpokenAmount('three fifty');
      expect(res.amount).toBe(350);
    });

    it('12. parses Hindi compound "dedh sau" (150)', () => {
      const res = parseSpokenAmount('dedh sau');
      expect(res.amount).toBe(150);
    });

    it('13. parses Hindi compound "dhai sau" (250)', () => {
      const res = parseSpokenAmount('dhai sau');
      expect(res.amount).toBe(250);
    });

    it('14. parses Hindi compound "paanch sau" (500)', () => {
      const res = parseSpokenAmount('paanch sau');
      expect(res.amount).toBe(500);
    });

    it('15. parses Hindi compound "do sau" (200)', () => {
      const res = parseSpokenAmount('do sau');
      expect(res.amount).toBe(200);
    });

    it('16. parses Hindi compound "dedh hazaar" (1500)', () => {
      const res = parseSpokenAmount('dedh hazaar');
      expect(res.amount).toBe(1500);
    });

    it('17. parses Hindi compound "dhai hazaar" (2500)', () => {
      const res = parseSpokenAmount('dhai hazaar');
      expect(res.amount).toBe(2500);
    });

    it('18. returns null with low confidence when no amount is present', () => {
      const res = parseSpokenAmount('chai at canteen');
      expect(res.amount).toBeNull();
      expect(res.confidence).toBe('low');
    });
  });

  // ============================================================================
  // 2. SPOKEN DATE PARSING
  // ============================================================================
  describe('parseSpokenDate', () => {
    it('19. parses "yesterday" as T-1', () => {
      const res = parseSpokenDate('yesterday', mockRefDate);
      const expected = new Date(mockRefDate);
      expected.setDate(expected.getDate() - 1);
      expect(res.date.slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
    });

    it('20. parses "last night" as T-1', () => {
      const res = parseSpokenDate('dinner last night', mockRefDate);
      const expected = new Date(mockRefDate);
      expected.setDate(expected.getDate() - 1);
      expect(res.date.slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
    });

    it('21. parses Hindi "kal" as T-1', () => {
      const res = parseSpokenDate('kal kharch kiye', mockRefDate);
      const expected = new Date(mockRefDate);
      expected.setDate(expected.getDate() - 1);
      expect(res.date.slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
    });

    it('22. parses Hindi "parso" as T-2', () => {
      const res = parseSpokenDate('parso auto liya', mockRefDate);
      const expected = new Date(mockRefDate);
      expected.setDate(expected.getDate() - 2);
      expect(res.date.slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
    });

    it('23. defaults to reference date when no date word present', () => {
      const res = parseSpokenDate('canteen 80', mockRefDate);
      expect(res.date.slice(0, 10)).toBe(mockRefDate.toISOString().slice(0, 10));
    });
  });

  // ============================================================================
  // 3. REQUIRED PATTERNS SPECIFIED BY USER
  // ============================================================================
  describe('User-specified patterns in parseExpenseText', () => {
    it('24. "spent 200 on food at canteen"', () => {
      const res = parseExpenseText('spent 200 on food at canteen', { referenceDate: mockRefDate });
      expect(res.amount).toBe(200);
      expect(res.category).toBe('Food');
      expect(res.merchant.toLowerCase()).toContain('canteen');
      expect(res.confidence.amount).toBe('high');
    });

    it('25. "spend 200 on food at canteen" (present tense verb)', () => {
      const res = parseExpenseText('spend 200 on food at canteen', { referenceDate: mockRefDate });
      expect(res.amount).toBe(200);
      expect(res.category).toBe('Food');
      expect(res.merchant.toLowerCase()).toContain('canteen');
    });

    it('26. "paid 200 to Atul" (person payee without rule -> Needs review)', () => {
      const res = parseExpenseText('paid 200 to Atul', { referenceDate: mockRefDate });
      expect(res.amount).toBe(200);
      expect(res.merchant).toBe('Atul');
      expect(res.isPersonPayee).toBe(true);
      expect(res.category).toBe('Needs review');
      expect(res.needsReview).toBe(true);
    });

    it('27. "paid Atul 200"', () => {
      const res = parseExpenseText('paid Atul 200', { referenceDate: mockRefDate });
      expect(res.amount).toBe(200);
      expect(res.merchant).toBe('Atul');
      expect(res.isPersonPayee).toBe(true);
    });

    it('28. "200 for chai at tapri"', () => {
      const res = parseExpenseText('200 for chai at tapri', { referenceDate: mockRefDate });
      expect(res.amount).toBe(200);
      expect(res.category).toBe('Food');
      expect(res.merchant.toLowerCase()).toContain('tapri');
    });

    it('29. "bought groceries 450"', () => {
      const res = parseExpenseText('bought groceries 450', { referenceDate: mockRefDate });
      expect(res.amount).toBe(450);
      expect(res.category).toBe('Food');
    });

    it('30. "canteen 80"', () => {
      const res = parseExpenseText('canteen 80', { referenceDate: mockRefDate });
      expect(res.amount).toBe(80);
      expect(res.merchant.toLowerCase()).toBe('canteen');
      expect(res.category).toBe('Food');
    });

    it('31. "auto 60"', () => {
      const res = parseExpenseText('auto 60', { referenceDate: mockRefDate });
      expect(res.amount).toBe(60);
      expect(res.category).toBe('Travel');
      expect(res.merchant.toLowerCase()).toBe('auto');
    });

    it('32. "uber 240"', () => {
      const res = parseExpenseText('uber 240', { referenceDate: mockRefDate });
      expect(res.amount).toBe(240);
      expect(res.category).toBe('Travel');
      expect(res.merchant.toLowerCase()).toBe('uber');
    });

    it('33. "gave 100 to Rahul"', () => {
      const res = parseExpenseText('gave 100 to Rahul', { referenceDate: mockRefDate });
      expect(res.amount).toBe(100);
      expect(res.merchant).toBe('Rahul');
      expect(res.isPersonPayee).toBe(true);
      expect(res.category).toBe('Needs review');
    });

    it('34. Hinglish: "Atul ko 200 diye"', () => {
      const res = parseExpenseText('Atul ko 200 diye', { referenceDate: mockRefDate });
      expect(res.amount).toBe(200);
      expect(res.merchant).toBe('Atul');
      expect(res.isPersonPayee).toBe(true);
    });

    it('35. Hinglish: "canteen mein 80 kharch kiye"', () => {
      const res = parseExpenseText('canteen mein 80 kharch kiye', { referenceDate: mockRefDate });
      expect(res.amount).toBe(80);
      expect(res.merchant.toLowerCase()).toBe('canteen');
      expect(res.category).toBe('Food');
    });
  });

  // ============================================================================
  // 4. CATEGORIES, MERCHANT RULES & EDGE CASES
  // ============================================================================
  describe('Categories, Merchant Rules & Edge Cases', () => {
    it('36. respects saved merchant rule for person ("Atul" -> "Food")', () => {
      const res = parseExpenseText('paid 200 to Atul', {
        merchantRules: { atul: 'Food' },
        referenceDate: mockRefDate,
      });
      expect(res.amount).toBe(200);
      expect(res.category).toBe('Food');
      expect(res.matchedRule).toBe(true);
      expect(res.confidence.category).toBe('high');
    });

    it('37. infers Travel from "metro recharge 200"', () => {
      const res = parseExpenseText('metro recharge 200', { referenceDate: mockRefDate });
      expect(res.amount).toBe(200);
      expect(['Travel', 'Bills']).toContain(res.category);
    });

    it('38. infers Bills from "wifi bill 899"', () => {
      const res = parseExpenseText('wifi bill 899', { referenceDate: mockRefDate });
      expect(res.amount).toBe(899);
      expect(res.category).toBe('Bills');
    });

    it('39. infers Health from "medicine 350 at apollo"', () => {
      const res = parseExpenseText('medicine 350 at apollo', { referenceDate: mockRefDate });
      expect(res.amount).toBe(350);
      expect(res.category).toBe('Health');
    });

    it('40. infers Shopping from "amazon 1200"', () => {
      const res = parseExpenseText('amazon 1200', { referenceDate: mockRefDate });
      expect(res.amount).toBe(1200);
      expect(res.category).toBe('Shopping');
    });

    it('41. infers Entertainment from "movie ticket 450 at pvr"', () => {
      const res = parseExpenseText('movie ticket 450 at pvr', { referenceDate: mockRefDate });
      expect(res.amount).toBe(450);
      expect(res.category).toBe('Entertainment');
    });

    it('42. handles Hindi amount + preposition: "dedh sau chai at tapri yesterday"', () => {
      const res = parseExpenseText('dedh sau chai at tapri yesterday', { referenceDate: mockRefDate });
      expect(res.amount).toBe(150);
      expect(res.category).toBe('Food');
      expect(res.merchant.toLowerCase()).toContain('tapri');
      const expectedDate = new Date(mockRefDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
      expect(res.date.slice(0, 10)).toBe(expectedDate.toISOString().slice(0, 10));
    });

    it('43. handles Hindi amount + Hinglish: "dhai sau auto parso"', () => {
      const res = parseExpenseText('dhai sau auto parso', { referenceDate: mockRefDate });
      expect(res.amount).toBe(250);
      expect(res.category).toBe('Travel');
      const expectedDate = new Date(mockRefDate);
      expectedDate.setDate(expectedDate.getDate() - 2);
      expect(res.date.slice(0, 10)).toBe(expectedDate.toISOString().slice(0, 10));
    });

    it('44. handles missing amount safely with confidence "low"', () => {
      const res = parseExpenseText('lunch at canteen', { referenceDate: mockRefDate });
      expect(res.amount).toBeNull();
      expect(res.confidence.amount).toBe('low');
      expect(res.category).toBe('Food');
    });

    it('45. handles empty string input safely', () => {
      const res = parseExpenseText('', { referenceDate: mockRefDate });
      expect(res.amount).toBeNull();
      expect(res.confidence.amount).toBe('low');
      expect(res.needsReview).toBe(true);
    });
  });
});
