-- ============================================================================
-- ClassSync Tasks & Attendance Atomic RPCs Migration
-- Migration: 20260921000002_tasks_attendance_rpcs.sql
-- Description: Creates atomic PL/pgSQL functions for:
--              1. upsert_academic_task (with CR authorization check)
--              2. delete_academic_task
--              3. toggle_task_completion (atomic toggle)
--              4. log_attendance_session (incorporates Deficiency 1 fix for NULL-safe upsert)
--              5. delete_attendance_log
-- ============================================================================

-- 1. UPSERT ACADEMIC TASK
create or replace function public.upsert_academic_task(
    p_id uuid default null,
    p_section_id uuid default null,
    p_course_id uuid default null,
    p_title text default '',
    p_description text default null,
    p_task_type text default 'assignment',
    p_due_datetime timestamptz default null,
    p_is_personal boolean default true
)
returns public.academic_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_task public.academic_tasks;
begin
    v_user_id := public.current_user_id();
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if p_section_id is null then
        raise exception 'section_id is required';
    end if;

    if trim(p_title) = '' then
        raise exception 'Task title cannot be empty';
    end if;

    if p_due_datetime is null then
        raise exception 'due_datetime is required';
    end if;

    -- Authorization check: Cohort tasks require section admin role
    if not p_is_personal and not public.is_section_admin(p_section_id) then
        raise exception 'Only Section Admins can publish cohort-wide tasks';
    end if;

    if p_id is not null then
        -- Update existing task
        update public.academic_tasks
        set
            course_id = p_course_id,
            title = trim(p_title),
            description = p_description,
            task_type = p_task_type,
            due_datetime = p_due_datetime,
            is_personal = p_is_personal,
            updated_at = timezone('utc'::text, now())
        where id = p_id
          and (
              (is_personal and created_by = v_user_id)
              or
              (not is_personal and public.is_section_admin(section_id))
          )
        returning * into v_task;

        if v_task.id is null then
            raise exception 'Task not found or insufficient permissions to update';
        end if;
    else
        -- Insert new task
        insert into public.academic_tasks (
            section_id,
            course_id,
            title,
            description,
            task_type,
            due_datetime,
            is_personal,
            created_by
        ) values (
            p_section_id,
            p_course_id,
            trim(p_title),
            p_description,
            p_task_type,
            p_due_datetime,
            p_is_personal,
            v_user_id
        )
        returning * into v_task;
    end if;

    return v_task;
end;
$$;

-- 2. DELETE ACADEMIC TASK
create or replace function public.delete_academic_task(
    p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_deleted boolean := false;
begin
    v_user_id := public.current_user_id();
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    delete from public.academic_tasks
    where id = p_id
      and (
          (is_personal and created_by = v_user_id)
          or
          (not is_personal and public.is_section_admin(section_id))
      );

    if found then
        v_deleted := true;
    else
        raise exception 'Task not found or insufficient permissions to delete';
    end if;

    return v_deleted;
end;
$$;

-- 3. TOGGLE TASK COMPLETION
create or replace function public.toggle_task_completion(
    p_task_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_is_completed boolean := false;
begin
    v_user_id := public.current_user_id();
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    -- Check if completion record already exists
    if exists (
        select 1 from public.user_task_completions
        where task_id = p_task_id and user_id = v_user_id
    ) then
        -- Untoggle: delete completion
        delete from public.user_task_completions
        where task_id = p_task_id and user_id = v_user_id;
        v_is_completed := false;
    else
        -- Toggle: insert completion
        insert into public.user_task_completions (task_id, user_id)
        values (p_task_id, v_user_id);
        v_is_completed := true;
    end if;

    return v_is_completed;
end;
$$;

-- 4. LOG ATTENDANCE SESSION (Incorporates Deficiency 1 Fix for NULL-safe Upsert)
create or replace function public.log_attendance_session(
    p_course_id uuid,
    p_date date,
    p_status text,
    p_schedule_block_id uuid default null,
    p_override_id uuid default null,
    p_notes text default null
)
returns public.attendance_logs
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_existing_id uuid;
    v_result public.attendance_logs;
begin
    v_user_id := public.current_user_id();
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if p_course_id is null then
        raise exception 'course_id is required';
    end if;

    if p_date is null then
        raise exception 'attendance_date is required';
    end if;

    if p_status not in ('present', 'absent', 'late', 'excused') then
        raise exception 'Invalid attendance status: %', p_status;
    end if;

    -- Deficiency 1 Fix: Explicitly search for existing matching row
    -- Handles PostgreSQL NULL != NULL comparison for both recurring blocks and ad-hoc makeups
    select id into v_existing_id
    from public.attendance_logs
    where user_id = v_user_id
      and course_id = p_course_id
      and attendance_date = p_date
      and (
          (p_schedule_block_id is not null and schedule_block_id = p_schedule_block_id)
          or
          (p_override_id is not null and override_id = p_override_id)
          or
          (p_schedule_block_id is null and p_override_id is null and schedule_block_id is null and override_id is null)
      )
    limit 1;

    if v_existing_id is not null then
        -- Update existing log
        update public.attendance_logs
        set
            status = p_status,
            notes = coalesce(p_notes, notes),
            schedule_block_id = coalesce(p_schedule_block_id, schedule_block_id),
            override_id = coalesce(p_override_id, override_id),
            updated_at = timezone('utc'::text, now())
        where id = v_existing_id
        returning * into v_result;
    else
        -- Insert new log
        insert into public.attendance_logs (
            user_id,
            course_id,
            schedule_block_id,
            override_id,
            attendance_date,
            status,
            notes
        ) values (
            v_user_id,
            p_course_id,
            p_schedule_block_id,
            p_override_id,
            p_date,
            p_status,
            p_notes
        )
        returning * into v_result;
    end if;

    return v_result;
end;
$$;

-- 5. DELETE ATTENDANCE LOG
create or replace function public.delete_attendance_log(
    p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_deleted boolean := false;
begin
    v_user_id := public.current_user_id();
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    delete from public.attendance_logs
    where id = p_id
      and user_id = v_user_id;

    if found then
        v_deleted := true;
    else
        raise exception 'Attendance log not found or unauthorized';
    end if;

    return v_deleted;
end;
$$;
