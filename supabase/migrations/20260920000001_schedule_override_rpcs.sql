-- ============================================================================
-- ClassSync Schedule Overrides & Exceptions Atomic RPCs
-- Migration: 20260920000001_schedule_override_rpcs.sql
-- Description: Implements atomic upsert_schedule_override and delete_schedule_override
--              with strict Section Admin verification and automatic cleanup.
-- ============================================================================

-- 1. Atomic Upsert Schedule Override RPC
create or replace function public.upsert_schedule_override(
  p_id uuid default null,
  p_base_schedule_id uuid default null,
  p_course_id uuid default null,
  p_section_id uuid default null,
  p_override_date date default null,
  p_status text default 'scheduled',
  p_delay_minutes integer default 0,
  p_new_room text default null,
  p_custom_note text default null,
  p_is_makeup boolean default false,
  p_makeup_start_time time without time zone default null,
  p_makeup_end_time time without time zone default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_section_id uuid;
  v_override_id uuid;
  v_target_id uuid;
begin
  -- Authenticate caller
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  if p_override_date is null then
    raise exception 'Override date is required';
  end if;

  -- Validate Course & Resolve Section
  if p_course_id is null then
    raise exception 'Course ID is required';
  end if;

  select section_id into v_section_id
  from public.courses
  where id = p_course_id;

  if v_section_id is null then
    raise exception 'Course not found';
  end if;

  if p_section_id is not null and p_section_id <> v_section_id then
    raise exception 'Course does not belong to the specified section';
  end if;

  -- Strict Authorization: Only Section Administrators (Genesis CR / Co-Admin)
  if not public.is_section_admin(v_section_id) then
    raise exception 'Unauthorized: Only section administrators can manage schedule overrides';
  end if;

  -- Validate Status Enum
  if p_status not in ('scheduled', 'started', 'delayed', 'cancelled', 'room_moved', 'instructor_away') then
    raise exception 'Invalid schedule status: %', p_status;
  end if;

  -- Validate Makeup Class Times
  if p_is_makeup then
    if p_makeup_start_time is null or p_makeup_end_time is null then
      raise exception 'Makeup classes require both start time and end time';
    end if;
    if p_makeup_end_time <= p_makeup_start_time then
      raise exception 'Makeup end time must be strictly after start time';
    end if;
  end if;

  -- Revert-to-Scheduled Cleanup Optimization:
  -- If a non-makeup override is returned to standard 'scheduled' status with 0 delay and no note/room,
  -- clean up any existing override row so the database remains lean.
  if not p_is_makeup 
     and p_base_schedule_id is not null 
     and p_status = 'scheduled' 
     and coalesce(p_delay_minutes, 0) = 0 
     and (p_new_room is null or trim(p_new_room) = '') 
     and (p_custom_note is null or trim(p_custom_note) = '') then
     
    delete from public.schedule_overrides
    where (p_id is not null and id = p_id)
       or (base_schedule_id = p_base_schedule_id and override_date = p_override_date);
       
    return null;
  end if;

  -- Determine existing target ID if p_id not provided
  if p_id is not null then
    v_target_id := p_id;
  elsif p_base_schedule_id is not null then
    select id into v_target_id
    from public.schedule_overrides
    where base_schedule_id = p_base_schedule_id
      and override_date = p_override_date;
  end if;

  -- Update existing override row
  if v_target_id is not null then
    update public.schedule_overrides
    set
      course_id = p_course_id,
      section_id = v_section_id,
      status = p_status,
      delay_minutes = coalesce(p_delay_minutes, 0),
      new_room = nullif(trim(p_new_room), ''),
      custom_note = nullif(trim(p_custom_note), ''),
      is_makeup = p_is_makeup,
      makeup_start_time = p_makeup_start_time,
      makeup_end_time = p_makeup_end_time,
      updated_at = timezone('utc'::text, now())
    where id = v_target_id
    returning id into v_override_id;

    return v_override_id;
  end if;

  -- Insert new override row
  insert into public.schedule_overrides (
    base_schedule_id,
    course_id,
    section_id,
    override_date,
    status,
    delay_minutes,
    new_room,
    custom_note,
    is_makeup,
    makeup_start_time,
    makeup_end_time,
    created_by,
    created_at,
    updated_at
  ) values (
    p_base_schedule_id,
    p_course_id,
    v_section_id,
    p_override_date,
    p_status,
    coalesce(p_delay_minutes, 0),
    nullif(trim(p_new_room), ''),
    nullif(trim(p_custom_note), ''),
    p_is_makeup,
    p_makeup_start_time,
    p_makeup_end_time,
    v_user_id,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  returning id into v_override_id;

  return v_override_id;
end;
$$;

-- 2. Atomic Delete Schedule Override RPC
create or replace function public.delete_schedule_override(
  p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_section_id uuid;
begin
  -- Authenticate caller
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  if p_id is null then
    raise exception 'Override ID is required';
  end if;

  -- Locate target section
  select section_id into v_section_id
  from public.schedule_overrides
  where id = p_id;

  if v_section_id is null then
    return false; -- Already deleted or non-existent
  end if;

  -- Verify Admin Role
  if not public.is_section_admin(v_section_id) then
    raise exception 'Unauthorized: Only section administrators can delete schedule overrides';
  end if;

  delete from public.schedule_overrides
  where id = p_id;

  return true;
end;
$$;
