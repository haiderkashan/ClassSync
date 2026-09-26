-- ============================================================================
-- ClassSync Account Deletion & User Data Purge Migration
-- Migration: 20260926000000_delete_user_account.sql
-- Description: Implements atomic delete_user_account RPC enforcing the Genesis CR
--              orphan safeguard (Apple Guideline 5.1.1(v) compliance).
-- ============================================================================

create or replace function public.delete_user_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_genesis_cr_count integer;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  -- 1. CRITICAL SAFEGUARD: Verify user is NOT a Genesis CR of an active section
  select count(*) into v_genesis_cr_count
  from public.section_members sm
  join public.sections s on s.id = sm.section_id
  where sm.user_id = v_user_id
    and sm.role = 'genesis_cr'
    and coalesce(s.is_archived, false) = false;

  if v_genesis_cr_count > 0 then
    raise exception 'CANNOT_DELETE_GENESIS_CR: You are the Genesis CR of an active cohort section. Please transfer cohort ownership to a Co-Admin or archive the section before deleting your account.';
  end if;

  -- 2. Purge user-specific data across all tables
  
  -- Push notification tokens
  delete from public.user_push_tokens where user_id = v_user_id;

  -- Notification settings & quiet hours
  delete from public.user_notification_settings where user_id = v_user_id;

  -- Private attendance logs
  delete from public.attendance_logs where user_id = v_user_id;

  -- Task completion checkoffs
  delete from public.task_completions where user_id = v_user_id;

  -- Personal academic tasks (preserve cohort tasks created by delegates)
  delete from public.academic_tasks where creator_id = v_user_id and scope = 'personal';

  -- Peer consensus votes
  delete from public.peer_report_votes where user_id = v_user_id;

  -- Course subscriptions and guest memberships
  delete from public.course_enrollments where user_id = v_user_id;

  -- Section memberships
  delete from public.section_members where user_id = v_user_id;

  -- Profile record
  delete from public.profiles where id = v_user_id;

  return true;
end;
$$;

-- Grant execution permissions
grant execute on function public.delete_user_account() to authenticated;
grant execute on function public.delete_user_account() to service_role;
