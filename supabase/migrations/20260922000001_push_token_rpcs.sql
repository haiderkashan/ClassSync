-- ============================================================================
-- ClassSync Push Tokens & Notification Settings RPCs Migration
-- Migration: 20260922000001_push_token_rpcs.sql
-- Description: Creates atomic PL/pgSQL functions for:
--              1. register_push_token (atomic token reassignment & upsert)
--              2. unregister_push_token (deactivates token on logout)
--              3. update_notification_settings (atomic upsert for user quiet hours)
-- ============================================================================

-- 1. REGISTER PUSH TOKEN
create or replace function public.register_push_token(
    p_expo_push_token text,
    p_platform text default null,
    p_timezone text default 'UTC',
    p_device_name text default null
)
returns public.user_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_clean_token text;
    v_token public.user_push_tokens;
begin
    v_user_id := public.current_user_id();
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    v_clean_token := trim(p_expo_push_token);
    if v_clean_token is null or v_clean_token = '' then
        raise exception 'Push token cannot be empty';
    end if;

    if p_platform is not null and p_platform not in ('ios', 'android', 'web') then
        raise exception 'Invalid platform: %', p_platform;
    end if;

    -- Atomic Upsert / Reassignment:
    -- If the token was previously registered to another user (e.g. device handover),
    -- reassign ownership to current user and reactivate it.
    insert into public.user_push_tokens (
        user_id,
        expo_push_token,
        platform,
        timezone,
        device_name,
        last_seen_at,
        is_active,
        created_at,
        updated_at
    ) values (
        v_user_id,
        v_clean_token,
        p_platform,
        coalesce(nullif(trim(p_timezone), ''), 'UTC'),
        p_device_name,
        timezone('utc'::text, now()),
        true,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    on conflict (expo_push_token) do update
    set
        user_id = v_user_id,
        platform = coalesce(excluded.platform, public.user_push_tokens.platform),
        timezone = coalesce(nullif(trim(excluded.timezone), ''), public.user_push_tokens.timezone),
        device_name = coalesce(excluded.device_name, public.user_push_tokens.device_name),
        last_seen_at = timezone('utc'::text, now()),
        is_active = true,
        updated_at = timezone('utc'::text, now())
    returning * into v_token;

    return v_token;
end;
$$;

-- 2. UNREGISTER PUSH TOKEN
create or replace function public.unregister_push_token(
    p_expo_push_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_clean_token text;
begin
    v_user_id := public.current_user_id();
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    v_clean_token := trim(p_expo_push_token);
    if v_clean_token is null or v_clean_token = '' then
        return false;
    end if;

    update public.user_push_tokens
    set
        is_active = false,
        updated_at = timezone('utc'::text, now())
    where expo_push_token = v_clean_token
      and user_id = v_user_id;

    return found;
end;
$$;

-- 3. UPDATE NOTIFICATION SETTINGS
create or replace function public.update_notification_settings(
    p_quiet_hours_enabled boolean default null,
    p_quiet_hours_start time default null,
    p_quiet_hours_end time default null,
    p_bypass_for_urgent boolean default null,
    p_timezone text default null
)
returns public.user_notification_settings
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_settings public.user_notification_settings;
begin
    v_user_id := public.current_user_id();
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    insert into public.user_notification_settings (
        user_id,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
        bypass_for_urgent,
        timezone,
        created_at,
        updated_at
    ) values (
        v_user_id,
        coalesce(p_quiet_hours_enabled, true),
        coalesce(p_quiet_hours_start, '22:00:00'::time),
        coalesce(p_quiet_hours_end, '07:00:00'::time),
        coalesce(p_bypass_for_urgent, true),
        coalesce(nullif(trim(p_timezone), ''), 'UTC'),
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    on conflict (user_id) do update
    set
        quiet_hours_enabled = coalesce(excluded.quiet_hours_enabled, public.user_notification_settings.quiet_hours_enabled),
        quiet_hours_start = coalesce(excluded.quiet_hours_start, public.user_notification_settings.quiet_hours_start),
        quiet_hours_end = coalesce(excluded.quiet_hours_end, public.user_notification_settings.quiet_hours_end),
        bypass_for_urgent = coalesce(excluded.bypass_for_urgent, public.user_notification_settings.bypass_for_urgent),
        timezone = coalesce(nullif(trim(excluded.timezone), ''), public.user_notification_settings.timezone),
        updated_at = timezone('utc'::text, now())
    returning * into v_settings;

    return v_settings;
end;
$$;

-- Grant permissions to authenticated users and service_role
grant execute on function public.register_push_token(text, text, text, text) to authenticated, service_role;
grant execute on function public.unregister_push_token(text) to authenticated, service_role;
grant execute on function public.update_notification_settings(boolean, time, time, boolean, text) to authenticated, service_role;
