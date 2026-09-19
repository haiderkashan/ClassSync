import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  useAppStore,
  type BaseScheduleRow,
  type CourseRow,
  type WeekParity,
} from '@/store/useAppStore';
import type { Tables } from '@/types/database.types';

export interface UpsertScheduleBlockInput {
  id?: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room?: string | null;
  session_type?: string;
  frequency?: string;
  instructor?: string | null;
  color_override?: string | null;
}

export interface CloneDayInput {
  source_day: number;
  target_day: number;
  override_existing?: boolean;
}

/**
 * Main hook for fetching, mutating, and optimistically synchronizing the base timetable.
 */
export function useBaseSchedule() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { activeSection, courses, activeSectionId } = useWorkspaces();
  const isSectionAdmin =
    activeSection?.role === 'genesis_cr' || activeSection?.role === 'co_admin';

  const {
    baseSchedules,
    setBaseSchedules,
    upsertLocalScheduleBlock,
    removeLocalScheduleBlock,
    currentParity,
    setCurrentParity,
    activeCourses,
  } = useAppStore();

  const enrolledCourseIds = useMemo(() => {
    const list = activeCourses.length > 0 ? activeCourses : courses;
    return list.map((c) => c.id);
  }, [activeCourses, courses]);

  const queryKey = useMemo(
    () => ['base_schedule', activeSectionId, enrolledCourseIds.slice().sort().join(',')],
    [activeSectionId, enrolledCourseIds]
  );

  // 1. Fetch recurring timetable for active cohort and/or standalone guest courses
  const scheduleQuery = useQuery<BaseScheduleRow[]>({
    queryKey,
    enabled: !!activeSectionId || enrolledCourseIds.length > 0,
    queryFn: async () => {
      const blockMap = new Map<string, BaseScheduleRow>();

      // Execute section query and guest courses query concurrently
      const [sectionRes, courseRes] = await Promise.all([
        activeSectionId
          ? supabase
              .from('base_schedule')
              .select('*, course:courses!inner(*)')
              .eq('course.section_id', activeSectionId)
              .order('day_of_week', { ascending: true })
              .order('start_time', { ascending: true })
          : Promise.resolve({ data: null, error: null }),
        enrolledCourseIds.length > 0
          ? supabase
              .from('base_schedule')
              .select('*, course:courses!inner(*)')
              .in('course_id', enrolledCourseIds)
              .order('day_of_week', { ascending: true })
              .order('start_time', { ascending: true })
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (sectionRes.error) {
        console.error('[useBaseSchedule] Error fetching section schedule:', sectionRes.error.message);
        throw sectionRes.error;
      }
      if (courseRes.error) {
        console.error('[useBaseSchedule] Error fetching enrolled courses schedule:', courseRes.error.message);
        throw courseRes.error;
      }

      (sectionRes.data ?? []).forEach((row) => {
        blockMap.set(row.id, {
          ...row,
          course: row.course as Tables<'courses'>,
        });
      });

      (courseRes.data ?? []).forEach((row) => {
        blockMap.set(row.id, {
          ...row,
          course: row.course as Tables<'courses'>,
        });
      });

      const rows = Array.from(blockMap.values()).sort(
        (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
      );

      return rows;
    },
  });

  // Sync server data into Zustand store when query resolves
  useEffect(() => {
    if (scheduleQuery.data) {
      setBaseSchedules(scheduleQuery.data);
    }
  }, [scheduleQuery.data, setBaseSchedules]);

  // 2. Optimistic mutation for upserting schedule blocks
  const upsertMutation = useMutation({
    mutationFn: async (input: UpsertScheduleBlockInput) => {
      const { data, error } = await supabase.rpc('upsert_base_schedule_block', {
        p_id: input.id || undefined,
        p_course_id: input.course_id,
        p_day_of_week: input.day_of_week,
        p_start_time: input.start_time,
        p_end_time: input.end_time,
        p_room: input.room ?? undefined,
        p_session_type: input.session_type ?? 'lecture',
        p_frequency: input.frequency ?? 'weekly',
        p_instructor: input.instructor ?? undefined,
        p_color_override: input.color_override ?? undefined,
      });

      if (error) {
        console.error('[useBaseSchedule] Error upserting block:', error.message);
        throw error;
      }

      return data as string;
    },
    onMutate: async (newBlock) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey });

      const previousQueryData = queryClient.getQueryData<BaseScheduleRow[]>(queryKey) ?? [];
      const previousStoreData = baseSchedules;

      const associatedCourse = courses.find((c: CourseRow) => c.id === newBlock.course_id) ?? null;
      const targetId = newBlock.id || `temp-${Date.now()}`;

      const optimisticBlock: BaseScheduleRow = {
        id: targetId,
        course_id: newBlock.course_id,
        day_of_week: newBlock.day_of_week,
        start_time: newBlock.start_time,
        end_time: newBlock.end_time,
        room: newBlock.room ?? null,
        session_type: newBlock.session_type ?? 'lecture',
        frequency: newBlock.frequency ?? 'weekly',
        instructor: newBlock.instructor ?? null,
        color_override: newBlock.color_override ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        course: associatedCourse,
      };

      // Optimistic update to Zustand store
      upsertLocalScheduleBlock(optimisticBlock);

      // Optimistic update to React Query cache
      queryClient.setQueryData<BaseScheduleRow[]>(queryKey, (old = []) => {
        const index = old.findIndex((b) => b.id === targetId);
        if (index >= 0) {
          const next = [...old];
          next[index] = optimisticBlock;
          return next;
        }
        return [...old, optimisticBlock].sort(
          (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
        );
      });

      return { previousQueryData, previousStoreData };
    },
    onError: (err, newBlock, context) => {
      // Rollback to previous state on failure
      if (context?.previousQueryData) {
        queryClient.setQueryData(queryKey, context.previousQueryData);
      }
      if (context?.previousStoreData) {
        setBaseSchedules(context.previousStoreData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 3. Optimistic mutation for deleting schedule blocks
  const deleteMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const { data, error } = await supabase.rpc('delete_base_schedule_block', {
        p_block_id: blockId,
      });

      if (error) {
        console.error('[useBaseSchedule] Error deleting block:', error.message);
        throw error;
      }

      return data;
    },
    onMutate: async (blockId) => {
      await queryClient.cancelQueries({ queryKey });

      const previousQueryData = queryClient.getQueryData<BaseScheduleRow[]>(queryKey) ?? [];
      const previousStoreData = baseSchedules;

      // Optimistically remove from Zustand and React Query
      removeLocalScheduleBlock(blockId);
      queryClient.setQueryData<BaseScheduleRow[]>(queryKey, (old = []) =>
        old.filter((b) => b.id !== blockId)
      );

      return { previousQueryData, previousStoreData };
    },
    onError: (err, blockId, context) => {
      if (context?.previousQueryData) {
        queryClient.setQueryData(queryKey, context.previousQueryData);
      }
      if (context?.previousStoreData) {
        setBaseSchedules(context.previousStoreData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 4. Mutation for cloning an entire day's schedule
  const cloneDayMutation = useMutation({
    mutationFn: async (input: CloneDayInput) => {
      if (!activeSectionId) {
        throw new Error('No active section selected');
      }

      const { data, error } = await supabase.rpc('clone_day_schedule', {
        p_section_id: activeSectionId,
        p_source_day: input.source_day,
        p_target_day: input.target_day,
        p_override_existing: input.override_existing ?? false,
      });

      if (error) {
        console.error('[useBaseSchedule] Error cloning day:', error.message);
        throw error;
      }

      return data as number;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Helper selector to filter blocks for a specific day of the week, respecting week parity
  const getBlocksForDay = useMemo(() => {
    return (dayOfWeek: number, parityOverride?: WeekParity) => {
      const activeParity = parityOverride ?? currentParity;
      return (baseSchedules || [])
        .filter((block) => {
          if (block.day_of_week !== dayOfWeek) return false;

          // Strictly filter alternating week classes
          if (activeParity === 'biweekly_week_a') {
            return block.frequency !== 'biweekly_week_b';
          }
          if (activeParity === 'biweekly_week_b') {
            return block.frequency !== 'biweekly_week_a';
          }
          // 'weekly' mode returns all classes
          return true;
        })
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    };
  }, [baseSchedules, currentParity]);

  return {
    schedules: baseSchedules,
    currentParity,
    setCurrentParity,
    isLoading: scheduleQuery.isLoading && baseSchedules.length === 0,
    isFetching: scheduleQuery.isFetching,
    isError: scheduleQuery.isError,
    error: scheduleQuery.error,
    refetch: scheduleQuery.refetch,
    getBlocksForDay,
    upsertBlock: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
    deleteBlock: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    cloneDay: cloneDayMutation.mutateAsync,
    isCloning: cloneDayMutation.isPending,
    activeSection,
    isSectionAdmin,
  };
}
