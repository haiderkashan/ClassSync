-- ============================================================================
-- ClassSync Enrollment RPC Migration
-- Migration: 20260918000001_enrollment_rpcs.sql
-- Description: Adds is_active to course_enrollments and creates the atomic 
--              join_section_via_code RPC for section and course enrollment.
-- ============================================================================

-- 1. Ensure is_active column exists on course_enrollments
alter table public.course_enrollments 
add column if not exists is_active boolean not null default true;

-- 2. Atomic Join Section via Code RPC
create or replace function public.join_section_via_code(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_section_id uuid;
  v_normalized_code text;
begin
  -- Identify the calling authenticated user
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required to join section';
  end if;

  -- Normalize join code (trim spaces and uppercase)
  v_normalized_code := upper(trim(regexp_replace(p_join_code, '\s+', '', 'g')));
  if v_normalized_code = '' then
    raise exception 'Join code cannot be empty';
  end if;

  -- Find matching active section
  select id into v_section_id
  from public.sections
  where upper(join_code) = v_normalized_code
    and is_archived = false
  limit 1;

  if v_section_id is null then
    raise exception 'Invalid or expired section code';
  end if;

  -- Insert or update section membership (prevent downgrading genesis_cr/co_admin)
  insert into public.section_members (section_id, user_id, role)
  values (v_section_id, v_user_id, 'member')
  on conflict (section_id, user_id) do update
  set role = case 
    when section_members.role in ('genesis_cr', 'co_admin') then section_members.role 
    else 'member' 
  end;

  -- Bulk insert user into all active courses of this section
  insert into public.course_enrollments (course_id, user_id, is_active, is_guest)
  select 
    c.id, 
    v_user_id, 
    true, 
    false
  from public.courses c
  where c.section_id = v_section_id
    and c.is_archived = false
  on conflict (course_id, user_id) do update
  set is_active = true;

  return v_section_id;
end;
$$;

-- Grant execution to authenticated and anon roles
grant execute on function public.join_section_via_code(text) to authenticated, anon;
