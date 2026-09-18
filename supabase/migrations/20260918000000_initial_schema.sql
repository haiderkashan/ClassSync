-- ============================================================================
-- ClassSync Initial PostgreSQL Schema Migration
-- Migration: 20260918000000_initial_schema.sql
-- Description: Core schema for Profiles, Sections, Section Members, Courses, 
--              Base Schedules, Schedule Exceptions, Academic Tasks, and RLS.
-- ============================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================================
-- 1. PROFILES TABLE (Synced with Auth User ID)
-- ============================================================================
create table if not exists public.profiles (
    id text primary key, -- Auth Provider User ID (e.g., Clerk 'user_2N...')
    email text,
    display_name text not null,
    avatar_url text,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- ============================================================================
-- 2. SECTIONS (Cohorts / Batches)
-- ============================================================================
create table if not exists public.sections (
    id uuid primary key default gen_random_uuid(),
    name text not null, -- e.g., "Software Engineering 2026 - Section A"
    institution_tag text, -- e.g., "National University of Sciences & Technology"
    join_code text unique not null, -- 6-8 char alphanumeric join code
    timezone text not null default 'UTC', -- IANA timezone identifier
    cycle_mode text not null default 'standard_weekly', -- 'standard_weekly' or 'alternating_ab'
    week_a_anchor_date date,
    is_archived boolean not null default false,
    created_by text references public.profiles(id) on delete set null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_sections_join_code on public.sections(join_code);

-- ============================================================================
-- 3. SECTION MEMBERS (Roster & Roles)
-- ============================================================================
create table if not exists public.section_members (
    id uuid primary key default gen_random_uuid(),
    section_id uuid not null references public.sections(id) on delete cascade,
    user_id text not null references public.profiles(id) on delete cascade,
    role text not null default 'member' check (role in ('genesis_cr', 'co_admin', 'member', 'guest')),
    joined_at timestamptz default timezone('utc'::text, now()) not null,
    unique(section_id, user_id)
);

create index if not exists idx_section_members_user on public.section_members(user_id);
create index if not exists idx_section_members_section on public.section_members(section_id);

-- ============================================================================
-- 4. COURSES (Modules / Subjects)
-- ============================================================================
create table if not exists public.courses (
    id uuid primary key default gen_random_uuid(),
    section_id uuid not null references public.sections(id) on delete cascade,
    code text not null, -- e.g., "CS-201"
    name text not null, -- e.g., "Data Structures & Algorithms"
    color_hex text not null default '#4F46E5',
    guest_invite_token text unique not null default md5(random()::text || clock_timestamp()::text),
    is_archived boolean not null default false,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_courses_section on public.courses(section_id);
create index if not exists idx_courses_guest_token on public.courses(guest_invite_token);

-- ============================================================================
-- 5. COURSE ENROLLMENTS & TOGGLES (Cohort + Guest Subscriptions)
-- ============================================================================
create table if not exists public.course_enrollments (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    user_id text not null references public.profiles(id) on delete cascade,
    is_muted boolean not null default false, -- Student toggle to mute class alerts
    is_guest boolean not null default false, -- True if user joined via Course Guest link
    created_at timestamptz default timezone('utc'::text, now()) not null,
    unique(course_id, user_id)
);

create index if not exists idx_enrollments_user on public.course_enrollments(user_id);
create index if not exists idx_enrollments_course on public.course_enrollments(course_id);

-- ============================================================================
-- 6. BASE SCHEDULE (Recurring Weekly Loop)
-- ============================================================================
create table if not exists public.base_schedule (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    day_of_week smallint not null check (day_of_week between 1 and 7), -- 1=Mon, 7=Sun
    start_time time without time zone not null, -- Stored in section local time
    end_time time without time zone not null,
    room text,
    session_type text not null default 'lecture', -- lecture, lab, tutorial, seminar
    frequency text not null default 'weekly', -- weekly, biweekly_week_a, biweekly_week_b
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_base_schedule_course on public.base_schedule(course_id);
create index if not exists idx_base_schedule_day on public.base_schedule(day_of_week);

-- ============================================================================
-- 7. SCHEDULE EXCEPTIONS (Date-Specific Status Overrides & Makeup Classes)
-- ============================================================================
create table if not exists public.schedule_exceptions (
    id uuid primary key default gen_random_uuid(),
    base_schedule_id uuid references public.base_schedule(id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    exception_date date not null,
    status text not null default 'scheduled' check (
        status in ('scheduled', 'started', 'delayed', 'cancelled', 'room_moved', 'instructor_away')
    ),
    delay_minutes integer not null default 0,
    new_room text,
    custom_note text,
    is_makeup boolean not null default false,
    makeup_start_time time without time zone,
    makeup_end_time time without time zone,
    created_by text references public.profiles(id) on delete set null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null,
    unique(base_schedule_id, exception_date)
);

create index if not exists idx_exceptions_date on public.schedule_exceptions(exception_date);
create index if not exists idx_exceptions_course on public.schedule_exceptions(course_id);

-- ============================================================================
-- 8. ACADEMIC TASKS (Assignments, Quizzes, Projects, Exams)
-- ============================================================================
create table if not exists public.academic_tasks (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    title text not null,
    description text,
    task_type text not null default 'assignment' check (
        task_type in ('assignment', 'quiz', 'exam', 'project', 'presentation', 'other')
    ),
    due_datetime timestamptz not null, -- Stored in UTC
    is_archived boolean not null default false,
    created_by text references public.profiles(id) on delete set null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_academic_tasks_course on public.academic_tasks(course_id);
create index if not exists idx_academic_tasks_due on public.academic_tasks(due_datetime);

-- ============================================================================
-- 9. USER TASK COMPLETIONS (Personal Checkmarks)
-- ============================================================================
create table if not exists public.user_task_completions (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.academic_tasks(id) on delete cascade,
    user_id text not null references public.profiles(id) on delete cascade,
    completed_at timestamptz default timezone('utc'::text, now()) not null,
    unique(task_id, user_id)
);

create index if not exists idx_task_completions_user on public.user_task_completions(user_id);

-- ============================================================================
-- 10. USER PUSH TOKENS
-- ============================================================================
create table if not exists public.user_push_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references public.profiles(id) on delete cascade,
    expo_push_token text not null,
    platform text check (platform in ('ios', 'android')),
    timezone text not null default 'UTC',
    updated_at timestamptz default timezone('utc'::text, now()) not null,
    unique(user_id, expo_push_token)
);

create index if not exists idx_push_tokens_user on public.user_push_tokens(user_id);

-- ============================================================================
-- 11. SECURITY FUNCTIONS (Row Level Security Helpers)
-- ============================================================================
create or replace function public.current_user_id()
returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', ''),
    auth.uid()::text
  );
$$;

create or replace function public.is_section_admin(sec_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.section_members
    where section_id = sec_id
      and user_id = public.current_user_id()
      and role in ('genesis_cr', 'co_admin')
  );
$$;

create or replace function public.is_section_member(sec_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.section_members
    where section_id = sec_id
      and user_id = public.current_user_id()
  );
$$;

create or replace function public.is_course_enrolled(c_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.course_enrollments
    where course_id = c_id
      and user_id = public.current_user_id()
  );
$$;

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS across all tables
alter table public.profiles enable row level security;
alter table public.sections enable row level security;
alter table public.section_members enable row level security;
alter table public.courses enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.base_schedule enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.academic_tasks enable row level security;
alter table public.user_task_completions enable row level security;
alter table public.user_push_tokens enable row level security;

-- PROFILES POLICIES
create policy "Authenticated users can view profiles"
on public.profiles for select
using (public.current_user_id() is not null);

create policy "Users can upsert their own profile"
on public.profiles for all
using (id = public.current_user_id())
with check (id = public.current_user_id());

-- SECTIONS POLICIES
create policy "Members can view their sections"
on public.sections for select
using (
  is_section_member(id)
  or exists (
    select 1 from public.courses c
    join public.course_enrollments ce on ce.course_id = c.id
    where c.section_id = sections.id and ce.user_id = public.current_user_id()
  )
);

create policy "Authenticated users can create sections"
on public.sections for insert
with check (public.current_user_id() is not null);

create policy "Section Admins can update their sections"
on public.sections for update
using (is_section_admin(id));

-- SECTION MEMBERS POLICIES
create policy "Section members can view fellow members"
on public.section_members for select
using (is_section_member(section_id));

create policy "Users can join sections or admins can manage members"
on public.section_members for all
using (
  user_id = public.current_user_id()
  or is_section_admin(section_id)
);

-- COURSES POLICIES
create policy "Users can view enrolled courses or section courses"
on public.courses for select
using (
  is_section_member(section_id)
  or is_course_enrolled(id)
);

create policy "Section Admins can manage courses"
on public.courses for all
using (is_section_admin(section_id));

-- COURSE ENROLLMENTS POLICIES
create policy "Users can view own enrollments or section admins can view"
on public.course_enrollments for select
using (
  user_id = public.current_user_id()
  or exists (
    select 1 from public.courses c
    where c.id = course_enrollments.course_id and is_section_admin(c.section_id)
  )
);

create policy "Users can manage own course enrollments"
on public.course_enrollments for all
using (user_id = public.current_user_id());

-- BASE SCHEDULE POLICIES
create policy "Enrolled students can view base schedule"
on public.base_schedule for select
using (
  exists (
    select 1 from public.courses c
    where c.id = base_schedule.course_id
      and (is_section_member(c.section_id) or is_course_enrolled(c.id))
  )
);

create policy "Section Admins can manage base schedule"
on public.base_schedule for all
using (
  exists (
    select 1 from public.courses c
    where c.id = base_schedule.course_id and is_section_admin(c.section_id)
  )
);

-- SCHEDULE EXCEPTIONS POLICIES
create policy "Enrolled students can view exceptions"
on public.schedule_exceptions for select
using (
  exists (
    select 1 from public.courses c
    where c.id = schedule_exceptions.course_id
      and (is_section_member(c.section_id) or is_course_enrolled(c.id))
  )
);

create policy "Section Admins can manage exceptions"
on public.schedule_exceptions for all
using (
  exists (
    select 1 from public.courses c
    where c.id = schedule_exceptions.course_id and is_section_admin(c.section_id)
  )
);

-- ACADEMIC TASKS POLICIES
create policy "Enrolled students can view academic tasks"
on public.academic_tasks for select
using (
  exists (
    select 1 from public.courses c
    where c.id = academic_tasks.course_id
      and (is_section_member(c.section_id) or is_course_enrolled(c.id))
  )
);

create policy "Section Admins can manage academic tasks"
on public.academic_tasks for all
using (
  exists (
    select 1 from public.courses c
    where c.id = academic_tasks.course_id and is_section_admin(c.section_id)
  )
);

-- USER TASK COMPLETIONS POLICIES
create policy "Users can view and manage their task completions"
on public.user_task_completions for all
using (user_id = public.current_user_id());

-- PUSH TOKENS POLICIES
create policy "Users can view and manage their push tokens"
on public.user_push_tokens for all
using (user_id = public.current_user_id());

-- ============================================================================
-- 13. REALTIME SUBSCRIPTION CHANNELS
-- ============================================================================
alter publication supabase_realtime add table public.schedule_exceptions;
alter publication supabase_realtime add table public.academic_tasks;
