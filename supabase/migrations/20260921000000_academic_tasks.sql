-- ============================================================================
-- ClassSync Academic Tasks & Completions Schema Migration
-- Migration: 20260921000000_academic_tasks.sql
-- Description: Creates academic_tasks and user_task_completions tables with
--              strict Row Level Security (RLS), task types enum,
--              cohort vs. personal task isolation, and indexes.
-- ============================================================================

-- 1. ACADEMIC TASKS (Assignments, Quizzes, Projects, Presentations, Administrative)
create table if not exists public.academic_tasks (
    id uuid primary key default gen_random_uuid(),
    section_id uuid not null references public.sections(id) on delete cascade,
    course_id uuid references public.courses(id) on delete cascade, -- Nullable for cohort-wide administrative announcements
    title text not null,
    description text,
    task_type text not null default 'assignment' check (task_type in ('assignment', 'quiz', 'project', 'presentation', 'administrative')),
    due_datetime timestamptz not null,
    is_personal boolean not null default false,
    created_by text not null references public.profiles(id) on delete cascade,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Performance & Lookup Indexes
create index if not exists idx_academic_tasks_section on public.academic_tasks(section_id);
create index if not exists idx_academic_tasks_course on public.academic_tasks(course_id);
create index if not exists idx_academic_tasks_due on public.academic_tasks(due_datetime);
create index if not exists idx_academic_tasks_creator on public.academic_tasks(created_by);
create index if not exists idx_academic_tasks_personal on public.academic_tasks(is_personal, created_by);

-- Enable Row Level Security
alter table public.academic_tasks enable row level security;

-- SELECT Policy:
-- Personal tasks: Visible ONLY to their creator
-- Cohort tasks: Visible to all enrolled section members AND guest students enrolled in the course
create policy "Users can view cohort tasks or their own personal tasks"
on public.academic_tasks
for select
using (
    (is_personal = true and created_by = public.current_user_id())
    or
    (
        is_personal = false
        and (
            exists (
                select 1 from public.section_members sm
                where sm.section_id = academic_tasks.section_id
                  and sm.user_id = public.current_user_id()
            )
            or
            (
                academic_tasks.course_id is not null
                and exists (
                    select 1 from public.course_enrollments ce
                    where ce.course_id = academic_tasks.course_id
                      and ce.user_id = public.current_user_id()
                )
            )
        )
    )
);

-- INSERT Policy:
-- Personal tasks: Any authenticated user can create for themselves
-- Cohort tasks: Only Section Admins (Genesis CR / Co-Admin) can publish
create policy "Users can insert personal tasks or admins can insert cohort tasks"
on public.academic_tasks
for insert
with check (
    (is_personal = true and created_by = public.current_user_id())
    or
    (is_personal = false and public.is_section_admin(section_id) and created_by = public.current_user_id())
);

-- UPDATE Policy:
-- Personal tasks: Only the creator
-- Cohort tasks: Only Section Admins
create policy "Users can update personal tasks or admins can update cohort tasks"
on public.academic_tasks
for update
using (
    (is_personal = true and created_by = public.current_user_id())
    or
    (is_personal = false and public.is_section_admin(section_id))
)
with check (
    (is_personal = true and created_by = public.current_user_id())
    or
    (is_personal = false and public.is_section_admin(section_id))
);

-- DELETE Policy:
-- Personal tasks: Only the creator
-- Cohort tasks: Only Section Admins
create policy "Users can delete personal tasks or admins can delete cohort tasks"
on public.academic_tasks
for delete
using (
    (is_personal = true and created_by = public.current_user_id())
    or
    (is_personal = false and public.is_section_admin(section_id))
);

-- 2. USER TASK COMPLETIONS (Student Personal Checkmarks)
create table if not exists public.user_task_completions (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.academic_tasks(id) on delete cascade,
    user_id text not null references public.profiles(id) on delete cascade,
    completed_at timestamptz default timezone('utc'::text, now()) not null,
    unique(task_id, user_id)
);

create index if not exists idx_task_completions_user on public.user_task_completions(user_id);
create index if not exists idx_task_completions_task on public.user_task_completions(task_id);

-- Enable Row Level Security
alter table public.user_task_completions enable row level security;

-- Completely private to each individual user
create policy "Users can view their own task completions"
on public.user_task_completions
for select
using (
    user_id = public.current_user_id()
);

create policy "Users can insert their own task completions"
on public.user_task_completions
for insert
with check (
    user_id = public.current_user_id()
);

create policy "Users can delete their own task completions"
on public.user_task_completions
for delete
using (
    user_id = public.current_user_id()
);

-- Enable Realtime for academic tasks
alter publication supabase_realtime add table public.academic_tasks;
