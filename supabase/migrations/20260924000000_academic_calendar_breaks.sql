-- ============================================================================
-- ClassSync Academic Calendar Breaks & Cycle Taxonomy Migration
-- Migration: 20260924000000_academic_calendar_breaks.sql
-- Description: Adds cycle naming taxonomy, semester start date, and total
--              instructional weeks to sections. Creates section_calendar_breaks
--              table with strict RLS, indexes, and atomic upsert/delete RPCs.
-- ============================================================================

-- 1. ENHANCE SECTIONS TABLE
alter table public.sections
add column if not exists cycle_naming_convention text not null default 'week_ab';

alter table public.sections
add column if not exists semester_start_date date;

alter table public.sections
add column if not exists total_instructional_weeks integer default 16;

-- Drop check constraint if exists and re-add
alter table public.sections
drop constraint if exists sections_cycle_naming_convention_check;

alter table public.sections
add constraint sections_cycle_naming_convention_check
check (cycle_naming_convention in ('week_ab', 'odd_even', 'cycle_12'));

alter table public.sections
drop constraint if exists sections_total_instructional_weeks_check;

alter table public.sections
add constraint sections_total_instructional_weeks_check
check (total_instructional_weeks > 0 and total_instructional_weeks <= 52);


-- 2. CREATE SECTION CALENDAR BREAKS TABLE
create table if not exists public.section_calendar_breaks (
    id uuid primary key default gen_random_uuid(),
    section_id uuid not null references public.sections(id) on delete cascade,
    break_name text not null,
    start_date date not null,
    end_date date not null,
    freeze_cycle boolean not null default true,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null,
    constraint check_calendar_break_dates check (start_date <= end_date)
);

-- Performance & Query Indexes
create index if not exists idx_calendar_breaks_section_dates
on public.section_calendar_breaks(section_id, start_date, end_date);

-- Enable Row Level Security
alter table public.section_calendar_breaks enable row level security;

-- SELECT Policy: Any member of the section can view calendar breaks
create policy "Section members can view calendar breaks"
on public.section_calendar_breaks
for select
using (
    public.is_section_member(section_id)
);

-- INSERT / UPDATE / DELETE Policies: Only Section Admins (Genesis CR / Co-Admin)
create policy "Section admins can insert calendar breaks"
on public.section_calendar_breaks
for insert
with check (
    public.is_section_admin(section_id)
);

create policy "Section admins can update calendar breaks"
on public.section_calendar_breaks
for update
using (
    public.is_section_admin(section_id)
)
with check (
    public.is_section_admin(section_id)
);

create policy "Section admins can delete calendar breaks"
on public.section_calendar_breaks
for delete
using (
    public.is_section_admin(section_id)
);

-- Realtime publication for instant client updates
alter publication supabase_realtime add table public.section_calendar_breaks;


-- 3. EXPAND update_section_cycle_settings RPC
create or replace function public.update_section_cycle_settings(
  p_section_id uuid,
  p_cycle_mode text,
  p_week_a_anchor_date date default null,
  p_cycle_naming_convention text default 'week_ab',
  p_semester_start_date date default null,
  p_total_instructional_weeks integer default 16
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

  if not public.is_section_admin(p_section_id) then
    raise exception 'Unauthorized: Only section administrators can update cycle settings';
  end if;

  if p_cycle_mode not in ('standard_weekly', 'alternating_ab') then
    raise exception 'Invalid cycle mode: %', p_cycle_mode;
  end if;

  if p_cycle_naming_convention not in ('week_ab', 'odd_even', 'cycle_12') then
    raise exception 'Invalid cycle naming convention: %', p_cycle_naming_convention;
  end if;

  if p_cycle_mode = 'alternating_ab' and p_week_a_anchor_date is null then
    raise exception 'Week A anchor date is required for alternating cycles';
  end if;

  update public.sections
  set
    cycle_mode = p_cycle_mode,
    week_a_anchor_date = case when p_cycle_mode = 'alternating_ab' then p_week_a_anchor_date else null end,
    cycle_naming_convention = p_cycle_naming_convention,
    semester_start_date = p_semester_start_date,
    total_instructional_weeks = coalesce(p_total_instructional_weeks, 16),
    updated_at = timezone('utc'::text, now())
  where id = p_section_id;

  return true;
end;
$$;


-- 4. ATOMIC UPSERT CALENDAR BREAK RPC
create or replace function public.upsert_calendar_break(
  p_id uuid,
  p_section_id uuid,
  p_break_name text,
  p_start_date date,
  p_end_date date,
  p_freeze_cycle boolean default true
)
returns public.section_calendar_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_result public.section_calendar_breaks;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  if not public.is_section_admin(p_section_id) then
    raise exception 'Unauthorized: Only section administrators can manage calendar breaks';
  end if;

  if p_break_name is null or trim(p_break_name) = '' then
    raise exception 'Break name cannot be empty';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'Start date and end date are required';
  end if;

  if p_start_date > p_end_date then
    raise exception 'Start date must be before or equal to end date';
  end if;

  if p_id is not null then
    -- Update existing break
    update public.section_calendar_breaks
    set
      break_name = trim(p_break_name),
      start_date = p_start_date,
      end_date = p_end_date,
      freeze_cycle = coalesce(p_freeze_cycle, true),
      updated_at = timezone('utc'::text, now())
    where id = p_id and section_id = p_section_id
    returning * into v_result;

    if v_result is null then
      raise exception 'Calendar break not found or access denied';
    end if;
  else
    -- Insert new break
    insert into public.section_calendar_breaks (
      id,
      section_id,
      break_name,
      start_date,
      end_date,
      freeze_cycle,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      p_section_id,
      trim(p_break_name),
      p_start_date,
      p_end_date,
      coalesce(p_freeze_cycle, true),
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    )
    returning * into v_result;
  end if;

  return v_result;
end;
$$;


-- 5. ATOMIC DELETE CALENDAR BREAK RPC
create or replace function public.delete_calendar_break(
  p_break_id uuid
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
  v_user_id := public.current_user_id();
  if v_user_id is null or v_user_id = '' then
    raise exception 'Authentication required';
  end if;

  select section_id into v_section_id
  from public.section_calendar_breaks
  where id = p_break_id;

  if v_section_id is null then
    return false;
  end if;

  if not public.is_section_admin(v_section_id) then
    raise exception 'Unauthorized: Only section administrators can delete calendar breaks';
  end if;

  delete from public.section_calendar_breaks
  where id = p_break_id;

  return true;
end;
$$;
