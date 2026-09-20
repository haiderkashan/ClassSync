-- ============================================================================
-- ClassSync Schedule Overrides & Exceptions Migration
-- Migration: 20260920000000_schedule_overrides.sql
-- Description: Creates the schedule_overrides table with nullable base_schedule_id
--              for ad-hoc makeup sessions, strict RLS policies, indexes,
--              and enables Supabase Realtime publication.
-- ============================================================================

create table if not exists public.schedule_overrides (
    id uuid primary key default gen_random_uuid(),
    base_schedule_id uuid references public.base_schedule(id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    section_id uuid not null references public.sections(id) on delete cascade,
    override_date date not null,
    status text not null default 'scheduled' check (status in ('scheduled', 'started', 'delayed', 'cancelled', 'room_moved', 'instructor_away')),
    delay_minutes integer not null default 0 check (delay_minutes >= 0),
    new_room text,
    custom_note text,
    is_makeup boolean not null default false,
    makeup_start_time time without time zone,
    makeup_end_time time without time zone,
    created_by text references public.profiles(id) on delete set null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Unique index to prevent duplicate overrides on the same recurring base block on the same date
create unique index if not exists idx_overrides_base_date 
on public.schedule_overrides(base_schedule_id, override_date) 
where base_schedule_id is not null;

-- Performance indexes for agenda queries
create index if not exists idx_overrides_section_date 
on public.schedule_overrides(section_id, override_date);

create index if not exists idx_overrides_course_date 
on public.schedule_overrides(course_id, override_date);

create index if not exists idx_overrides_date 
on public.schedule_overrides(override_date);

-- Enable Row Level Security
alter table public.schedule_overrides enable row level security;

-- SELECT Policy: Cohort members and enrolled guest students can read overrides
create policy "Members and guests can view schedule overrides"
on public.schedule_overrides
for select
using (
  exists (
    select 1 from public.section_members sm
    where sm.section_id = schedule_overrides.section_id
      and sm.user_id = public.current_user_id()
  )
  or
  exists (
    select 1 from public.course_enrollments ce
    where ce.course_id = schedule_overrides.course_id
      and ce.user_id = public.current_user_id()
  )
);

-- INSERT / UPDATE / DELETE Policies: Only Section Admins (Genesis CR / Co-Admin)
create policy "Section admins can insert schedule overrides"
on public.schedule_overrides
for insert
with check (
  public.is_section_admin(section_id)
);

create policy "Section admins can update schedule overrides"
on public.schedule_overrides
for update
using (
  public.is_section_admin(section_id)
)
with check (
  public.is_section_admin(section_id)
);

create policy "Section admins can delete schedule overrides"
on public.schedule_overrides
for delete
using (
  public.is_section_admin(section_id)
);

-- Add to Realtime Publication for sub-second live updates
alter publication supabase_realtime add table public.schedule_overrides;
