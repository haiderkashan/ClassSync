-- ============================================================================
-- ClassSync Deletion Audit Tombstones Schema Migration
-- Migration: 20260923000000_sync_tombstones.sql
-- Description: Creates sync_tombstones table and automated AFTER DELETE triggers
--              on base_schedule, schedule_overrides, academic_tasks,
--              attendance_logs, and user_task_completions for delta synchronization.
-- ============================================================================

-- 1. SYNC TOMBSTONES TABLE
create table if not exists public.sync_tombstones (
    id uuid primary key default gen_random_uuid(),
    entity_type text not null check (
        entity_type in (
            'base_schedule',
            'schedule_override',
            'academic_task',
            'attendance_log',
            'user_task_completion'
        )
    ),
    record_id uuid not null,
    course_id uuid references public.courses(id) on delete cascade,
    section_id uuid references public.sections(id) on delete cascade,
    user_id text references public.profiles(id) on delete cascade,
    deleted_at timestamptz default timezone('utc'::text, now()) not null
);

-- Performance & Lookup Indexes
create index if not exists idx_sync_tombstones_deleted_at on public.sync_tombstones(deleted_at);
create index if not exists idx_sync_tombstones_lookup on public.sync_tombstones(entity_type, deleted_at);
create index if not exists idx_sync_tombstones_course on public.sync_tombstones(course_id, deleted_at);
create index if not exists idx_sync_tombstones_user on public.sync_tombstones(user_id, deleted_at);
create index if not exists idx_sync_tombstones_section on public.sync_tombstones(section_id, deleted_at);

-- Enable Row Level Security
alter table public.sync_tombstones enable row level security;

-- SELECT Policy: Users can only see tombstones relevant to their cohort, enrolled courses, or private records
create policy "Users can view relevant sync tombstones"
on public.sync_tombstones
for select
using (
    (user_id is not null and user_id = public.current_user_id())
    or
    (section_id is not null and public.is_section_member(section_id))
    or
    (course_id is not null and (
        public.is_course_enrolled(course_id)
        or exists (
            select 1 from public.courses c
            where c.id = sync_tombstones.course_id
              and public.is_section_member(c.section_id)
        )
    ))
);

-- Realtime publication for immediate live pruning on connected clients
alter publication supabase_realtime add table public.sync_tombstones;

-- 2. AFTER DELETE TRIGGER FUNCTIONS

-- 2.1 Trigger for base_schedule
create or replace function public.log_base_schedule_tombstone()
returns trigger language plpgsql security definer as $$
declare
    v_section_id uuid;
begin
    select section_id into v_section_id from public.courses where id = OLD.course_id;
    insert into public.sync_tombstones (entity_type, record_id, course_id, section_id, user_id, deleted_at)
    values ('base_schedule', OLD.id, OLD.course_id, v_section_id, null, timezone('utc'::text, now()));
    return OLD;
end;
$$;

drop trigger if exists trg_base_schedule_tombstone on public.base_schedule;
create trigger trg_base_schedule_tombstone
after delete on public.base_schedule
for each row execute function public.log_base_schedule_tombstone();

-- 2.2 Trigger for schedule_overrides
create or replace function public.log_schedule_override_tombstone()
returns trigger language plpgsql security definer as $$
declare
    v_section_id uuid;
begin
    select section_id into v_section_id from public.courses where id = OLD.course_id;
    insert into public.sync_tombstones (entity_type, record_id, course_id, section_id, user_id, deleted_at)
    values ('schedule_override', OLD.id, OLD.course_id, v_section_id, null, timezone('utc'::text, now()));
    return OLD;
end;
$$;

drop trigger if exists trg_schedule_override_tombstone on public.schedule_overrides;
create trigger trg_schedule_override_tombstone
after delete on public.schedule_overrides
for each row execute function public.log_schedule_override_tombstone();

-- 2.3 Trigger for academic_tasks
create or replace function public.log_academic_task_tombstone()
returns trigger language plpgsql security definer as $$
begin
    insert into public.sync_tombstones (entity_type, record_id, course_id, section_id, user_id, deleted_at)
    values (
        'academic_task',
        OLD.id,
        OLD.course_id,
        OLD.section_id,
        case when OLD.is_personal then OLD.created_by else null end,
        timezone('utc'::text, now())
    );
    return OLD;
end;
$$;

drop trigger if exists trg_academic_task_tombstone on public.academic_tasks;
create trigger trg_academic_task_tombstone
after delete on public.academic_tasks
for each row execute function public.log_academic_task_tombstone();

-- 2.4 Trigger for attendance_logs
create or replace function public.log_attendance_log_tombstone()
returns trigger language plpgsql security definer as $$
declare
    v_section_id uuid;
begin
    select section_id into v_section_id from public.courses where id = OLD.course_id;
    insert into public.sync_tombstones (entity_type, record_id, course_id, section_id, user_id, deleted_at)
    values ('attendance_log', OLD.id, OLD.course_id, v_section_id, OLD.user_id, timezone('utc'::text, now()));
    return OLD;
end;
$$;

drop trigger if exists trg_attendance_log_tombstone on public.attendance_logs;
create trigger trg_attendance_log_tombstone
after delete on public.attendance_logs
for each row execute function public.log_attendance_log_tombstone();

-- 2.5 Trigger for user_task_completions
create or replace function public.log_user_task_completion_tombstone()
returns trigger language plpgsql security definer as $$
declare
    v_course_id uuid;
    v_section_id uuid;
begin
    select course_id, section_id into v_course_id, v_section_id from public.academic_tasks where id = OLD.task_id;
    insert into public.sync_tombstones (entity_type, record_id, course_id, section_id, user_id, deleted_at)
    values ('user_task_completion', OLD.task_id, v_course_id, v_section_id, OLD.user_id, timezone('utc'::text, now()));
    return OLD;
end;
$$;

drop trigger if exists trg_user_task_completion_tombstone on public.user_task_completions;
create trigger trg_user_task_completion_tombstone
after delete on public.user_task_completions
for each row execute function public.log_user_task_completion_tombstone();
