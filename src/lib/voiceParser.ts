import { Expense } from './types';

export type FieldConfidence = 'high' | 'medium' | 'low';

export interface ParsedVoiceExpense {
  amount: number | null;
  category: string;
  merchant: string;
  note: string;
  date: string; // ISO string
  isPersonPayee: boolean;
  needsReview: boolean;
  confidence: {
    amount: FieldConfidence;
    category: FieldConfidence;
    merchant: FieldConfidence;
    date: FieldConfidence;
  };
  matchedRule?: boolean;
}

export interface VoiceParserContext {
  merchantRules?: Record<string, string>; // lowercase merchant -> category
  pastExpenses?: Expense[];
  categories?: string[];
  referenceDate?: Date;
}

// Category keyword map
export const VOICE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: [
    'food', 'chai', 'tea', 'coffee', 'lunch', 'dinner', 'breakfast', 'snacks',
    'canteen', 'restaurant', 'swiggy', 'zomato', 'tapri', 'dhaba', 'burger',
    'pizza', 'bakery', 'groceries', 'grocery', 'cafe', 'eats', 'mithai',
    'khana', 'nashta', 'chai-paani', 'biryani', 'mcdonald', 'kfc', 'subway',
    'dominos', 'starbucks', 'dosa', 'samosa'
  ],
  Travel: [
    'auto', 'uber', 'ola', 'bus', 'metro', 'petrol', 'diesel', 'fuel',
    'taxi', 'cab', 'train', 'flight', 'rapido', 'toll', 'parking',
    'fare', 'kiraya', 'railway', 'train ticket', 'flight ticket', 'bus ticket'
  ],
  Bills: [
    'recharge', 'rent', 'bill', 'wifi', 'electricity', 'water', 'gas',
    'broadband', 'dth', 'airtel', 'jio', 'vi', 'cylinder', 'bijli'
  ],
  Entertainment: [
    'movie', 'game', 'netflix', 'cinema', 'theatre', 'prime', 'spotify',
    'concert', 'match', 'hotstar', 'pvr', 'inox', 'youtube', 'gaming', 'film'
  ],
  Health: [
    'medicine', 'doctor', 'pharmacy', 'clinic', 'hospital', 'lab', 'test',
    'chemist', 'medplus', 'apollo', '1mg', 'tablet', 'dawa', 'dawakhana'
  ],
  Shopping: [
    'clothes', 'amazon', 'flipkart', 'myntra', 'mall', 'shoes', 'shopping',
    'dress', 'zara', 'h&m', 'dmart', 'blinkit', 'zepto', 'instamart',
    'kapde', 'shirt', 'pants', 'tshirt'
  ],
};

// Word-to-number mapping
const SPOKEN_NUMBER_WORDS: Record<string, number> = {
  // English digits & teens
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lac: 100000,
  crore: 10000000,

  // Hindi numbers
  ek: 1,
  do: 2,
  teen: 3,
  chaar: 4,
  char: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  che: 6,
  saat: 7,
  aath: 8,
  ath: 8,
  nau: 9,
  das: 10,
  gyaarah: 11,
  baarah: 12,
  terah: 13,
  chaudah: 14,
  pandrah: 15,
  solah: 16,
  satrah: 17,
  atharah: 18,
  athaarah: 18,
  unnis: 19,
  bees: 20,
  pachees: 25,
  pachis: 25,
  tees: 30,
  chalis: 40,
  pachaas: 50,
  pachas: 50,
  saath: 60,
  sath: 60,
  sattar: 70,
  assi: 80,
  nabbe: 90,
  sau: 100,
  so: 100,
  hazaar: 1000,
  hazar: 1000,
  hajar: 1000,
};

// Hindi fraction & compound terms
const SPECIAL_SPOKEN_AMOUNTS: Record<string, number> = {
  'dedh sau': 150,
  'dedhso': 150,
  'dedh so': 150,
  'dhed sau': 150,
  'dhai sau': 250,
  'dhaiso': 250,
  'dhai so': 250,
  'adhai sau': 250,
  'dedh hazaar': 1500,
  'dedh hazar': 1500,
  'dedh hajar': 1500,
  'dhai hazaar': 2500,
  'dhai hazar': 2500,
  'dhai hajar': 2500,
  'do sau': 200,
  'doso': 200,
  'do so': 200,
  'teen sau': 300,
  'teen so': 300,
  'chaar sau': 400,
  'char sau': 400,
  'paanch sau': 500,
  'panch sau': 500,
  'panchso': 500,
  'chhe sau': 600,
  'saat sau': 700,
  'aath sau': 800,
  'nau sau': 900,
  'ek hazaar': 1000,
  'ek hazar': 1000,
  'do hazaar': 2000,
  'do hazar': 2000,
  'paanch hazaar': 5000,
  'panch hazar': 5000,
  'das hazaar': 10000,
  'das hazar': 10000,

  // Colloquial English hundreds
  'two fifty': 250,
  'three fifty': 350,
  'four fifty': 450,
  'one fifty': 150,
  'five fifty': 550,
  'six fifty': 650,
  'seven fifty': 750,
  'eight fifty': 850,
  'nine fifty': 950,
};

/**
 * Extracts numeric amount from text containing digits or spoken words.
 */
export function parseSpokenAmount(text: string): {
  amount: number | null;
  matchedText: string;
  confidence: FieldConfidence;
} {
  const lower = text.toLowerCase().trim();

  // 1. Check for special spoken combinations (e.g. "dedh sau", "dhai sau", "two fifty")
  for (const [phrase, val] of Object.entries(SPECIAL_SPOKEN_AMOUNTS)) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'i');
    const match = lower.match(regex);
    if (match) {
      return {
        amount: val,
        matchedText: match[0],
        confidence: 'high',
      };
    }
  }

  // 2. Check for explicit numeric digits (e.g. "200", "₹200", "200.50", "200 rupees", "rs 200")
  const digitRegex = /(?:(?:₹|rs\.?|inr)\s*)?(\d+(?:\.\d{1,2})?)(?:\s*(?:rupees|rupee|rs\.?|inr|\/-|bucks|k))?/i;
  const digitMatch = lower.match(digitRegex);
  if (digitMatch && digitMatch[1]) {
    let num = parseFloat(digitMatch[1]);
    if (digitMatch[0].endsWith('k') && !digitMatch[0].includes(' ')) {
      num *= 1000;
    }
    if (!isNaN(num) && num > 0) {
      return {
        amount: num,
        matchedText: digitMatch[0],
        confidence: 'high',
      };
    }
  }

  // 3. Multi-word spoken number parser (e.g. "one thousand five hundred", "two hundred forty")
  const words = lower.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  let bestVal: number | null = null;
  let bestMatchedPhrase = '';

  for (let i = 0; i < words.length; i++) {
    let currentVal = 0;
    let tempSum = 0;
    let sequenceMatched: string[] = [];

    for (let j = i; j < words.length; j++) {
      const w = words[j];
      const num = SPOKEN_NUMBER_WORDS[w];

      if (num === undefined) {
        if (w === 'and') continue;
        break;
      }

      sequenceMatched.push(w);

      if (num === 100) {
        tempSum = (tempSum || 1) * 100;
      } else if (num === 1000 || num === 100000 || num === 10000000) {
        tempSum = (tempSum || 1) * num;
        currentVal += tempSum;
        tempSum = 0;
      } else {
        tempSum += num;
      }
    }

    const total = currentVal + tempSum;
    if (total > 0 && sequenceMatched.length > 0) {
      if (!bestVal || sequenceMatched.length > bestMatchedPhrase.split(' ').length) {
        bestVal = total;
        bestMatchedPhrase = sequenceMatched.join(' ');
      }
    }
  }

  if (bestVal && bestVal > 0) {
    return {
      amount: bestVal,
      matchedText: bestMatchedPhrase,
      confidence: 'high',
    };
  }

  return {
    amount: null,
    matchedText: '',
    confidence: 'low',
  };
}

/**
 * Extracts date reference from text (default today, handles yesterday, kal, parso, last night).
 */
export function parseSpokenDate(
  text: string,
  referenceDate: Date = new Date()
): {
  date: string; // ISO string
  matchedText: string;
  confidence: FieldConfidence;
} {
  const lower = text.toLowerCase();
  const base = new Date(referenceDate);

  if (/\b(?:yesterday|last\s*night)\b/i.test(lower)) {
    base.setDate(base.getDate() - 1);
    const matched = lower.match(/\b(?:yesterday|last\s*night)\b/i)?.[0] || '';
    return { date: base.toISOString(), matchedText: matched, confidence: 'high' };
  }

  if (/\bparso\b|\bparson\b/i.test(lower)) {
    base.setDate(base.getDate() - 2);
    const matched = lower.match(/\b(?:parso|parson)\b/i)?.[0] || '';
    return { date: base.toISOString(), matchedText: matched, confidence: 'high' };
  }

  // "kal" in past expense context
  if (/\bkal\b/i.test(lower)) {
    base.setDate(base.getDate() - 1);
    const matched = lower.match(/\bkal\b/i)?.[0] || '';
    return { date: base.toISOString(), matchedText: matched, confidence: 'high' };
  }

  return {
    date: referenceDate.toISOString(),
    matchedText: '',
    confidence: 'high',
  };
}

/**
 * Extracts category from keywords or user merchant rules.
 */
export function inferCategory(
  cleanedText: string,
  merchantName: string,
  context?: VoiceParserContext
): {
  category: string;
  confidence: FieldConfidence;
  matchedRule: boolean;
} {
  const textLower = cleanedText.toLowerCase();
  const merchLower = merchantName.toLowerCase().trim();

  // 1. Check saved merchant rules first
  if (merchLower && context?.merchantRules) {
    for (const [ruleMerch, ruleCat] of Object.entries(context.merchantRules)) {
      if (ruleMerch.toLowerCase() === merchLower || merchLower.includes(ruleMerch.toLowerCase())) {
        return { category: ruleCat, confidence: 'high', matchedRule: true };
      }
    }
  }

  // 2. Check past expenses context for payee category memory
  if (merchLower && context?.pastExpenses) {
    const prev = context.pastExpenses.find(
      (e) => e.merchant && e.merchant.toLowerCase() === merchLower && e.category !== 'Needs review'
    );
    if (prev && prev.category) {
      return { category: prev.category, confidence: 'high', matchedRule: true };
    }
  }

  // 3a. First check if extracted merchant matches any keyword
  if (merchLower) {
    for (const [catName, keywords] of Object.entries(VOICE_CATEGORY_KEYWORDS)) {
      for (const kw of keywords) {
        const reg = new RegExp(`\\b${kw}\\b`, 'i');
        if (reg.test(merchLower)) {
          return { category: catName, confidence: 'high', matchedRule: false };
        }
      }
    }
  }

  // 3b. Then check against full text (longer / more specific keywords first)
  let bestCategory: string | null = null;
  let longestMatchLength = 0;

  for (const [catName, keywords] of Object.entries(VOICE_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      const reg = new RegExp(`\\b${kw}\\b`, 'i');
      if (reg.test(textLower)) {
        if (kw.length > longestMatchLength) {
          longestMatchLength = kw.length;
          bestCategory = catName;
        }
      }
    }
  }

  if (bestCategory) {
    return { category: bestCategory, confidence: 'high', matchedRule: false };
  }

  return { category: 'Other', confidence: 'low', matchedRule: false };
}

/**
 * Checks if a string likely represents a person's name rather than a commercial merchant.
 */
export function isLikelyPersonName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;
  const lower = name.toLowerCase().trim();

  // If matches any commercial keyword, it's NOT a person
  for (const keywords of Object.values(VOICE_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return false;
    }
  }

  const commercialExclusions = [
    'store', 'shop', 'market', 'mart', 'bazaar', 'petrol pump', 'counter',
    'station', 'app', 'online', 'website', 'service', 'center', 'centre'
  ];
  for (const excl of commercialExclusions) {
    if (lower.includes(excl)) return false;
  }

  // Single or double word name (e.g. "Atul", "Rahul", "Priya Sharma", "Bhai", "Dost")
  const parts = lower.split(/\s+/);
  return parts.length >= 1 && parts.length <= 3;
}

/**
 * THE SHARED VOICE PARSER
 * Parses natural language input (English, Hindi, Hinglish, spoken numbers)
 * into a structured expense record with confidence scoring.
 */
export function parseExpenseText(
  text: string,
  context?: VoiceParserContext
): ParsedVoiceExpense {
  const original = (text || '').trim();
  const referenceDate = context?.referenceDate || new Date();

  if (!original) {
    return {
      amount: null,
      category: 'Needs review',
      merchant: '',
      note: '',
      date: referenceDate.toISOString(),
      isPersonPayee: false,
      needsReview: true,
      confidence: {
        amount: 'low',
        category: 'low',
        merchant: 'low',
        date: 'high',
      },
    };
  }

  // 1. Extract Amount
  const amountParsed = parseSpokenAmount(original);
  let workingText = original;

  if (amountParsed.matchedText) {
    // Remove matched amount text
    workingText = workingText.replace(new RegExp(`\\b${amountParsed.matchedText}\\b`, 'i'), ' ');
  }

  // 2. Extract Date
  const dateParsed = parseSpokenDate(workingText, referenceDate);
  if (dateParsed.matchedText) {
    workingText = workingText.replace(new RegExp(`\\b${dateParsed.matchedText}\\b`, 'i'), ' ');
  }

  // 3. Clean up common verbs, fillers, and currencies in workingText
  let cleaned = workingText
    .replace(/[₹]/g, ' ')
    .replace(/\b(?:rupees|rupee|rs\.?|inr|\/-|bucks)\b/gi, ' ')
    .replace(/\b(?:spent|spend|paid|bought|gave|give|sent|send|transferred|transfer)\b/gi, ' ')
    .replace(/\b(?:diye|diya|diye\s*the|kharch\s*kiye|kharch\s*kiya|lag\s*gaye|bhare|bhara)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 4. Extract Merchant / Payee
  let rawMerchant = '';
  let foundByPreposition = false;

  // Pattern: "at <merchant>" (e.g. "at canteen", "at tapri", "at swiggy")
  const atMatch = cleaned.match(/\bat\s+([a-z0-9\s&'-]+?)(?:\s+(?:for|on|in|with|using|yesterday|today|last)|$)/i);
  if (atMatch && atMatch[1]?.trim()) {
    rawMerchant = atMatch[1].trim();
    foundByPreposition = true;
  }

  // Pattern: "to <payee>" (e.g. "paid 200 to Atul", "gave 100 to Rahul")
  if (!rawMerchant) {
    const toMatch = cleaned.match(/\bto\s+([a-z0-9\s&'-]+?)(?:\s+(?:for|at|on|with|yesterday|today|last)|$)/i);
    if (toMatch && toMatch[1]?.trim()) {
      rawMerchant = toMatch[1].trim();
      foundByPreposition = true;
    }
  }

  // Pattern: "<payee> ko" (Hinglish: "Atul ko 200 diye", "Rahul ko")
  if (!rawMerchant) {
    const koMatch = cleaned.match(/([a-z0-9\s&'-]+?)\s+\bko\b/i);
    if (koMatch && koMatch[1]?.trim()) {
      rawMerchant = koMatch[1].trim();
      foundByPreposition = true;
    }
  }

  // Pattern: "<merchant> mein" / "<merchant> me" (Hinglish: "canteen mein 80 kharch kiye")
  if (!rawMerchant) {
    const meinMatch = cleaned.match(/([a-z0-9\s&'-]+?)\s+\b(?:mein|me)\b/i);
    if (meinMatch && meinMatch[1]?.trim()) {
      rawMerchant = meinMatch[1].trim();
      foundByPreposition = true;
    }
  }

  // Pattern: "from <merchant>" (e.g. "from amazon")
  if (!rawMerchant) {
    const fromMatch = cleaned.match(/\bfrom\s+([a-z0-9\s&'-]+?)(?:\s+(?:for|at|on|with)|$)/i);
    if (fromMatch && fromMatch[1]?.trim()) {
      rawMerchant = fromMatch[1].trim();
      foundByPreposition = true;
    }
  }

  // Pattern: "for <item>" or "on <item>" (e.g. "200 for chai", "on food")
  let itemCategoryToken = '';
  const forMatch = cleaned.match(/\b(?:for|on)\s+([a-z0-9\s&'-]+?)(?:\s+(?:at|to|from|with)|$)/i);
  if (forMatch && forMatch[1]?.trim()) {
    itemCategoryToken = forMatch[1].trim();
  }

  // Pattern: shorthand entity "<merchant> <amount>" or standalone entity like "canteen", "auto", "uber"
  if (!rawMerchant) {
    // If there is an item from "for <item>", use it
    if (itemCategoryToken) {
      rawMerchant = itemCategoryToken;
    } else {
      // Pick first meaningful token(s)
      const residualTokens = cleaned
        .replace(/\b(?:on|for|at|to|from|mein|me|ko|ka|ke|ki|se)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (residualTokens) {
        rawMerchant = residualTokens;
      }
    }
  }

  // Clean raw merchant
  rawMerchant = rawMerchant
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s+(?:the|a|an)$/i, '')
    .trim();

  // Capitalize properly
  const merchant = rawMerchant
    ? rawMerchant.charAt(0).toUpperCase() + rawMerchant.slice(1)
    : '';

  // 5. Categorization
  const catInference = inferCategory(cleaned, merchant, context);
  let finalCategory = catInference.category;
  let categoryConfidence: FieldConfidence = catInference.confidence;
  let isPersonPayee = false;
  let needsReview = false;

  // Check if payee is a person name
  if (merchant && isLikelyPersonName(merchant)) {
    isPersonPayee = true;

    // If there's an explicit saved merchant rule for this person, respect it!
    if (catInference.matchedRule) {
      finalCategory = catInference.category;
      categoryConfidence = 'high';
    } else if (catInference.category === 'Other' || !catInference.matchedRule) {
      // Unmapped person payee without an explicit category in text -> "Needs review"
      finalCategory = 'Needs review';
      categoryConfidence = 'low';
      needsReview = true;
    }
  }

  if (finalCategory === 'Needs review') {
    needsReview = true;
  }

  const merchantConfidence: FieldConfidence = merchant
    ? (foundByPreposition || isPersonPayee ? 'high' : 'medium')
    : 'low';

  return {
    amount: amountParsed.amount,
    category: finalCategory,
    merchant,
    note: original,
    date: dateParsed.date,
    isPersonPayee,
    needsReview,
    confidence: {
      amount: amountParsed.confidence,
      category: categoryConfidence,
      merchant: merchantConfidence,
      date: dateParsed.confidence,
    },
    matchedRule: catInference.matchedRule,
  };
}
