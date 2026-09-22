// ============================================================================
// ClassSync Academic Tasks Hook & Realtime Synchronization
// File: src/hooks/useAcademicTasks.ts
// Description: Manages academic tasks, personal completions, optimistic updates,
//              and real-time Supabase WebSocket sync for cohort announcements.
// ============================================================================

import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/expo';
import { useSupabase } from '@/hooks/useSupabase';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  useAppStore,
  type AcademicTaskRow,
} from '@/store/useAppStore';
import {
  upsertLocalTasks,
  deleteLocalTask,
} from '@/lib/db/taskAttendanceRepository';
import {
  groupTasksByDeadline,
  type GroupedTasks,
  type TaskType,
} from '@/lib/tasks/taskUtils';
import type { Tables } from '@/types/database.types';

export interface UpsertAcademicTaskInput {
  id?: string;
  section_id: string;
  course_id?: string | null;
  title: string;
  description?: string | null;
  task_type?: TaskType | string;
  due_datetime: string; // ISO string
  is_personal?: boolean;
}

export interface UseAcademicTasksOptions {
  enableRealtime?: boolean;
}

export function useAcademicTasks(options?: UseAcademicTasksOptions) {
  const enableRealtime = options?.enableRealtime ?? true;
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { user } = useUser();
  const { activeSection, courses, activeSectionId } = useWorkspaces();
  const isSectionAdmin =
    activeSection?.role === 'genesis_cr' || activeSection?.role === 'co_admin';

  const {
    tasks,
    taskCompletions,
    setTasks,
    upsertLocalTask,
    removeLocalTask,
    setTaskCompletions,
    toggleLocalTaskCompletion,
    activeCourses,
  } = useAppStore();

  const enrolledCourseIds = useMemo(() => {
    const list = activeCourses.length > 0 ? activeCourses : courses;
    return list.map((c) => c.id);
  }, [activeCourses, courses]);

  const queryKey = useMemo(
    () => [
      'academic_tasks',
      user?.id,
      activeSectionId,
      enrolledCourseIds.slice().sort().join(','),
    ],
    [user?.id, activeSectionId, enrolledCourseIds]
  );

  const completionsQueryKey = useMemo(
    () => ['user_task_completions', user?.id],
    [user?.id]
  );

  // 1. Fetch academic tasks (Cohort section tasks + enrolled guest course tasks + user personal tasks)
  const tasksQuery = useQuery<AcademicTaskRow[]>({
    queryKey,
    enabled: !!user?.id && (!!activeSectionId || enrolledCourseIds.length > 0),
    queryFn: async () => {
      if (!user?.id) return [];

      const taskMap = new Map<string, AcademicTaskRow>();

      // Parallel fetch:
      // A. Cohort tasks for the active section
      // B. Enrolled guest course tasks (if any)
      // C. Personal tasks created by this user
      const [sectionRes, courseRes, personalRes] = await Promise.all([
        activeSectionId
          ? supabase
              .from('academic_tasks')
              .select('*, course:courses(*)')
              .eq('section_id', activeSectionId)
              .eq('is_personal', false)
              .order('due_datetime', { ascending: true })
          : Promise.resolve({ data: null, error: null }),
        enrolledCourseIds.length > 0
          ? supabase
              .from('academic_tasks')
              .select('*, course:courses(*)')
              .in('course_id', enrolledCourseIds)
              .eq('is_personal', false)
              .order('due_datetime', { ascending: true })
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('academic_tasks')
          .select('*, course:courses(*)')
          .eq('created_by', user.id)
          .eq('is_personal', true)
          .order('due_datetime', { ascending: true }),
      ]);

      if (sectionRes.error) {
        console.error('[useAcademicTasks] Error fetching section tasks:', sectionRes.error.message);
        throw sectionRes.error;
      }
      if (courseRes.error) {
        console.error('[useAcademicTasks] Error fetching course tasks:', courseRes.error.message);
        throw courseRes.error;
      }
      if (personalRes.error) {
        console.error('[useAcademicTasks] Error fetching personal tasks:', personalRes.error.message);
        throw personalRes.error;
      }

      (sectionRes.data ?? []).forEach((row) => {
        taskMap.set(row.id, {
          ...row,
          course: row.course as Tables<'courses'> | null,
        });
      });

      (courseRes.data ?? []).forEach((row) => {
        taskMap.set(row.id, {
          ...row,
          course: row.course as Tables<'courses'> | null,
        });
      });

      (personalRes.data ?? []).forEach((row) => {
        taskMap.set(row.id, {
          ...row,
          course: row.course as Tables<'courses'> | null,
        });
      });

      return Array.from(taskMap.values());
    },
  });

  // 2. Fetch user's completion records
  const completionsQuery = useQuery<string[]>({
    queryKey: completionsQueryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_task_completions')
        .select('task_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('[useAcademicTasks] Error fetching completions:', error.message);
        throw error;
      }

      return (data ?? []).map((row) => row.task_id);
    },
  });

  // Sync server data into Zustand offline cache
  useEffect(() => {
    if (tasksQuery.data) {
      setTasks(tasksQuery.data);
    }
  }, [tasksQuery.data, setTasks]);

  useEffect(() => {
    if (completionsQuery.data) {
      setTaskCompletions(completionsQuery.data);
    }
  }, [completionsQuery.data, setTaskCompletions]);

  // 3. Realtime Supabase WebSocket Listener on academic_tasks with cleanup
  useEffect(() => {
    if (!enableRealtime) return;
    if (!activeSectionId && enrolledCourseIds.length === 0) return;

    const instanceSuffix = Math.random().toString(36).substring(2, 8);
    const channelName = `realtime_academic_tasks_${activeSectionId ?? 'user'}_${instanceSuffix}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'academic_tasks',
          ...(activeSectionId ? { filter: `section_id=eq.${activeSectionId}` } : {}),
        },
        (payload) => {
          console.log(`⚡ [Realtime] academic_tasks event [${payload.eventType}]:`, payload);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRow = payload.new as Tables<'academic_tasks'>;
            if (newRow && newRow.id) {
              const taskItem: AcademicTaskRow = {
                ...newRow,
                course: null, // Full join populated on refetch
              };
              upsertLocalTask(taskItem);
              upsertLocalTasks([taskItem]);
            }
            queryClient.invalidateQueries({ queryKey });
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string };
            if (oldRow && oldRow.id) {
              removeLocalTask(oldRow.id);
              deleteLocalTask(oldRow.id);
            }
            queryClient.invalidateQueries({ queryKey });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`📡 [Realtime] Subscribed to tasks on channel: ${channelName}`);
        }
      });

    // Cleanup subscription on unmount
    return () => {
      console.log(`🔌 [Realtime] Cleaning up tasks channel: ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [
    enableRealtime,
    activeSectionId,
    enrolledCourseIds.length,
    queryClient,
    queryKey,
    supabase,
    upsertLocalTask,
    removeLocalTask,
  ]);

  // 4. Derived Data: Completion Set & Grouped Tasks
  const completionSet = useMemo(() => new Set(taskCompletions), [taskCompletions]);

  const tasksWithCompletionState = useMemo(() => {
    return tasks.map((task) => ({
      ...task,
      is_completed: completionSet.has(task.id),
    }));
  }, [tasks, completionSet]);

  const groupedTasks: GroupedTasks = useMemo(() => {
    return groupTasksByDeadline(tasks, completionSet);
  }, [tasks, completionSet]);

  // 5. Mutations
  const upsertTaskMutation = useMutation({
    mutationFn: async (input: UpsertAcademicTaskInput) => {
      const { data, error } = await supabase.rpc('upsert_academic_task', {
        p_id: input.id ?? undefined,
        p_section_id: input.section_id,
        p_course_id: input.course_id ?? undefined,
        p_title: input.title,
        p_description: input.description ?? undefined,
        p_task_type: input.task_type ?? 'assignment',
        p_due_datetime: input.due_datetime,
        p_is_personal: input.is_personal ?? true,
      });

      if (error) {
        console.error('[useAcademicTasks] Error upserting task:', error.message);
        throw error;
      }

      return data;
    },
    onSuccess: (savedTask) => {
      if (savedTask) {
        upsertLocalTask({
          ...savedTask,
          course: null,
        });
      }
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase.rpc('delete_academic_task', {
        p_id: taskId,
      });

      if (error) {
        console.error('[useAcademicTasks] Error deleting task:', error.message);
        throw error;
      }

      return data;
    },
    onMutate: async (taskId: string) => {
      removeLocalTask(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const toggleTaskCompletionMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase.rpc('toggle_task_completion', {
        p_task_id: taskId,
      });

      if (error) {
        console.error('[useAcademicTasks] Error toggling task completion:', error.message);
        throw error;
      }

      return { taskId, isCompleted: data };
    },
    onMutate: async (taskId: string) => {
      // Instant optimistic local toggle
      toggleLocalTaskCompletion(taskId);
    },
    onError: (_error, taskId) => {
      // Revert local state on failure
      toggleLocalTaskCompletion(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: completionsQueryKey });
    },
  });

  return {
    tasks: tasksWithCompletionState,
    taskCompletions,
    completionSet,
    groupedTasks,
    isSectionAdmin,
    isLoading: tasksQuery.isLoading || completionsQuery.isLoading,
    isFetching: tasksQuery.isFetching || completionsQuery.isFetching,
    isError: tasksQuery.isError || completionsQuery.isError,
    error: tasksQuery.error || completionsQuery.error,
    refetch: () => {
      tasksQuery.refetch();
      completionsQuery.refetch();
    },
    upsertTask: upsertTaskMutation.mutateAsync,
    isUpserting: upsertTaskMutation.isPending,
    deleteTask: deleteTaskMutation.mutateAsync,
    isDeleting: deleteTaskMutation.isPending,
    toggleTaskCompletion: toggleTaskCompletionMutation.mutateAsync,
    isTogglingCompletion: toggleTaskCompletionMutation.isPending,
  };
}
