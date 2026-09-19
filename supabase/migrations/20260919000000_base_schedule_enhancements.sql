-- ============================================================================
-- ClassSync Base Timetable Builder & Recurring Schedule RPC Migration
-- Migration: 20260919000000_base_schedule_enhancements.sql
-- Description: Adds instructor, color_override, extended session_type constraints
--              ('break', 'prayer', 'meeting'), and implements upsert_base_schedule_block,
--              clone_day_schedule, and delete_base_schedule_block RPCs.
-- ============================================================================

-- 1. Table schema enhancements
alter table public.base_schedule 
add column if not exists instructor text;

alter table public.base_schedule 
add column if not exists color_override varchar(7);

-- 2. Constraints for session types and time integrity
alter table public.base_schedule 
drop constraint if exists base_schedule_session_type_check;

alter table public.base_schedule 
add constraint base_schedule_session_type_check 
check (session_type in (
  'lecture', 
  'lab', 
  'tutorial', 
  'seminar', 
  'studio', 
  'workshop', 
  'break', 
  'prayer', 
  'meeting'
));

alter table public.base_schedule 
drop constraint if exists base_schedule_time_check;

alter table public.base_schedule 
add constraint base_schedule_time_check 
check (end_time > start_time);

alter table public.base_schedule 
drop constraint if exists base_schedule_frequency_check;

alter table public.base_schedule 
add constraint base_schedule_frequency_check 
check (frequency in ('weekly', 'biweekly_week_a', 'biweekly_week_b'));

-- 3. Composite indexing for optimized weekly timetable retrieval
create index if not exists idx_base_schedule_section_day_time 
on public.base_schedule(course_id, day_of_week, start_time);

-- 4. Atomic Upsert Schedule Block RPC (Soft Clash - allows overlapping sessions)
create or replace function public.upsert_base_schedule_block(
  p_id uuid default null,
  p_course_id uuid default null,
  p_day_of_week smallint default null,
  p_start_time time without time zone default null,
  p_end_time time without time zone default null,
  p_room text default null,
  p_session_type text default 'lecture',
  p_frequency text default 'weekly',
  p_instructor text default null,
  p_color_override text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_section_id uuid;
  v_block_id uuid;
  v_target_id uuid;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  if p_course_id is null then
    raise exception 'Course ID is required';
  end if;

  if p_day_of_week is null or p_day_of_week < 1 or p_day_of_week > 7 then
    raise exception 'Day of week must be between 1 (Monday) and 7 (Sunday)';
  end if;

  if p_start_time is null or p_end_time is null then
    raise exception 'Start time and end time are required';
  end if;

  if p_end_time <= p_start_time then
    raise exception 'End time must be strictly after start time';
  end if;

  -- Locate section from course
  select section_id into v_section_id
  from public.courses
  where id = p_course_id;

  if v_section_id is null then
    raise exception 'Course not found';
  end if;

  -- Validate administrative authorization (genesis_cr or co_admin)
  if not public.is_section_admin(v_section_id) then
    raise exception 'Unauthorized: Only Genesis CR or Co-Admin can modify the base timetable';
  end if;

  -- Validate session type
  if p_session_type not in (
    'lecture', 'lab', 'tutorial', 'seminar', 'studio', 'workshop', 'break', 'prayer', 'meeting'
  ) then
    raise exception 'Invalid session type: %', p_session_type;
  end if;

  -- Validate frequency
  if p_frequency not in ('weekly', 'biweekly_week_a', 'biweekly_week_b') then
    raise exception 'Invalid frequency: %', p_frequency;
  end if;

  v_target_id := coalesce(p_id, gen_random_uuid());

  -- Upsert schedule block (soft clash model: allows simultaneous electives / split labs)
  insert into public.base_schedule (
    id,
    course_id,
    day_of_week,
    start_time,
    end_time,
    room,
    session_type,
    frequency,
    instructor,
    color_override,
    updated_at
  ) values (
    v_target_id,
    p_course_id,
    p_day_of_week,
    p_start_time,
    p_end_time,
    nullif(trim(p_room), ''),
    p_session_type,
    p_frequency,
    nullif(trim(p_instructor), ''),
    nullif(trim(p_color_override), ''),
    timezone('utc'::text, now())
  )
  on conflict (id) do update set
    course_id = excluded.course_id,
    day_of_week = excluded.day_of_week,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    room = excluded.room,
    session_type = excluded.session_type,
    frequency = excluded.frequency,
    instructor = excluded.instructor,
    color_override = excluded.color_override,
    updated_at = timezone('utc'::text, now())
  returning id into v_block_id;

  return v_block_id;
end;
$$;

-- 5. Day Schedule Cloning RPC
create or replace function public.clone_day_schedule(
  p_section_id uuid,
  p_source_day smallint,
  p_target_day smallint,
  p_override_existing boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_cloned_count integer := 0;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  -- Authorization check
  if not public.is_section_admin(p_section_id) then
    raise exception 'Unauthorized: Only Genesis CR or Co-Admin can clone timetable days';
  end if;

  if p_source_day < 1 or p_source_day > 7 or p_target_day < 1 or p_target_day > 7 then
    raise exception 'Source and target days must be between 1 and 7';
  end if;

  if p_source_day = p_target_day then
    raise exception 'Source day and target day cannot be identical';
  end if;

  -- Optional override: wipe target day blocks for this section
  if p_override_existing then
    delete from public.base_schedule bs
    using public.courses c
    where bs.course_id = c.id
      and c.section_id = p_section_id
      and bs.day_of_week = p_target_day;
  end if;

  -- Duplicate all blocks from source to target day with new UUIDs
  insert into public.base_schedule (
    id,
    course_id,
    day_of_week,
    start_time,
    end_time,
    room,
    session_type,
    frequency,
    instructor,
    color_override
  )
  select
    gen_random_uuid(),
    bs.course_id,
    p_target_day,
    bs.start_time,
    bs.end_time,
    bs.room,
    bs.session_type,
    bs.frequency,
    bs.instructor,
    bs.color_override
  from public.base_schedule bs
  join public.courses c on c.id = bs.course_id
  where c.section_id = p_section_id
    and bs.day_of_week = p_source_day;

  get diagnostics v_cloned_count = row_count;
  return v_cloned_count;
end;
$$;

-- 6. Schedule Block Deletion RPC
create or replace function public.delete_base_schedule_block(p_block_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_section_id uuid;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  select c.section_id into v_section_id
  from public.base_schedule bs
  join public.courses c on c.id = bs.course_id
  where bs.id = p_block_id;

  if v_section_id is null then
    raise exception 'Schedule block not found';
  end if;

  if not public.is_section_admin(v_section_id) then
    raise exception 'Unauthorized: Only Genesis CR or Co-Admin can delete schedule blocks';
  end if;

  delete from public.base_schedule where id = p_block_id;
  return true;
end;
$$;
