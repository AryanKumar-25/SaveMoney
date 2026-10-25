-- ==============================================================================
-- SAVEMONEY: REBUILT ALERT ENGINE & PUSH NOTIFICATIONS MIGRATION
-- Safe to re-run multiple times on Supabase PostgreSQL
-- ==============================================================================

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Update / Recreate public.alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'danger')),
  title text NOT NULL DEFAULT '',
  message text NOT NULL,
  month text NOT NULL,
  dedupe_key text,
  is_read boolean DEFAULT false,
  push_sent_at timestamptz,
  push_error text,
  created_at timestamptz DEFAULT now()
);

-- Ensure newly added columns exist if table was already created
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS push_error text;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

-- Clean up any existing duplicate alerts by dedupe_key before creating unique constraint
DELETE FROM public.alerts
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, dedupe_key ORDER BY created_at ASC) as rn
    FROM public.alerts
    WHERE dedupe_key IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- Unique index ensuring dedupe_key can only be used ONCE per user for threshold/projection/savings alerts
DROP INDEX IF EXISTS idx_alerts_user_dedupe;
CREATE UNIQUE INDEX idx_alerts_user_dedupe 
  ON public.alerts (user_id, dedupe_key) 
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_user_month ON public.alerts (user_id, month);
CREATE INDEX IF NOT EXISTS idx_alerts_user_created ON public.alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON public.alerts (user_id, is_read) WHERE is_read = false;

-- Enable Row Level Security
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Drop old policies to prevent duplicates
DROP POLICY IF EXISTS "Users can view own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can insert own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can delete own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role and users can insert alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role and users can select alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role and users can update alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role and users can delete alerts" ON public.alerts;

-- RLS Policies for public.alerts:
-- Users can view their own alerts, and service role has full access
CREATE POLICY "Users can view own alerts"
  ON public.alerts FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Users and server service role can insert alerts
CREATE POLICY "Users and service role can insert alerts"
  ON public.alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Users can update (mark as read) their own alerts
CREATE POLICY "Users can update own alerts"
  ON public.alerts FOR UPDATE
  USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Users can delete their own alerts
CREATE POLICY "Users can delete own alerts"
  ON public.alerts FOR DELETE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 3. Update / Recreate public.push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_push_subs_user_endpoint UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure unique constraint on (user_id, endpoint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_push_subs_user_endpoint'
  ) THEN
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT uq_push_subs_user_endpoint UNIQUE (user_id, endpoint);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users and service role can view push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users and service role can insert push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users and service role can update push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users and service role can delete push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 4. Enable Realtime on public.alerts
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
EXCEPTION WHEN OTHERS THEN
  -- Table may already be in publication
  NULL;
END $$;
