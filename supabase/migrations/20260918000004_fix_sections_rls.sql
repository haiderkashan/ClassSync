-- ============================================================================
-- ClassSync Section Creator SELECT Policy
-- Migration: 20260918000004_fix_sections_rls.sql
-- Description: Ensures creators can select sections they have created even before
--              roster membership insertion is fully committed.
-- ============================================================================

drop policy if exists "Creators can view their created sections" on public.sections;

create policy "Creators can view their created sections"
on public.sections for select
using (created_by = public.current_user_id());
