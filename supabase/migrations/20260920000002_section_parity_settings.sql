-- ============================================================================
-- ClassSync Section Parity & Cycle Mode Settings Migration
-- Migration: 20260920000002_section_parity_settings.sql
-- Description: Ensures cycle_mode and week_a_anchor_date columns on sections,
--              and provides the atomic update_section_cycle_settings RPC.
-- ============================================================================

-- Ensure columns exist on public.sections
alter table public.sections 
add column if not exists cycle_mode text not null default 'standard_weekly';

alter table public.sections 
add column if not exists week_a_anchor_date date;

-- Add or update cycle_mode constraint
alter table public.sections 
drop constraint if exists sections_cycle_mode_check;

alter table public.sections 
add constraint sections_cycle_mode_check 
check (cycle_mode in ('standard_weekly', 'alternating_ab'));

-- Atomic Update Section Cycle Settings RPC
create or replace function public.update_section_cycle_settings(
  p_section_id uuid,
  p_cycle_mode text,
  p_week_a_anchor_date date default null
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

  if p_cycle_mode = 'alternating_ab' and p_week_a_anchor_date is null then
    raise exception 'Week A anchor date is required for alternating cycles';
  end if;

  update public.sections
  set
    cycle_mode = p_cycle_mode,
    week_a_anchor_date = case when p_cycle_mode = 'alternating_ab' then p_week_a_anchor_date else null end,
    updated_at = timezone('utc'::text, now())
  where id = p_section_id;

  return true;
end;
$$;
