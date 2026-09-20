import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  useAppStore,
  type ScheduleOverrideRow,
} from '@/store/useAppStore';
import type { Tables } from '@/types/database.types';

export interface UpsertScheduleOverrideInput {
  id?: string;
  section_id: string;
  course_id: string;
  base_schedule_id?: string | null;
  override_date: string; // 'YYYY-MM-DD'
  status?: string;
  delay_minutes?: number;
  new_room?: string | null;
  custom_note?: string | null;
  is_makeup?: boolean;
  makeup_start_time?: string | null;
  makeup_end_time?: string | null;
}

/**
 * Main hook for fetching, mutating, and maintaining real-time synchronization
 * of date-specific timetable overrides and ad-hoc makeup sessions.
 *
 * Supports both cohort members (via section_id) and guest students (via activeCourses).
 * Implements strict cleanup of Supabase Realtime WebSocket channels to prevent memory leaks.
 */
export function useScheduleOverrides() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { activeSection, courses, activeSectionId } = useWorkspaces();
  const isSectionAdmin =
    activeSection?.role === 'genesis_cr' || activeSection?.role === 'co_admin';

  const {
    overrides,
    setOverrides,
    upsertLocalOverride,
    removeLocalOverride,
    activeCourses,
  } = useAppStore();

  const enrolledCourseIds = useMemo(() => {
    const list = activeCourses.length > 0 ? activeCourses : courses;
    return list.map((c) => c.id);
  }, [activeCourses, courses]);

  const queryKey = useMemo(
    () => [
      'schedule_overrides',
      activeSectionId,
      enrolledCourseIds.slice().sort().join(','),
    ],
    [activeSectionId, enrolledCourseIds]
  );

  // 1. Dual-source fetch: section cohort overrides AND enrolled guest course overrides
  const overridesQuery = useQuery<ScheduleOverrideRow[]>({
    queryKey,
    enabled: !!activeSectionId || enrolledCourseIds.length > 0,
    queryFn: async () => {
      const overrideMap = new Map<string, ScheduleOverrideRow>();

      const [sectionRes, courseRes] = await Promise.all([
        activeSectionId
          ? supabase
              .from('schedule_overrides')
              .select('*, course:courses(*)')
              .eq('section_id', activeSectionId)
              .order('override_date', { ascending: true })
          : Promise.resolve({ data: null, error: null }),
        enrolledCourseIds.length > 0
          ? supabase
              .from('schedule_overrides')
              .select('*, course:courses(*)')
              .in('course_id', enrolledCourseIds)
              .order('override_date', { ascending: true })
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (sectionRes.error) {
        console.error(
          '[useScheduleOverrides] Error fetching section overrides:',
          sectionRes.error.message
        );
        throw sectionRes.error;
      }
      if (courseRes.error) {
        console.error(
          '[useScheduleOverrides] Error fetching enrolled courses overrides:',
          courseRes.error.message
        );
        throw courseRes.error;
      }

      (sectionRes.data ?? []).forEach((row) => {
        overrideMap.set(row.id, {
          ...row,
          course: row.course as Tables<'courses'> | null,
        });
      });

      (courseRes.data ?? []).forEach((row) => {
        overrideMap.set(row.id, {
          ...row,
          course: row.course as Tables<'courses'> | null,
        });
      });

      return Array.from(overrideMap.values());
    },
  });

  // Sync server data into Zustand offline store
  useEffect(() => {
    if (overridesQuery.data) {
      setOverrides(overridesQuery.data);
    }
  }, [overridesQuery.data, setOverrides]);

  // 2. Realtime WebSocket Subscription with Strict Memory Leak Cleanup
  useEffect(() => {
    if (!activeSectionId && enrolledCourseIds.length === 0) {
      return;
    }

    const channelName = `realtime:schedule_overrides:${activeSectionId ?? 'guest'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_overrides',
          ...(activeSectionId ? { filter: `section_id=eq.${activeSectionId}` } : {}),
        },
        (payload) => {
          console.log(
            `⚡ [Realtime] schedule_overrides event [${payload.eventType}]:`,
            payload
          );

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRow = payload.new as Tables<'schedule_overrides'>;
            if (newRow && newRow.id) {
              upsertLocalOverride({
                ...newRow,
                course: null, // Joined relation will be populated upon query invalidation
              });
            }
            queryClient.invalidateQueries({ queryKey });
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string };
            if (oldRow && oldRow.id) {
              removeLocalOverride(oldRow.id);
            }
            queryClient.invalidateQueries({ queryKey });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`📡 [Realtime] Subscribed to schedule_overrides channel: ${channelName}`);
        }
      });

    // STRICT CLEANUP: Remove WebSocket channel to prevent zombie subscriptions and memory leaks
    return () => {
      console.log(`🧹 [Realtime] Removing schedule_overrides channel: ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [
    supabase,
    activeSectionId,
    enrolledCourseIds,
    queryKey,
    queryClient,
    upsertLocalOverride,
    removeLocalOverride,
  ]);

  // 3. Mutation: Upsert Schedule Override via atomic RPC
  const upsertMutation = useMutation({
    mutationFn: async (input: UpsertScheduleOverrideInput) => {
      const { data, error } = await supabase.rpc('upsert_schedule_override', {
        p_id: input.id || undefined,
        p_section_id: input.section_id,
        p_course_id: input.course_id,
        p_base_schedule_id: input.base_schedule_id || undefined,
        p_override_date: input.override_date,
        p_status: input.status ?? 'scheduled',
        p_delay_minutes: input.delay_minutes ?? 0,
        p_new_room: input.new_room ?? undefined,
        p_custom_note: input.custom_note ?? undefined,
        p_is_makeup: input.is_makeup ?? false,
        p_makeup_start_time: input.makeup_start_time ?? undefined,
        p_makeup_end_time: input.makeup_end_time ?? undefined,
      });

      if (error) {
        console.error('[useScheduleOverrides] Failed to upsert override:', error.message);
        throw error;
      }

      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 4. Mutation: Delete Schedule Override via atomic RPC
  const deleteMutation = useMutation({
    mutationFn: async (overrideId: string) => {
      const { data, error } = await supabase.rpc('delete_schedule_override', {
        p_id: overrideId,
      });

      if (error) {
        console.error('[useScheduleOverrides] Failed to delete override:', error.message);
        throw error;
      }

      return data;
    },
    onMutate: async (overrideId) => {
      removeLocalOverride(overrideId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Helper selector to filter overrides for a specific calendar date (YYYY-MM-DD)
  const getOverridesForDate = useMemo(() => {
    return (dateStr: string) => {
      return (overrides || []).filter((o) => o.override_date === dateStr);
    };
  }, [overrides]);

  return {
    overrides,
    isLoading: overridesQuery.isLoading && overrides.length === 0,
    isFetching: overridesQuery.isFetching,
    isError: overridesQuery.isError,
    error: overridesQuery.error,
    refetch: overridesQuery.refetch,
    getOverridesForDate,
    upsertOverride: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
    deleteOverride: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    isSectionAdmin,
  };
}
