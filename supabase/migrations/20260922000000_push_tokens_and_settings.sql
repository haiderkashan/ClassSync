-- ============================================================================
-- ClassSync Migration: Push Tokens, Notification Settings & Notification Queue
-- File: supabase/migrations/20260922000000_push_tokens_and_settings.sql
-- Description: Hardens user_push_tokens with global token uniqueness, creates
--              user_notification_settings for quiet hours, and introduces
--              notification_queue for scheduled delayed delivery.
-- ============================================================================

-- 1. HARDEN USER PUSH TOKENS TABLE
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL,
    platform TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    device_name TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure required columns exist if table was previously created in initial schema
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_push_tokens' 
          AND column_name = 'device_name'
    ) THEN
        ALTER TABLE public.user_push_tokens ADD COLUMN device_name TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_push_tokens' 
          AND column_name = 'last_seen_at'
    ) THEN
        ALTER TABLE public.user_push_tokens ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_push_tokens' 
          AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.user_push_tokens ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_push_tokens' 
          AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.user_push_tokens ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- Drop old composite unique constraint if present
ALTER TABLE public.user_push_tokens 
    DROP CONSTRAINT IF EXISTS user_push_tokens_user_id_expo_push_token_key;

-- Enforce strict single-user device ownership invariant: UNIQUE(expo_push_token)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_push_tokens_expo_push_token_key'
    ) THEN
        ALTER TABLE public.user_push_tokens 
            ADD CONSTRAINT user_push_tokens_expo_push_token_key UNIQUE (expo_push_token);
    END IF;
END $$;

-- Update platform check constraint to safely allow iOS, Android, and Web
ALTER TABLE public.user_push_tokens 
    DROP CONSTRAINT IF EXISTS user_push_tokens_platform_check;

ALTER TABLE public.user_push_tokens 
    ADD CONSTRAINT user_push_tokens_platform_check 
    CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web'));

-- Indexes for user_push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active 
    ON public.user_push_tokens(user_id) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_tokens_token 
    ON public.user_push_tokens(expo_push_token);

-- RLS for user_push_tokens
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage their push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can view their own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON public.user_push_tokens;

CREATE POLICY "Users can view their own push tokens"
    ON public.user_push_tokens FOR SELECT
    USING (user_id = public.current_user_id());

CREATE POLICY "Users can insert their own push tokens"
    ON public.user_push_tokens FOR INSERT
    WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "Users can update their own push tokens"
    ON public.user_push_tokens FOR UPDATE
    USING (user_id = public.current_user_id())
    WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "Users can delete their own push tokens"
    ON public.user_push_tokens FOR DELETE
    USING (user_id = public.current_user_id());


-- ============================================================================
-- 2. USER NOTIFICATION SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_start TIME NOT NULL DEFAULT '22:00:00', -- 10:00 PM local
    quiet_hours_end TIME NOT NULL DEFAULT '07:00:00',   -- 07:00 AM local
    bypass_for_urgent BOOLEAN NOT NULL DEFAULT true,    -- Same-day cancellations/delays bypass quiet hours
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT user_notification_settings_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user 
    ON public.user_notification_settings(user_id);

-- RLS for user_notification_settings
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notification settings" ON public.user_notification_settings;
DROP POLICY IF EXISTS "Users can insert their notification settings" ON public.user_notification_settings;
DROP POLICY IF EXISTS "Users can update their notification settings" ON public.user_notification_settings;

CREATE POLICY "Users can view their notification settings"
    ON public.user_notification_settings FOR SELECT
    USING (user_id = public.current_user_id());

CREATE POLICY "Users can insert their notification settings"
    ON public.user_notification_settings FOR INSERT
    WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "Users can update their notification settings"
    ON public.user_notification_settings FOR UPDATE
    USING (user_id = public.current_user_id())
    WITH CHECK (user_id = public.current_user_id());


-- ============================================================================
-- 3. NOTIFICATION QUEUE TABLE (Deficiency 1 Fix: Stateless Edge Function Queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- High performance partial index for pg_cron worker pickup
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending 
    ON public.notification_queue (scheduled_for, status)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_queue_user 
    ON public.notification_queue(user_id);

-- Restrict notification_queue: RLS enabled with NO public access policies (service role / security definer only)
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
