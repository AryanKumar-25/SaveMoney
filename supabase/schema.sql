-- ==============================================================================
-- SaveMoney: Supabase PostgreSQL Schema with Row Level Security (RLS)
-- Run this in your Supabase Project's SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text default 'Saver',
  currency text default 'INR',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

create policy "Users can insert own profile" 
  on public.profiles for insert 
  with check (auth.uid() = id);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Monthly Budgets Table
create table if not exists public.monthly_budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  month text not null, -- Format: YYYY-MM (e.g. '2026-10')
  income numeric(12, 2) not null default 0,
  savings_target numeric(12, 2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_month unique (user_id, month)
);

alter table public.monthly_budgets enable row level security;

create policy "Users can view own monthly budgets" 
  on public.monthly_budgets for select 
  using (auth.uid() = user_id);

create policy "Users can insert own monthly budgets" 
  on public.monthly_budgets for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own monthly budgets" 
  on public.monthly_budgets for update 
  using (auth.uid() = user_id);

create policy "Users can delete own monthly budgets" 
  on public.monthly_budgets for delete 
  using (auth.uid() = user_id);

-- 3. Fixed Expenses Table (Rent, Subscriptions, EMIs)
create table if not exists public.fixed_expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  month text not null, -- Format: YYYY-MM
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category text not null default 'Bills',
  due_day integer check (due_day between 1 and 31),
  is_paid boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fixed_expenses enable row level security;

create policy "Users can view own fixed expenses" 
  on public.fixed_expenses for select 
  using (auth.uid() = user_id);

create policy "Users can insert own fixed expenses" 
  on public.fixed_expenses for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own fixed expenses" 
  on public.fixed_expenses for update 
  using (auth.uid() = user_id);

create policy "Users can delete own fixed expenses" 
  on public.fixed_expenses for delete 
  using (auth.uid() = user_id);

-- 4. Categories Table
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade, -- null means default global category
  name text not null,
  icon text default 'tag',
  color text default '#F7931A',
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

create policy "Users can view default or own categories" 
  on public.categories for select 
  using (user_id is null or auth.uid() = user_id);

create policy "Users can insert own categories" 
  on public.categories for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own categories" 
  on public.categories for update 
  using (auth.uid() = user_id);

create policy "Users can delete own categories" 
  on public.categories for delete 
  using (auth.uid() = user_id);

-- Clean up duplicate categories, preserving the earliest created one
delete from public.categories
where id in (
  select id from (
    select id, row_number() over (partition by lower(trim(name)) order by created_at asc, id asc) as rn
    from public.categories
  ) t
  where t.rn > 1
);

-- Ensure category names are unique (case-insensitive)
create unique index if not exists idx_categories_unique_name on public.categories (lower(trim(name)));

-- Seed default categories if not already present
insert into public.categories (user_id, name, icon, color)
values
  (null, 'Food', 'Utensils', '#F7931A'),
  (null, 'Travel', 'Car', '#3B82F6'),
  (null, 'Shopping', 'ShoppingBag', '#EC4899'),
  (null, 'Bills', 'FileText', '#EAB308'),
  (null, 'Entertainment', 'Film', '#8B5CF6'),
  (null, 'Health', 'HeartPulse', '#10B981'),
  (null, 'Other', 'MoreHorizontal', '#64748B')
on conflict (lower(trim(name))) do nothing;

-- 5. Daily Expenses Table (Ready for Stage 2+)
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  note text,
  merchant text,
  date timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

create policy "Users can view own expenses" 
  on public.expenses for select 
  using (auth.uid() = user_id);

create policy "Users can insert own expenses" 
  on public.expenses for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own expenses" 
  on public.expenses for update 
  using (auth.uid() = user_id);

create policy "Users can delete own expenses" 
  on public.expenses for delete 
  using (auth.uid() = user_id);

-- Create indexes for performance
create index if not exists idx_monthly_budgets_user_month on public.monthly_budgets(user_id, month);
create index if not exists idx_fixed_expenses_user_month on public.fixed_expenses(user_id, month);
create index if not exists idx_expenses_user_date on public.expenses(user_id, date);

-- 6. Alerts Table (Stage 4)
create table if not exists public.alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null,
  severity text not null check (severity in ('info', 'warning', 'danger')),
  message text not null,
  is_read boolean default false,
  month text not null,
  dedupe_key text,
  created_at timestamptz default now()
);

alter table public.alerts enable row level security;

create policy "Users can view own alerts" 
  on public.alerts for select 
  using (auth.uid() = user_id);

create policy "Users can insert own alerts" 
  on public.alerts for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own alerts" 
  on public.alerts for update 
  using (auth.uid() = user_id);

create policy "Users can delete own alerts" 
  on public.alerts for delete 
  using (auth.uid() = user_id);

create index if not exists idx_alerts_user_month_dedupe on public.alerts(user_id, month, dedupe_key);
create index if not exists idx_alerts_user_created on public.alerts(user_id, created_at desc);

-- 7. User Alert Settings Table (Stage 4)
create table if not exists public.user_alert_settings (
  user_id uuid references auth.users on delete cascade primary key,
  over_daily boolean default true,
  under_daily boolean default true,
  budget_thresholds boolean default true,
  thresholds jsonb default '[50, 80, 100]'::jsonb,
  projection_warning boolean default true,
  savings_at_risk boolean default true,
  push_notifications boolean default false,
  updated_at timestamptz default now()
);

alter table public.user_alert_settings enable row level security;

create policy "Users can view own alert settings" 
  on public.user_alert_settings for select 
  using (auth.uid() = user_id);

create policy "Users can insert own alert settings" 
  on public.user_alert_settings for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own alert settings" 
  on public.user_alert_settings for update 
  using (auth.uid() = user_id);

-- 8. Push Subscriptions Table (Stage 4 PWA)
create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users can view own push subscriptions" 
  on public.push_subscriptions for select 
  using (auth.uid() = user_id);

create policy "Users can insert own push subscriptions" 
  on public.push_subscriptions for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own push subscriptions" 
  on public.push_subscriptions for update 
  using (auth.uid() = user_id);

create policy "Users can delete own push subscriptions" 
  on public.push_subscriptions for delete 
  using (auth.uid() = user_id);

create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

-- 9. Accounts Table (Payment Methods & Accounts)
create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  nickname text not null,
  type text not null check (type in ('bank', 'upi', 'credit_card', 'debit_card', 'cash')),
  bank_or_app_name text,
  last_4_digits text check (last_4_digits is null or length(last_4_digits) = 4),
  color text,
  icon text,
  credit_limit numeric(12, 2) check (credit_limit is null or credit_limit >= 0),
  billing_date integer check (billing_date is null or (billing_date >= 1 and billing_date <= 31)),
  opening_balance numeric(12, 2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounts enable row level security;

create policy "Users can view own accounts" 
  on public.accounts for select 
  using (auth.uid() = user_id);

create policy "Users can insert own accounts" 
  on public.accounts for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own accounts" 
  on public.accounts for update 
  using (auth.uid() = user_id);

create policy "Users can delete own accounts" 
  on public.accounts for delete 
  using (auth.uid() = user_id);

create index if not exists idx_accounts_user on public.accounts(user_id, created_at asc);

-- 10. Link Expenses to Accounts (Nullable foreign key so existing expenses still work)
alter table public.expenses 
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

create index if not exists idx_expenses_account on public.expenses(account_id);

-- ==============================================================================
-- 11. Extra Money Entries Table (Stage: Extra Money and Balance Adjustments)
-- One-off windfalls (gifts, freelance, refunds) kept isolated from monthly salary
-- ==============================================================================
create table if not exists public.extra_money_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(12, 2) not null check (amount > 0),
  source text not null,
  date date not null,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.extra_money_entries enable row level security;

create policy "Users can view own extra money entries" 
  on public.extra_money_entries for select 
  using (auth.uid() = user_id);

create policy "Users can insert own extra money entries" 
  on public.extra_money_entries for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own extra money entries" 
  on public.extra_money_entries for update 
  using (auth.uid() = user_id);

create policy "Users can delete own extra money entries" 
  on public.extra_money_entries for delete 
  using (auth.uid() = user_id);

create index if not exists idx_extra_money_entries_user on public.extra_money_entries(user_id, date desc);

-- ==============================================================================
-- 12. Extra Money Transfers Table
-- Explicit transfers from extra money reserve into a specific month's spendable budget
-- ==============================================================================
create table if not exists public.extra_money_transfers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(12, 2) not null check (amount > 0),
  month text not null, -- Format: YYYY-MM (e.g. '2026-10')
  date timestamptz not null default now(),
  note text,
  created_at timestamptz default now()
);

alter table public.extra_money_transfers enable row level security;

create policy "Users can view own extra money transfers" 
  on public.extra_money_transfers for select 
  using (auth.uid() = user_id);

create policy "Users can insert own extra money transfers" 
  on public.extra_money_transfers for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own extra money transfers" 
  on public.extra_money_transfers for update 
  using (auth.uid() = user_id);

create policy "Users can delete own extra money transfers" 
  on public.extra_money_transfers for delete 
  using (auth.uid() = user_id);

create index if not exists idx_extra_money_transfers_user_month on public.extra_money_transfers(user_id, month);

-- ==============================================================================
-- 13. Balance Adjustments Table
-- Direct discretionary balance modifications (+/-) with mandatory audit reason
-- ==============================================================================
create table if not exists public.balance_adjustments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(12, 2) not null check (amount != 0),
  reason text not null,
  month text not null, -- Format: YYYY-MM
  date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.balance_adjustments enable row level security;

create policy "Users can view own balance adjustments" 
  on public.balance_adjustments for select 
  using (auth.uid() = user_id);

create policy "Users can insert own balance adjustments" 
  on public.balance_adjustments for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own balance adjustments" 
  on public.balance_adjustments for update 
  using (auth.uid() = user_id);

create policy "Users can delete own balance adjustments" 
  on public.balance_adjustments for delete 
  using (auth.uid() = user_id);

create index if not exists idx_balance_adjustments_user_month on public.balance_adjustments(user_id, month);

-- ==============================================================================
-- 14. Expense Capture Safeguards & Balance Reconciliations
-- ==============================================================================
alter table public.expenses 
  add column if not exists source text default 'manual';

create table if not exists public.account_reconciliations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  actual_balance numeric(12, 2) not null,
  estimated_balance numeric(12, 2) not null,
  difference numeric(12, 2) not null,
  resolved_method text default 'none',
  note text,
  date timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table public.account_reconciliations enable row level security;

create policy "Users can view own reconciliations" 
  on public.account_reconciliations for select 
  using (auth.uid() = user_id);

create policy "Users can insert own reconciliations" 
  on public.account_reconciliations for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own reconciliations" 
  on public.account_reconciliations for update 
  using (auth.uid() = user_id);

create policy "Users can delete own reconciliations" 
  on public.account_reconciliations for delete 
  using (auth.uid() = user_id);

create index if not exists idx_reconciliations_account on public.account_reconciliations(account_id, created_at desc);
create index if not exists idx_reconciliations_user on public.account_reconciliations(user_id, created_at desc);


