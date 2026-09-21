// ============================================================================
// ClassSync Attendance Hook & Bunk Calculator Integration
// File: src/hooks/useAttendance.ts
// Description: Manages student personal attendance logging, history queries,
//              optimistic mutations, and real-time bunk calculator metrics per course.
// ============================================================================

import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/expo';
import { useSupabase } from '@/hooks/useSupabase';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  useAppStore,
  type AttendanceLogRow,
} from '@/store/useAppStore';
import {
  calculateCourseAttendance,
  calculateAttendanceMetrics,
  simulateFutureAttendance,
  type AttendanceMetrics,
  type AttendanceStatus,
  type BunkCalculatorOptions,
} from '@/lib/attendance/bunkCalculator';
import type { Tables } from '@/types/database.types';

export interface LogAttendanceInput {
  course_id: string;
  attendance_date: string; // 'YYYY-MM-DD'
  status: AttendanceStatus;
  schedule_block_id?: string | null;
  override_id?: string | null;
  notes?: string | null;
}

export interface UseAttendanceOptions {
  courseId?: string;
  calculatorOptions?: BunkCalculatorOptions;
}

export function useAttendance(options?: UseAttendanceOptions) {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { user } = useUser();
  const { courses } = useWorkspaces();

  const {
    activeCourses,
    attendanceLogs,
    setAttendanceLogs,
    upsertLocalAttendanceLog,
    removeLocalAttendanceLog,
  } = useAppStore();

  const enrolledCourses = useMemo(() => {
    return activeCourses.length > 0 ? activeCourses : courses;
  }, [activeCourses, courses]);

  const queryKey = useMemo(
    () => ['attendance_logs', user?.id, options?.courseId ?? 'all'],
    [user?.id, options?.courseId]
  );

  // 1. Fetch attendance logs from Supabase
  const attendanceQuery = useQuery<AttendanceLogRow[]>({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('attendance_logs')
        .select(
          '*, course:courses(*), schedule_block:base_schedule(*), override:schedule_overrides(*)'
        )
        .eq('user_id', user.id)
        .order('attendance_date', { ascending: false });

      if (options?.courseId) {
        query = query.eq('course_id', options.courseId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useAttendance] Error fetching attendance logs:', error.message);
        throw error;
      }

      return (data ?? []).map((row) => ({
        ...row,
        course: row.course as Tables<'courses'> | null,
        schedule_block: row.schedule_block as Tables<'base_schedule'> | null,
        override: row.override as Tables<'schedule_overrides'> | null,
      }));
    },
  });

  // Sync server data into Zustand store
  useEffect(() => {
    if (attendanceQuery.data) {
      setAttendanceLogs(attendanceQuery.data);
    }
  }, [attendanceQuery.data, setAttendanceLogs]);

  // Filter logs for this hook's scope if courseId was specified
  const filteredLogs = useMemo(() => {
    if (!options?.courseId) return attendanceLogs;
    return attendanceLogs.filter((log) => log.course_id === options.courseId);
  }, [attendanceLogs, options?.courseId]);

  // 2. Compute course-by-course metrics using Bunk Calculator pure math engine
  const courseMetricsMap = useMemo(() => {
    const map = new Map<string, AttendanceMetrics>();

    // Group logs by course_id
    const logsByCourse = new Map<string, AttendanceLogRow[]>();
    for (const log of attendanceLogs) {
      const list = logsByCourse.get(log.course_id) ?? [];
      list.push(log);
      logsByCourse.set(log.course_id, list);
    }

    // Compute metrics for all enrolled courses (including courses with 0 logs)
    for (const course of enrolledCourses) {
      const courseLogs = logsByCourse.get(course.id) ?? [];
      map.set(
        course.id,
        calculateCourseAttendance(courseLogs, options?.calculatorOptions)
      );
    }

    return map;
  }, [attendanceLogs, enrolledCourses, options?.calculatorOptions]);

  // 3. Compute overall aggregate attendance metrics
  const overallMetrics = useMemo(() => {
    return calculateCourseAttendance(attendanceLogs, options?.calculatorOptions);
  }, [attendanceLogs, options?.calculatorOptions]);

  const getCourseMetrics = (courseId: string): AttendanceMetrics => {
    return (
      courseMetricsMap.get(courseId) ??
      calculateAttendanceMetrics(0, 0, options?.calculatorOptions)
    );
  };

  // 4. Mutations
  const logAttendanceMutation = useMutation({
    mutationFn: async (input: LogAttendanceInput) => {
      const { data, error } = await supabase.rpc('log_attendance_session', {
        p_course_id: input.course_id,
        p_date: input.attendance_date,
        p_status: input.status,
        p_schedule_block_id: input.schedule_block_id ?? undefined,
        p_override_id: input.override_id ?? undefined,
        p_notes: input.notes ?? undefined,
      });

      if (error) {
        console.error('[useAttendance] Error logging attendance:', error.message);
        throw error;
      }

      return data;
    },
    onSuccess: (savedLog) => {
      if (savedLog) {
        upsertLocalAttendanceLog({
          ...savedLog,
          course: null,
          schedule_block: null,
          override: null,
        });
      }
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { data, error } = await supabase.rpc('delete_attendance_log', {
        p_id: logId,
      });

      if (error) {
        console.error('[useAttendance] Error deleting attendance log:', error.message);
        throw error;
      }

      return data;
    },
    onMutate: async (logId: string) => {
      removeLocalAttendanceLog(logId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    logs: filteredLogs,
    allLogs: attendanceLogs,
    courseMetricsMap,
    overallMetrics,
    getCourseMetrics,
    simulateFutureAttendance,
    isLoading: attendanceQuery.isLoading,
    isFetching: attendanceQuery.isFetching,
    isError: attendanceQuery.isError,
    error: attendanceQuery.error,
    refetch: attendanceQuery.refetch,
    logAttendance: logAttendanceMutation.mutateAsync,
    isLogging: logAttendanceMutation.isPending,
    deleteAttendance: deleteAttendanceMutation.mutateAsync,
    isDeleting: deleteAttendanceMutation.isPending,
  };
}
