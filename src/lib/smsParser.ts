/**
 * Indian Bank & UPI SMS Parser for SaveMoney
 * 
 * Extracts:
 * 1. Amount (in INR): parses 'Rs.', 'INR', '₹', 'debited for', etc. Handles Indian numbering with commas.
 * 2. Merchant / Beneficiary: parses 'at SWIGGY', 'to Ramesh Kumar via UPI', 'Info: UPI/328912/Uber India', etc.
 * 3. Date & Time: parses '23-OCT-26', '23/10/2026', '23Oct26', etc. Defaults to current date if missing.
 * 4. Suggested Category: intelligent matching based on popular Indian merchants (Food, Travel, Shopping, Bills, etc.).
 */

export interface ParsedSMSResult {
  success: boolean;
  amount?: number;
  merchant?: string;
  date?: string; // ISO string
  suggestedCategory?: string;
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

// Category keyword mappings for common Indian services & merchants
const CATEGORY_KEYWORDS: Record<string, string[]> = {
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

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parses an Indian Bank / UPI transaction SMS text
 */
export function parseTransactionSMS(smsText: string): ParsedSMSResult {
  if (!smsText || typeof smsText !== 'string' || smsText.trim().length === 0) {
    return {
      success: false,
      rawText: '',
      confidence: 'low',
      error: 'Please paste a valid transaction SMS.',
    };
  }

  const cleanText = smsText.replace(/\s+/g, ' ').trim();

  // 1. Amount Extraction
  // Matches: Rs. 450, Rs450.50, INR 1,250.00, ₹420, debited by 350.00, etc.
  let amount: number | undefined;

  const amountRegexes = [
    /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:debited|spent|paid|withdrawn|transferred)\s+(?:for|by|of)?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:debited|spent|paid|deducted)/i,
  ];

  for (const regex of amountRegexes) {
    const match = cleanText.match(regex);
    if (match && match[1]) {
      const numStr = match[1].replace(/,/g, '');
      const parsedNum = parseFloat(numStr);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        amount = parsedNum;
        break;
      }
    }
  }

  // 2. Merchant / Beneficiary Extraction
  let merchant: string | undefined;

  const merchantRegexes = [
    // Pattern: 'at SWIGGY on 23-Oct' or 'at Starbucks.'
    /\bat\s+([A-Za-z0-9\s._&'-]+?)(?=\s+on\b|\s+ref\b|\s+avail\b|\s+bal\b|\s+vpa\b|[.,;]|$)/i,
    // Pattern: 'to Ramesh Kumar via PhonePe' or 'to Uber India'
    /\bto\s+([A-Za-z0-9\s._&'-]+?)(?=\s+on\b|\s+via\b|\s+using\b|\s+ref\b|\s+avail\b|\s+bal\b|[.,;]|$)/i,
    // Pattern: 'Info: UPI/328912/Uber India' or 'Info: Swiggy'
    /\binfo[:\s]+(?:upi\/[0-9]+\/)?([A-Za-z0-9\s._&'-]+?)(?=\s+available|\s+bal|\s+ref|[.,;]|$)/i,
    // Pattern: 'transfer to Zomato UPI'
    /\btransfer\s+to\s+([A-Za-z0-9\s._&'-]+?)(?=\s+upi\b|\s+ref\b|\s+on\b|[.,;]|$)/i,
    // Pattern: 'VPA xyz@okaxis'
    /\bvpa\s+([A-Za-z0-9@._-]+)/i,
  ];

  for (const regex of merchantRegexes) {
    const match = cleanText.match(regex);
    if (match && match[1]) {
      let candidate = match[1].trim();

      // Clean up common suffix noise like 'Bank Card', 'A/c ending', etc.
      candidate = candidate
        .replace(/^(the|a)\s+/i, '')
        .replace(/\b(card|a\/c|account)\s+ending.*$/i, '')
        .replace(/\b(ref|rrn|upi)\s+no.*$/i, '')
        .trim();

      if (candidate.length >= 2 && candidate.length <= 40 && !candidate.toLowerCase().startsWith('rs')) {
        merchant = candidate;
        break;
      }
    }
  }

  // Fallback: If no explicit 'at/to', look for popular merchants directly in text
  if (!merchant) {
    for (const category of Object.keys(CATEGORY_KEYWORDS)) {
      const keywords = CATEGORY_KEYWORDS[category];
      for (const kw of keywords) {
        if (new RegExp(`\\b${kw}\\b`, 'i').test(cleanText)) {
          // Capitalize first letter of matched brand
          merchant = kw.charAt(0).toUpperCase() + kw.slice(1);
          break;
        }
      }
      if (merchant) break;
    }
  }

  // 3. Date Extraction
  let date: string | undefined;

  // Pattern A: '23-OCT-26' or '23-10-2026' or '23/10/26'
  const datePatternA = /\b(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{2,4})\b/;
  // Pattern B: '23Oct26' or '23 Oct 2026'
  const datePatternB = /\b(\d{1,2})\s*([A-Za-z]{3})\s*(\d{2,4})\b/i;

  const matchDate = cleanText.match(datePatternA) || cleanText.match(datePatternB);

  if (matchDate) {
    const day = parseInt(matchDate[1], 10);
    const monthPart = matchDate[2].toLowerCase();
    let year = parseInt(matchDate[3], 10);
    
    // Normalize 2-digit year (e.g. 26 -> 2026)
    if (year < 100) year += 2000;

    let monthIndex = -1;
    if (isNaN(Number(monthPart))) {
      monthIndex = MONTH_NAMES[monthPart.slice(0, 3)] ?? -1;
    } else {
      monthIndex = parseInt(monthPart, 10) - 1;
    }

    if (day >= 1 && day <= 31 && monthIndex >= 0 && monthIndex <= 11) {
      // Time extraction if present (e.g. '14:30' or '02:30 PM')
      const timeMatch = cleanText.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
      let hours = 12;
      let minutes = 0;

      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const meridiem = timeMatch[3]?.toLowerCase();
        if (meridiem === 'pm' && hours < 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
      }

      const parsedDate = new Date(year, monthIndex, day, hours, minutes);
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate.toISOString();
      }
    }
  }

  // Default date to now if not found or invalid
  if (!date) {
    date = new Date().toISOString();
  }

  // 4. Category Prediction
  let suggestedCategory = 'Other';
  const textToScan = `${merchant || ''} ${cleanText}`.toLowerCase();

  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => textToScan.includes(kw))) {
      suggestedCategory = catName;
      break;
    }
  }

  const success = Boolean(amount && amount > 0);
  const confidence: ParsedSMSResult['confidence'] =
    amount && merchant ? 'high' : amount ? 'medium' : 'low';

  return {
    success,
    amount,
    merchant,
    date,
    suggestedCategory,
    rawText: cleanText,
    confidence,
    error: success ? undefined : 'Could not detect transaction amount. Please check the SMS or enter manually.',
  };
}
