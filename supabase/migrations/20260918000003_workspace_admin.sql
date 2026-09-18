-- ============================================================================
-- ClassSync Workspace Administration & Member Management RPC Migration
-- Migration: 20260918000003_workspace_admin.sql
-- Description: Implements leave_section, leave_course_guest, archive_section,
--              transfer_section_ownership, update_member_role, and remove_section_member.
-- ============================================================================

-- 1. Leave Section RPC (with Genesis CR safeguards)
create or replace function public.leave_section(p_section_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_user_role text;
  v_is_archived boolean;
  v_other_members_count integer;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  -- Check user membership
  select role into v_user_role
  from public.section_members
  where section_id = p_section_id and user_id = v_user_id;

  if v_user_role is null then
    raise exception 'You are not a member of this section';
  end if;

  -- Enforce Genesis CR departure safeguard
  if v_user_role = 'genesis_cr' then
    select is_archived into v_is_archived from public.sections where id = p_section_id;
    select count(*) into v_other_members_count
    from public.section_members
    where section_id = p_section_id and user_id <> v_user_id;

    if not coalesce(v_is_archived, false) and v_other_members_count > 0 then
      raise exception 'Genesis CR cannot leave an active section with remaining members. Please transfer ownership or archive the section first.';
    end if;
  end if;

  -- Remove from section members
  delete from public.section_members
  where section_id = p_section_id and user_id = v_user_id;

  -- Remove standard (non-guest) course enrollments for this section
  delete from public.course_enrollments ce
  using public.courses c
  where ce.course_id = c.id
    and c.section_id = p_section_id
    and ce.user_id = v_user_id
    and ce.is_guest = false;

  -- If zero members remain, archive the section
  if not exists (select 1 from public.section_members where section_id = p_section_id) then
    update public.sections set is_archived = true, updated_at = timezone('utc'::text, now()) where id = p_section_id;
  end if;

  return true;
end;
$$;

-- 2. Leave Course Guest RPC (for irregular students)
create or replace function public.leave_course_guest(p_course_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  delete from public.course_enrollments
  where course_id = p_course_id
    and user_id = v_user_id
    and is_guest = true;

  return true;
end;
$$;

-- 3. Archive Section RPC
create or replace function public.archive_section(p_section_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  -- Verify caller is Genesis CR or creator
  if not exists (
    select 1 from public.section_members
    where section_id = p_section_id
      and user_id = v_user_id
      and role = 'genesis_cr'
  ) and not exists (
    select 1 from public.sections
    where id = p_section_id and created_by = v_user_id
  ) then
    raise exception 'Unauthorized: Only the Genesis CR can archive this section';
  end if;

  update public.sections
  set is_archived = true,
      updated_at = timezone('utc'::text, now())
  where id = p_section_id;

  return true;
end;
$$;

-- 4. Transfer Section Ownership RPC
create or replace function public.transfer_section_ownership(
  p_section_id uuid,
  p_new_cr_user_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  -- Verify caller is current Genesis CR
  if not exists (
    select 1 from public.section_members
    where section_id = p_section_id
      and user_id = v_user_id
      and role = 'genesis_cr'
  ) then
    raise exception 'Unauthorized: Only the current Genesis CR can transfer ownership';
  end if;

  -- Verify target user is a member of this section
  if not exists (
    select 1 from public.section_members
    where section_id = p_section_id and user_id = p_new_cr_user_id
  ) then
    raise exception 'Target user is not a member of this section';
  end if;

  -- Demote current Genesis CR to regular member
  update public.section_members
  set role = 'member'
  where section_id = p_section_id and user_id = v_user_id;

  -- Promote target user to Genesis CR
  update public.section_members
  set role = 'genesis_cr'
  where section_id = p_section_id and user_id = p_new_cr_user_id;

  -- Update section created_by
  update public.sections
  set created_by = p_new_cr_user_id,
      updated_at = timezone('utc'::text, now())
  where id = p_section_id;

  return true;
end;
$$;

-- 5. Update Member Role RPC (Co-Admin Delegation, max 2 co-admins)
create or replace function public.update_member_role(
  p_section_id uuid,
  p_target_user_id text,
  p_new_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_co_admin_count integer;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  -- Verify caller is Genesis CR
  if not exists (
    select 1 from public.section_members
    where section_id = p_section_id
      and user_id = v_user_id
      and role = 'genesis_cr'
  ) then
    raise exception 'Unauthorized: Only Genesis CR can delegate co-admins';
  end if;

  if p_new_role not in ('co_admin', 'member') then
    raise exception 'Invalid role: must be co_admin or member';
  end if;

  -- Check max 2 co-admins constraint when promoting
  if p_new_role = 'co_admin' then
    select count(*) into v_co_admin_count
    from public.section_members
    where section_id = p_section_id
      and role = 'co_admin'
      and user_id <> p_target_user_id;

    if v_co_admin_count >= 2 then
      raise exception 'A section can have at most 2 Co-Admins';
    end if;
  end if;

  update public.section_members
  set role = p_new_role
  where section_id = p_section_id and user_id = p_target_user_id;

  return true;
end;
$$;

-- 6. Remove Section Member RPC (for CRs/Admins)
create or replace function public.remove_section_member(
  p_section_id uuid,
  p_target_user_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_target_role text;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  -- Verify caller is Genesis CR or Co-Admin
  if not public.is_section_admin(p_section_id) then
    raise exception 'Unauthorized: Only section admins can remove members';
  end if;

  -- Target user cannot be Genesis CR
  select role into v_target_role
  from public.section_members
  where section_id = p_section_id and user_id = p_target_user_id;

  if v_target_role = 'genesis_cr' then
    raise exception 'Cannot remove the Genesis CR from the section';
  end if;

  -- Cannot remove self via this method
  if v_user_id = p_target_user_id then
    raise exception 'Cannot remove yourself; use leave_section instead';
  end if;

  -- Remove from section members
  delete from public.section_members
  where section_id = p_section_id and user_id = p_target_user_id;

  -- Remove course enrollments
  delete from public.course_enrollments ce
  using public.courses c
  where ce.course_id = c.id
    and c.section_id = p_section_id
    and ce.user_id = p_target_user_id
    and ce.is_guest = false;

  return true;
end;
$$;

-- Grant execution permissions to authenticated and anon roles
grant execute on function public.leave_section(uuid) to authenticated, anon;
grant execute on function public.leave_course_guest(uuid) to authenticated, anon;
grant execute on function public.archive_section(uuid) to authenticated, anon;
grant execute on function public.transfer_section_ownership(uuid, text) to authenticated, anon;
grant execute on function public.update_member_role(uuid, text, text) to authenticated, anon;
grant execute on function public.remove_section_member(uuid, text) to authenticated, anon;
