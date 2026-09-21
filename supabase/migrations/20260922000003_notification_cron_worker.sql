-- ============================================================================
-- ClassSync Notification Cron Queue Worker Migration
-- File: supabase/migrations/20260922000003_notification_cron_worker.sql
-- Description: Enables pg_cron & pg_net, creates atomic queue processor function,
--              and schedules 15-minute background job for delayed Quiet Hours delivery.
-- ============================================================================

-- 1. Enable Required Extensions
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 2. Create Queue Processor Function
create or replace function public.process_notification_queue()
returns integer
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
    v_count integer := 0;
    v_url text;
    v_secret text;
begin
    -- 1. Count pending notifications ready for delivery
    select count(*)
    into v_count
    from public.notification_queue
    where status = 'pending'
      and scheduled_for <= timezone('utc'::text, now());

    -- If no pending alerts due, exit early
    if v_count = 0 then
        return 0;
    end if;

    -- 2. Atomically transition up to 100 due records to 'processing'
    -- 'FOR UPDATE SKIP LOCKED' safely avoids race conditions between worker iterations
    with due_items as (
        select id
        from public.notification_queue
        where status = 'pending'
          and scheduled_for <= timezone('utc'::text, now())
        order by scheduled_for asc
        limit 100
        for update skip locked
    )
    update public.notification_queue q
    set status = 'processing',
        updated_at = timezone('utc'::text, now())
    from due_items d
    where q.id = d.id;

    -- 3. Resolve endpoint URL and webhook secret from app settings or defaults
    v_url := coalesce(
        current_setting('app.settings.edge_function_url', true),
        'https://yslpqdwmthfmovzohxze.supabase.co/functions/v1/push-dispatcher'
    );
    v_secret := coalesce(
        current_setting('app.settings.webhook_secret', true),
        ''
    );

    -- 4. Forward trigger to Supabase Edge Function via asynchronous pg_net POST
    perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Webhook-Secret', v_secret
        ),
        body := jsonb_build_object(
            'type', 'CRON_QUEUE',
            'table', 'notification_queue'
        )
    );

    return v_count;
end;
$$;

-- Grant execution to service_role and postgres
grant execute on function public.process_notification_queue() to service_role, postgres;

-- 3. Schedule the 15-Minute pg_cron Worker Job
do $$
begin
    -- Unschedule existing job if previously registered
    if exists (select 1 from cron.job where jobname = 'process-notification-queue') then
        perform cron.unschedule('process-notification-queue');
    end if;

    -- Register recurring 15-minute cron job
    perform cron.schedule(
        'process-notification-queue',
        '*/15 * * * *',
        'select public.process_notification_queue();'
    );
exception
    when others then
        -- In local environments or restricted test schemas without pg_cron daemon, log notice
        raise notice 'pg_cron registration skipped or deferred: %', SQLERRM;
end $$;
