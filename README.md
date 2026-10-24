# SaveMoney 💰

SaveMoney is a mobile-first, PWA-ready personal spending tracker crafted specifically for Indian financial realities (₹ INR, lakhs/crores formatting). It calculates your monthly spendable budget and dynamic daily safe-to-spend allowance, putting your savings first.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run test suite (92 tests)
npm test

# 3. Start local development server
npm run dev

# 4. Open in your browser
http://localhost:3000
```

---

## 🌟 Key Features

1. **Smart Indian Budgeting Engine**
   - Spendable budget = In-hand Income − Fixed Obligations − Savings Target + Extra Money Transfers + Balance Adjustments.
   - Dynamic Daily Safe-to-Spend Allowance based on remaining days in the month.
   - Month-end spending projections and savings protection alarms.

2. **Under-5-Second Expense Entry & Smart Indian SMS Parser**
   - Paste bank debit SMS (HDFC, ICICI, SBI, Axis, Kotak, etc.) or UPI transaction text (GPay, PhonePe, Paytm, CRED).
   - Auto-extracts amount, merchant/vendor, account, and date.

3. **Extra Money & Direct Balance Adjustments**
   - Track windfalls, freelance income, refunds, and gifts in an isolated pool without distorting your baseline budget.
   - "Add to balance" moves money into the current month's spendable budget with live preview and full undo support.
   - Direct balance adjustments with mandatory reasons and complete audit history.

4. **Safeguards for Missed & Incomplete Capture**
   - **Daily Check-in**: Evening prompt (*"Anything not logged today?"*) with zero-spend day verification (*"No spending recorded today. Is that right?"*).
   - **Bank Balance Reconciliation**: Enter your actual bank app balance, instantly see unaccounted differences, and resolve them by adding missing expenses or saving balance adjustments.
   - **Bank Statement CSV Import**: Process bank statement CSVs client-side (100% private, zero server storage), deduplicate against existing transactions, auto-categorize merchants, and import debits only.
   - **Capture Health**: Detects 24+ hour silences in phone automation when manual entries are recorded, plus multi-source deduplication (SMS + UPI notification).

5. **Multi-Account & Payment Method Tracking**
   - Track spending across Bank Accounts, Credit Cards, Debit Cards, UPI IDs, and Physical Cash.
   - Zero-risk security: only nicknames and optional last 4 digits are stored. Never store CVVs, PINs, or passwords.

6. **Reports, Analytics & PWA**
   - Monthly and yearly breakdown, category distribution, merchant frequency, and savings target hit/miss bars.
   - Light / Dark Mode with brand orange accents.
   - Web Push Notifications and offline PWA capability.
   - CSV and JSON export / data backup.

---

## 🗄️ Supabase Backend Setup

SaveMoney connects to your personal Supabase Postgres database protected by Row Level Security (RLS) so only you can access your data.

> **Note:** SaveMoney also includes an **Instant Demo Mode** that runs immediately in your browser with LocalStorage if you want to test the UI and calculations before creating a Supabase project.

### Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**, name it **SaveMoney**, and choose region **South Asia (Mumbai)**.

### Step 2: Run the SQL Schema
1. Open the **SQL Editor** tab in your Supabase dashboard.
2. Open [`supabase/schema.sql`](./supabase/schema.sql), copy its contents, paste it into the SQL Editor, and click **Run**.
   - Creates tables: `profiles`, `monthly_budgets`, `fixed_expenses`, `expenses`, `categories`, `accounts`, `extra_money_entries`, `extra_money_transfers`, `balance_adjustments`, `account_reconciliations`.
   - Enables Row Level Security (RLS) on all tables with user isolation policies.
   - Adds indexes on `(user_id, date)` for optimal query performance.

### Step 3: Configure Environment Variables
1. Go to **Project Settings -> API** in Supabase.
2. In the project folder, create `.env.local` (or copy from `.env.example`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
3. Restart the dev server (`npm run dev`).

---

## 🧪 Testing

```bash
# Run all vitest unit tests
npm test -- --run
```
All 92 tests across budget calculations, SMS parser, account statistics, report calculations, rollover logic, extra money pool, balance adjustments, and safeguards pass.
