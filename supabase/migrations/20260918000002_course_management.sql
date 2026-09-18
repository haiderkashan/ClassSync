-- ============================================================================
-- ClassSync Course Management & Guest Enrollment RPC Migration
-- Migration: 20260918000002_course_management.sql
-- Description: Adds join_code to courses, implements create_course and 
--              join_course_guest atomic RPCs.
-- ============================================================================

-- 1. Ensure join_code column exists on courses table
alter table public.courses 
add column if not exists join_code varchar(6) unique;

-- Make code column nullable or set a fallback so title-only course creation succeeds
alter table public.courses 
alter column code drop not null;

create index if not exists idx_courses_join_code on public.courses(join_code);

-- 2. Atomic Course Creation RPC (by Section Admin / Genesis CR)
create or replace function public.create_course(
  p_section_id uuid,
  p_title text,
  p_join_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_course_id uuid;
  v_normalized_join_code text;
  v_trimmed_title text;
begin
  -- Identify calling authenticated user
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  -- Validate permissions: must be section admin or section creator
  if not public.is_section_admin(p_section_id) then
    if not exists (
      select 1 from public.sections s
      where s.id = p_section_id and s.created_by = v_user_id
    ) then
      raise exception 'Unauthorized: Only Section Admins or Genesis CR can add courses';
    end if;
  end if;

  v_trimmed_title := trim(p_title);
  if v_trimmed_title = '' then
    raise exception 'Course title cannot be empty';
  end if;

  -- Normalize 6-character join code
  v_normalized_join_code := upper(trim(regexp_replace(p_join_code, '\s+', '', 'g')));
  if length(v_normalized_join_code) <> 6 then
    raise exception 'Course join code must be exactly 6 alphanumeric characters';
  end if;

  -- Insert the new course
  insert into public.courses (
    section_id,
    name,
    code,
    join_code,
    is_archived
  ) values (
    p_section_id,
    v_trimmed_title,
    v_normalized_join_code,
    v_normalized_join_code,
    false
  )
  returning id into v_course_id;

  -- Atomically enroll all existing section members into the new course
  insert into public.course_enrollments (course_id, user_id, is_active, is_guest)
  select 
    v_course_id,
    sm.user_id,
    true,
    false
  from public.section_members sm
  where sm.section_id = p_section_id
  on conflict (course_id, user_id) do nothing;

  return v_course_id;
end;
$$;

-- 3. Guest Join Course RPC (for Irregular / Retake Students)
create or replace function public.join_course_guest(
  p_join_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_course_id uuid;
  v_normalized_code text;
begin
  -- Identify calling authenticated user
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required to join course';
  end if;

  v_normalized_code := upper(trim(regexp_replace(p_join_code, '\s+', '', 'g')));
  if length(v_normalized_code) <> 6 then
    raise exception 'Invalid course code format';
  end if;

  -- Find active course matching join_code
  select id into v_course_id
  from public.courses
  where upper(join_code) = v_normalized_code
    and is_archived = false
  limit 1;

  if v_course_id is null then
    raise exception 'Course not found or archived';
  end if;

  -- Enroll user into course_enrollments as guest
  insert into public.course_enrollments (course_id, user_id, is_active, is_guest)
  values (v_course_id, v_user_id, true, true)
  on conflict (course_id, user_id) do update
  set is_active = true;

  return v_course_id;
end;
$$;

-- Grant execution permissions to authenticated and anon roles
grant execute on function public.create_course(uuid, text, text) to authenticated, anon;
grant execute on function public.join_course_guest(text) to authenticated, anon;
