# ClassSync System Architecture & Database Specification

**Document Version:** 2.0  
**Target Platform:** Mobile-Only (iOS & Android via React Native Expo)  
**Infrastructure:** Supabase (PostgreSQL 15+, Realtime Webhooks), Clerk (Auth), Expo Push Notification Services  

---

## 1. High-Level Architecture Overview

ClassSync operates as a high-velocity, decentralized mobile client connecting directly to Supabase via authenticated REST, PostgreSQL Realtime WebSockets, and Edge Functions.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         React Native (Expo) Client                       │
├───────────────────────┬─────────────────────────┬────────────────────────┤
│  Presentation Layer   │   State & Cache Layer   │   Sync & Offline Layer │
│  - Expo Router v3     │   - Zustand (App State) │   - Local Expo SQLite  │
│  - RN Reanimated 3    │   - TanStack Query v5   │   - MMKV Storage       │
│  - Native Calendars   │   - Clerk Auth Context  │   - NetInfo Listener   │
└───────────┬───────────┴────────────┬────────────┴───────────┬────────────┘
            │                        │                        │
     Clerk OAuth JWT           REST / RPC / RLS         Realtime WS
     (Google / Apple)          (PostgREST v12)          (Phoenix Channels)
            │                        │                        │
            ▼                        ▼                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Supabase Backend Ecosystem                         │
├──────────────────────────────────────────────────────────────────────────┤
│  - Third-Party Auth Validator (Clerk JWKS / JWT sub validation)          │
│  - PostgreSQL 15 Core Database (Row Level Security enforced)             │
│  - Realtime CDC Engine (WAL -> Broadcast & Postgres Changes)             │
│  - Edge Functions (Deno): Push Notification Dispatcher & Quiet Hours      │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │ Expo Push Notification Server │
                     │   (APNs for iOS / FCM for An) │
                     └───────────────────────────────┘
```

---

## 2. Authentication & Third-Party Integration Bridge

ClassSync uses **Clerk** for customer-facing authentication (supporting native Google Sign-In and Apple Sign-In). 

### 2.1 Clerk to Supabase JWT Bridging
1. In the Clerk Dashboard, a Supabase JWT Template is configured:
   ```json
   {
     "aud": "authenticated",
     "role": "authenticated",
     "sub": "{{user.id}}",
     "email": "{{user.primary_email_address}}",
     "app_metadata": {
       "provider": "clerk"
     },
     "user_metadata": {
       "full_name": "{{user.full_name}}",
       "avatar_url": "{{user.image_url}}"
     }
   }
   ```
2. In React Native, the authenticated Clerk session produces a Supabase-compatible JWT via:
   ```typescript
   const token = await session.getToken({ template: 'supabase' });
   ```
3. The custom Supabase client sets this token in the `Authorization: Bearer <token>` header for all REST, RPC, and WebSocket subscriptions.
4. PostgreSQL identifies the user via `auth.jwt() ->> 'sub'`, which matches the Clerk `user_id`.

---

## 3. Complete Supabase PostgreSQL Schema (DDL)

```sql
-- ============================================================================
-- 1. EXTENSIONS & SETUP
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "citext";

-- ============================================================================
-- 2. CUSTOM ENUMS
-- ============================================================================
create type user_role as enum ('lead_admin', 'co_admin', 'member');
create type membership_type as enum ('cohort', 'course_guest');
create type session_type as enum ('lecture', 'lab', 'tutorial', 'seminar', 'studio', 'other');
create type week_frequency as enum ('weekly', 'biweekly_week_a', 'biweekly_week_b');
create type class_status as enum ('scheduled', 'started', 'delayed', 'cancelled', 'room_moved', 'instructor_away');
create type task_type as enum ('assignment', 'quiz', 'exam', 'project', 'presentation', 'other');
create type cycle_mode as enum ('standard_weekly', 'alternating_ab');

-- ============================================================================
-- 3. PROFILES TABLE (Synced with Clerk)
-- ============================================================================
create table public.profiles (
    id text primary key, -- Clerk User ID (e.g. 'user_2N...')
    display_name text not null,
    avatar_url text,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- ============================================================================
-- 4. WORKSPACES (COHORTS)
-- ============================================================================
create table public.workspaces (
    id uuid primary key default uuid_generate_v4(),
    name text not null, -- e.g. "Computer Science Class of 2027"
    institution_tag text, -- e.g. "University of Melbourne"
    join_code text unique not null, -- 7-char alphanumeric code
    timezone text not null default 'UTC', -- IANA identifier: e.g. "Europe/London"
    cycle_mode cycle_mode not null default 'standard_weekly',
    week_a_anchor_date date, -- Anchor date to calculate odd/even A/B weeks
    term_start_date date,
    term_end_date date,
    is_archived boolean not null default false,
    created_by text references public.profiles(id) on delete set null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_workspaces_join_code on public.workspaces(join_code);

-- ============================================================================
-- 5. COURSES (MODULES)
-- ============================================================================
create table public.courses (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    code text not null, -- e.g. "CS101"
    name text not null, -- e.g. "Data Structures"
    color_hex text not null default '#4F46E5',
    guest_invite_token text unique not null default encode(gen_random_bytes(12), 'hex'),
    is_archived boolean not null default false,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_courses_workspace_id on public.courses(workspace_id);
create index idx_courses_guest_token on public.courses(guest_invite_token);

-- ============================================================================
-- 6. WORKSPACE MEMBERSHIPS
-- ============================================================================
create table public.workspace_members (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id text not null references public.profiles(id) on delete cascade,
    role user_role not null default 'member',
    joined_at timestamptz default timezone('utc'::text, now()) not null,
    unique(workspace_id, user_id)
);

create index idx_workspace_members_user on public.workspace_members(user_id);
create index idx_workspace_members_workspace on public.workspace_members(workspace_id);

-- ============================================================================
-- 7. COURSE ENROLLMENTS & TOGGLES (Cohort + Guest Subscriptions)
-- ============================================================================
create table public.course_enrollments (
    id uuid primary key default uuid_generate_v4(),
    course_id uuid not null references public.courses(id) on delete cascade,
    user_id text not null references public.profiles(id) on delete cascade,
    membership_type membership_type not null default 'cohort',
    is_muted boolean not null default false, -- Student toggle to drop alerts/view
    created_at timestamptz default timezone('utc'::text, now()) not null,
    unique(course_id, user_id)
);

create index idx_enrollments_user on public.course_enrollments(user_id);
create index idx_enrollments_course on public.course_enrollments(course_id);

-- ============================================================================
-- 8. BASE SCHEDULES (Recurring Weekly Loop)
-- ============================================================================
create table public.base_schedules (
    id uuid primary key default uuid_generate_v4(),
    course_id uuid not null references public.courses(id) on delete cascade,
    day_of_week smallint not null check (day_of_week between 1 and 7), -- 1=Mon, 7=Sun
    start_time time without time zone not null, -- Stored in workspace local time
    end_time time without time zone not null,
    room text,
    session_type session_type not null default 'lecture',
    frequency week_frequency not null default 'weekly',
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_base_schedules_course on public.base_schedules(course_id);
create index idx_base_schedules_day on public.base_schedules(day_of_week);

-- ============================================================================
-- 9. SCHEDULE OVERRIDES (Exceptions & Ad-Hoc Makeup Classes)
-- ============================================================================
create table public.schedule_overrides (
    id uuid primary key default uuid_generate_v4(),
    -- Nullable base_schedule_id indicates an ad-hoc makeup class not linked to a recurring slot
    base_schedule_id uuid references public.base_schedules(id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    override_date date not null,
    status class_status not null default 'scheduled',
    delay_minutes integer not null default 0,
    new_room text,
    custom_note text,
    is_makeup boolean not null default false,
    makeup_start_time time without time zone,
    makeup_end_time time without time zone,
    created_by text references public.profiles(id) on delete set null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null,
    unique(base_schedule_id, override_date)
);

create index idx_overrides_date on public.schedule_overrides(override_date);
create index idx_overrides_course on public.schedule_overrides(course_id);

-- ============================================================================
-- 10. ACADEMIC TASKS (Assignments, Quizzes, Exams)
-- ============================================================================
create table public.academic_tasks (
    id uuid primary key default uuid_generate_v4(),
    course_id uuid not null references public.courses(id) on delete cascade,
    title text not null,
    description text,
    task_type task_type not null default 'assignment',
    due_datetime timestamptz not null, -- Stored in UTC
    is_archived boolean not null default false,
    created_by text references public.profiles(id) on delete set null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_academic_tasks_course on public.academic_tasks(course_id);
create index idx_academic_tasks_due on public.academic_tasks(due_datetime);

-- ============================================================================
-- 11. USER TASK COMPLETIONS (Student Personal Checkmarks)
-- ============================================================================
create table public.user_task_completions (
    id uuid primary key default uuid_generate_v4(),
    task_id uuid not null references public.academic_tasks(id) on delete cascade,
    user_id text not null references public.profiles(id) on delete cascade,
    completed_at timestamptz default timezone('utc'::text, now()) not null,
    unique(task_id, user_id)
);

create index idx_task_completions_user on public.user_task_completions(user_id);

-- ============================================================================
-- 12. PUSH TOKENS REGISTRY
-- ============================================================================
create table public.user_push_tokens (
    id uuid primary key default uuid_generate_v4(),
    user_id text not null references public.profiles(id) on delete cascade,
    expo_push_token text not null,
    platform text check (platform in ('ios', 'android')),
    timezone text not null default 'UTC',
    updated_at timestamptz default timezone('utc'::text, now()) not null,
    unique(user_id, expo_push_token)
);

create index idx_push_tokens_user on public.user_push_tokens(user_id);

-- ============================================================================
-- 13. PEER STATUS REPORTS (Crowd-Sourced Fallback Engine)
-- ============================================================================
create table public.peer_status_reports (
    id uuid primary key default uuid_generate_v4(),
    base_schedule_id uuid not null references public.base_schedules(id) on delete cascade,
    report_date date not null,
    reported_status class_status not null,
    user_id text not null references public.profiles(id) on delete cascade,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    unique(base_schedule_id, report_date, user_id)
);

create index idx_peer_reports_schedule on public.peer_status_reports(base_schedule_id, report_date);
```

---

## 4. Row Level Security (RLS) Policies

All tables have RLS enabled to strictly isolate cohorts and protect guest students:

```sql
-- Enable RLS across all tables
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.courses enable row level security;
alter table public.workspace_members enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.base_schedules enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.academic_tasks enable row level security;
alter table public.user_task_completions enable row level security;
alter table public.user_push_tokens enable row level security;
alter table public.peer_status_reports enable row level security;

-- ============================================================================
-- Helper Security Functions (SECURITY DEFINER)
-- ============================================================================
create or replace function public.current_user_id()
returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '');
$$;

create or replace function public.is_workspace_admin(ws_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = public.current_user_id()
      and role in ('lead_admin', 'co_admin')
  );
$$;

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = public.current_user_id()
  );
$$;

create or replace function public.is_course_member(c_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.course_enrollments
    where course_id = c_id
      and user_id = public.current_user_id()
  );
$$;

-- ============================================================================
-- WORKSPACES POLICIES
-- ============================================================================
create policy "Members can view their workspaces"
on public.workspaces for select
using (
  is_workspace_member(id)
  or exists (
    select 1 from public.courses c
    join public.course_enrollments ce on ce.course_id = c.id
    where c.workspace_id = workspaces.id
      and ce.user_id = public.current_user_id()
  )
);

create policy "Authenticated users can create workspaces"
on public.workspaces for insert
with check (public.current_user_id() is not null);

create policy "Admins can update their workspace"
on public.workspaces for update
using (is_workspace_admin(id));

-- ============================================================================
-- COURSES POLICIES
-- ============================================================================
create policy "Users can view enrolled courses or cohort courses"
on public.courses for select
using (
  is_workspace_member(workspace_id)
  or is_course_member(id)
);

create policy "Admins can insert and update courses"
on public.courses for all
using (is_workspace_admin(workspace_id));

-- ============================================================================
-- SCHEDULE & OVERRIDE POLICIES
-- ============================================================================
create policy "Members can view base schedules"
on public.base_schedules for select
using (
  exists (
    select 1 from public.courses c
    where c.id = base_schedules.course_id
      and (is_workspace_member(c.workspace_id) or is_course_member(c.id))
  )
);

create policy "Admins can manage base schedules"
on public.base_schedules for all
using (
  exists (
    select 1 from public.courses c
    where c.id = base_schedules.course_id
      and is_workspace_admin(c.workspace_id)
  )
);

create policy "Members can view overrides"
on public.schedule_overrides for select
using (
  exists (
    select 1 from public.courses c
    where c.id = schedule_overrides.course_id
      and (is_workspace_member(c.workspace_id) or is_course_member(c.id))
  )
);

create policy "Admins can manage schedule overrides"
on public.schedule_overrides for all
using (
  exists (
    select 1 from public.courses c
    where c.id = schedule_overrides.course_id
      and is_workspace_admin(c.workspace_id)
  )
);
```

---

## 5. Global Timezone & Dynamic Schedule Compilation

### 5.1 The Scheduling Challenge
Universities do not operate on floating UTC:
- Class *Web Engineering* meets at **10:00 AM Pakistan Standard Time (PKT)** or **10:00 AM British Summer Time (BST)**.
- If stored simply in UTC, Daylight Saving Time (DST) changes would shift class times unexpectedly.

### 5.2 The Solution
1. **Base Schedule Storage:** Stored with `day_of_week` (1-7) and `time without time zone` (e.g., `10:00:00`). These are strictly relative to the `workspaces.timezone` string (e.g., `America/New_York`).
2. **Client Daily Compilation Algorithm:**
   ```typescript
   function compileDailyAgenda(
     targetDate: Date, 
     workspace: Workspace, 
     baseSchedules: BaseSchedule[], 
     overrides: ScheduleOverride[],
     userEnrollments: CourseEnrollment[]
   ): CompiledClassItem[] {
     const dayOfWeek = getDayOfWeekInTimezone(targetDate, workspace.timezone);
     const activeCourseIds = new Set(
       userEnrollments.filter(e => !e.is_muted).map(e => e.course_id)
     );

     // 1. Filter base items matching day and frequency
     const currentWeekType = calculateWeekCycle(targetDate, workspace);
     const baseToday = baseSchedules.filter(item => {
       if (!activeCourseIds.has(item.course_id)) return false;
       if (item.day_of_week !== dayOfWeek) return false;
       if (item.frequency === 'biweekly_week_a' && currentWeekType !== 'A') return false;
       if (item.frequency === 'biweekly_week_b' && currentWeekType !== 'B') return false;
       return true;
     });

     // 2. Map date-specific overrides
     const dateStr = formatIsoDate(targetDate);
     const todayOverrides = new Map(
       overrides.filter(o => o.override_date === dateStr).map(o => [o.base_schedule_id, o])
     );

     // 3. Merge base with exceptions
     const resolvedClasses: CompiledClassItem[] = baseToday.map(base => {
       const override = todayOverrides.get(base.id);
       if (!override) {
         return { ...base, status: 'scheduled', isOverridden: false };
       }
       return {
         ...base,
         status: override.status,
         delay_minutes: override.delay_minutes,
         room: override.new_room || base.room,
         note: override.custom_note,
         isOverridden: true,
       };
     }).filter(c => c.status !== 'cancelled'); // Marked or filtered according to UI mode

     // 4. Inject makeup classes
     const makeupClasses = overrides
       .filter(o => o.override_date === dateStr && o.is_makeup && activeCourseIds.has(o.course_id))
       .map(o => ({ ...o, isMakeup: true }));

     return [...resolvedClasses, ...makeupClasses].sort((a, b) => a.start_time.localeCompare(b.start_time));
   }
   ```

---

## 6. Real-Time Push Notification Engine & Smart Quiet Hours

### 6.1 Real-Time Broadcast Flow
1. When an Admin updates class status in the mobile UI, an update is written to `schedule_overrides`.
2. Supabase Realtime emits a Postgres CDC event to the channel: `workspace:{workspace_id}`.
3. Connected devices receive the WebSocket payload in <300ms, updating their UI state without requiring a pull-to-refresh.

### 6.2 Push Notification Dispatch via Edge Function
A Supabase Database Webhook triggers an Edge Function (`push-dispatcher`) on every `INSERT` or `UPDATE` on `schedule_overrides`:

```
[Admin Updates Class Status]
            │
            ▼
[schedule_overrides table]
            │ (Database Webhook / pg_net)
            ▼
[Supabase Edge Function: push-dispatcher]
            │
            ├─► 1. Lookup all enrolled users for course_id (where is_muted = false)
            ├─► 2. Query user_push_tokens with device timezone
            ├─► 3. Filter Quiet Hours (10:00 PM - 7:00 AM) unless status is URGENT
            │       (Urgent = Cancelled, Delayed, Room Moved for today)
            ▼
[Expo Push API Batch Send (POST https://exp.host/--/api/v2/push/send)]
            │
            ▼
[Native APNs / FCM Alert on Student Devices (<2.5s)]
```

---

## 7. Offline-First Storage & Client State Engine

To guarantee instantaneous app launches in campus buildings with poor signal, ClassSync implements an offline-first repository pattern:

```
┌─────────────────────────────────────────────────────────┐
│                      UI Components                      │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│          TanStack Query v5 + Zustand Store              │
│       - In-memory cache for ultra-fast rendering        │
└──────────────┬───────────────────────────┬──────────────┘
               │ Cache Miss / Hydration    │ Network Reconnected
               ▼                           ▼
┌──────────────────────────────┐ ┌────────────────────────┐
│     Local SQLite Storage     │ │  Supabase REST Sync    │
│  - Complete Base Schedules   │ │  - Delta sync with     │
│  - 14-day Overrides Window   │ │    updated_at cursor   │
│  - Academic Tasks list       │ │  - Realtime WS updates │
└──────────────────────────────┘ └────────────────────────┘
```

1. **Hydration on Startup:** On app launch, the local SQLite database instantly populates the React Native UI (<100ms). The user sees their full schedule before network calls are even made.
2. **Delta Sync Protocol:** When network is detected (`NetInfo.isConnected === true`), the client queries:
   ```sql
   select * from schedule_overrides 
   where course_id in (...) 
     and updated_at > :last_synced_at;
   ```
3. **Optimistic UI Mutations:** When a student marks a task as complete, the local SQLite database and Zustand state update immediately. The network sync request is queued in an offline mutation table and synced asynchronously.
