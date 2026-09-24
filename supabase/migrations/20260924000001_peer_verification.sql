-- ============================================================================
-- ClassSync Decentralized Peer Verification & Quorum Consensus Migration
-- Migration: 20260924000001_peer_verification.sql
-- Description: Creates peer_schedule_reports and peer_report_votes tables,
--              enforces server-side temporal gate [-10m, +30m], 2x denial
--              weighted quorum math, auto-override on consensus, and CR veto RPC.
-- ============================================================================

-- 1. PEER SCHEDULE REPORTS TABLE
create table if not exists public.peer_schedule_reports (
    id uuid primary key default gen_random_uuid(),
    base_schedule_id uuid not null references public.base_schedule(id) on delete cascade,
    report_date date not null,
    section_id uuid not null references public.sections(id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'vetoed')),
    affirmation_count integer not null default 0 check (affirmation_count >= 0),
    denial_count integer not null default 0 check (denial_count >= 0),
    override_id uuid references public.schedule_overrides(id) on delete set null,
    created_by text references public.profiles(id) on delete set null,
    vetoed_by text references public.profiles(id) on delete set null,
    veto_reason text,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint uq_peer_report_block_date unique (base_schedule_id, report_date)
);

-- Performance and agenda lookup indexes
create index if not exists idx_peer_reports_section_date
    on public.peer_schedule_reports(section_id, report_date);

create index if not exists idx_peer_reports_base_date
    on public.peer_schedule_reports(base_schedule_id, report_date);

create index if not exists idx_peer_reports_status
    on public.peer_schedule_reports(status);

-- 2. PEER REPORT VOTES TABLE
create table if not exists public.peer_report_votes (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references public.peer_schedule_reports(id) on delete cascade,
    user_id text not null references public.profiles(id) on delete cascade,
    vote text not null check (vote in ('affirm', 'deny')),
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint uq_peer_vote_report_user unique (report_id, user_id)
);

create index if not exists idx_peer_votes_report
    on public.peer_report_votes(report_id);

create index if not exists idx_peer_votes_user
    on public.peer_report_votes(user_id);

-- 3. ENABLE RLS
alter table public.peer_schedule_reports enable row level security;
alter table public.peer_report_votes enable row level security;

-- SELECT Policies: Cohort members & enrolled guests can view reports & votes
create policy "Members and guests can view peer schedule reports"
on public.peer_schedule_reports
for select
using (
    public.is_section_member(section_id)
    or
    public.is_course_enrolled(course_id)
);

create policy "Members and guests can view peer report votes"
on public.peer_report_votes
for select
using (
    exists (
        select 1 from public.peer_schedule_reports r
        where r.id = peer_report_votes.report_id
          and (public.is_section_member(r.section_id) or public.is_course_enrolled(r.course_id))
    )
);

-- Realtime Publications
alter publication supabase_realtime add table public.peer_schedule_reports;
alter publication supabase_realtime add table public.peer_report_votes;

-- ============================================================================
-- 4. ATOMIC RPC: cast_peer_vote
-- Enforces [-10 min, +30 min] temporal gate server-side using now().
-- Calculates quorum consensus (affirmations >= 3 and affirmations > 2 * denials).
-- Automatically creates a schedule_override cancellation when quorum is met.
-- ============================================================================
create or replace function public.cast_peer_vote(
    p_base_schedule_id uuid,
    p_report_date date,
    p_vote text -- 'affirm' or 'deny'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_sched record;
    v_session_start_tz timestamptz;
    v_window_start timestamptz;
    v_window_end timestamptz;
    v_report record;
    v_affirms integer;
    v_denials integer;
    v_new_status text;
    v_override_id uuid;
begin
    -- 1. Authenticate caller
    v_user_id := public.current_user_id();
    if v_user_id is null or v_user_id = '' then
        raise exception 'Authentication required to cast peer votes.';
    end if;

    if p_vote not in ('affirm', 'deny') then
        raise exception 'Invalid vote type. Must be affirm or deny.';
    end if;

    -- 2. Fetch Base Schedule & Section details
    select 
        bs.id,
        bs.section_id,
        bs.course_id,
        bs.start_time,
        bs.end_time,
        s.timezone
    into v_sched
    from public.base_schedule bs
    join public.sections s on s.id = bs.section_id
    where bs.id = p_base_schedule_id;

    if not found then
        raise exception 'Target class schedule block not found.';
    end if;

    -- 3. Verify user membership in cohort section or course
    if not (public.is_section_member(v_sched.section_id) or public.is_course_enrolled(v_sched.course_id)) then
        raise exception 'You must be enrolled in this cohort or course to submit or vote on peer reports.';
    end if;

    -- 4. Enforce Server-Side Temporal Gate: [-10 min, +30 min] of class start
    v_session_start_tz := (p_report_date || ' ' || v_sched.start_time)::timestamp AT TIME ZONE coalesce(v_sched.timezone, 'UTC');
    v_window_start := v_session_start_tz - interval '10 minutes';
    v_window_end   := v_session_start_tz + interval '30 minutes';

    if now() < v_window_start then
        raise exception 'Peer voting window has not opened yet. Reports open 10 minutes prior to class start.';
    end if;

    if now() > v_window_end then
        raise exception 'Peer voting window has expired for this class session.';
    end if;

    -- 5. Find or Create Report Entity (1 pooled entity per block on report_date)
    insert into public.peer_schedule_reports (
        base_schedule_id,
        report_date,
        section_id,
        course_id,
        status,
        created_by
    ) values (
        p_base_schedule_id,
        p_report_date,
        v_sched.section_id,
        v_sched.course_id,
        'pending',
        v_user_id
    )
    on conflict (base_schedule_id, report_date)
    do update set updated_at = now()
    returning * into v_report;

    -- 6. Check report status: if vetoed by CR, do not permit additional votes
    if v_report.status = 'vetoed' then
        raise exception 'This report was vetoed by a Class Representative and cannot receive further votes.';
    end if;

    -- 7. Upsert User Vote
    insert into public.peer_report_votes (
        report_id,
        user_id,
        vote
    ) values (
        v_report.id,
        v_user_id,
        p_vote
    )
    on conflict (report_id, user_id)
    do update set 
        vote = excluded.vote,
        updated_at = now();

    -- 8. Compute updated vote counts
    select 
        count(*) filter (where vote = 'affirm'),
        count(*) filter (where vote = 'deny')
    into v_affirms, v_denials
    from public.peer_report_votes
    where report_id = v_report.id;

    v_new_status := v_report.status;
    v_override_id := v_report.override_id;

    -- 9. Quorum Consensus Evaluation (if report was pending)
    -- Rule: affirmations >= 3 AND affirmations > 2 * denials
    if v_report.status = 'pending' and v_affirms >= 3 and v_affirms > (2 * v_denials) then
        v_new_status := 'confirmed';

        -- Auto-insert cancellation override into schedule_overrides
        insert into public.schedule_overrides (
            base_schedule_id,
            course_id,
            section_id,
            override_date,
            status,
            custom_note,
            created_by
        ) values (
            p_base_schedule_id,
            v_sched.course_id,
            v_sched.section_id,
            p_report_date,
            'cancelled',
            'Peer Verified: Class cancelled by cohort quorum consensus',
            v_user_id
        )
        on conflict (base_schedule_id, override_date) where base_schedule_id is not null
        do update set 
            status = 'cancelled',
            custom_note = 'Peer Verified: Class cancelled by cohort quorum consensus',
            updated_at = now()
        returning id into v_override_id;
    end if;

    -- 10. Update Report record with new counts, status, and override reference
    update public.peer_schedule_reports
    set 
        affirmation_count = v_affirms,
        denial_count = v_denials,
        status = v_new_status,
        override_id = coalesce(v_override_id, override_id),
        updated_at = now()
    where id = v_report.id;

    return jsonb_build_object(
        'report_id', v_report.id,
        'status', v_new_status,
        'affirmation_count', v_affirms,
        'denial_count', v_denials,
        'user_vote', p_vote,
        'override_id', v_override_id
    );
end;
$$;

-- ============================================================================
-- 5. ATOMIC RPC: veto_peer_report
-- Authorizes Genesis CR or Co-Admin to overturn a peer report,
-- purging any auto-generated cancellation override from schedule_overrides.
-- ============================================================================
create or replace function public.veto_peer_report(
    p_report_id uuid,
    p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id text;
    v_report record;
begin
    -- 1. Authenticate caller
    v_user_id := public.current_user_id();
    if v_user_id is null or v_user_id = '' then
        raise exception 'Authentication required to veto reports.';
    end if;

    -- 2. Fetch report
    select * into v_report
    from public.peer_schedule_reports
    where id = p_report_id;

    if not found then
        raise exception 'Peer report not found.';
    end if;

    -- 3. Verify caller is CR / Co-Admin of the section
    if not public.is_section_admin(v_report.section_id) then
        raise exception 'Only Class Representatives or Co-Admins can veto peer reports.';
    end if;

    -- 4. If an override was auto-generated, purge it (triggering deletion tombstone)
    if v_report.override_id is not null then
        delete from public.schedule_overrides
        where id = v_report.override_id;
    end if;

    -- 5. Mark report as vetoed
    update public.peer_schedule_reports
    set 
        status = 'vetoed',
        vetoed_by = v_user_id,
        veto_reason = p_reason,
        override_id = null,
        updated_at = now()
    where id = p_report_id;

    return jsonb_build_object(
        'report_id', p_report_id,
        'status', 'vetoed',
        'vetoed_by', v_user_id,
        'reason', p_reason
    );
end;
$$;
