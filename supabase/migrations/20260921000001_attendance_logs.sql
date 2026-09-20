-- ============================================================================
-- ClassSync Attendance Logs Schema Migration
-- Migration: 20260921000001_attendance_logs.sql
-- Description: Creates the attendance_logs table with partial unique indexes
--              preventing duplicate logs for both recurring blocks and ad-hoc
--              makeups, and enforces strict private Row Level Security (RLS).
-- ============================================================================

create table if not exists public.attendance_logs (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references public.profiles(id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    schedule_block_id uuid references public.base_schedule(id) on delete set null,
    override_id uuid references public.schedule_overrides(id) on delete set null,
    attendance_date date not null,
    status text not null check (status in ('present', 'absent', 'late', 'excused')),
    notes text,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Partial unique index 1: Prevent duplicate attendance logs for the same recurring schedule block
create unique index if not exists idx_attendance_block_unique
on public.attendance_logs(user_id, course_id, attendance_date, schedule_block_id)
where schedule_block_id is not null;

-- Partial unique index 2: Prevent duplicate attendance logs for the same ad-hoc override/makeup class
create unique index if not exists idx_attendance_override_unique
on public.attendance_logs(user_id, course_id, attendance_date, override_id)
where override_id is not null;

-- Partial unique index 3: Prevent duplicate generic course logs when both block and override are null
create unique index if not exists idx_attendance_daily_course_unique
on public.attendance_logs(user_id, course_id, attendance_date)
where schedule_block_id is null and override_id is null;

-- Performance and analytical lookup indexes
create index if not exists idx_attendance_user_course
on public.attendance_logs(user_id, course_id);

create index if not exists idx_attendance_user_date
on public.attendance_logs(user_id, attendance_date);

-- Enable Row Level Security (RLS)
alter table public.attendance_logs enable row level security;

-- Strict Personal Isolation Policies:
-- University attendance is strictly private to the student; classmates and admins have 0 read/write access.
create policy "Users can view their own attendance logs"
on public.attendance_logs
for select
using (
    user_id = public.current_user_id()
);

create policy "Users can insert their own attendance logs"
on public.attendance_logs
for insert
with check (
    user_id = public.current_user_id()
);

create policy "Users can update their own attendance logs"
on public.attendance_logs
for update
using (
    user_id = public.current_user_id()
)
with check (
    user_id = public.current_user_id()
);

create policy "Users can delete their own attendance logs"
on public.attendance_logs
for delete
using (
    user_id = public.current_user_id()
);
