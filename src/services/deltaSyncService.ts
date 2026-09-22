import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/database.types';
import {
  useAppStore,
  type BaseScheduleRow,
  type ScheduleOverrideRow,
  type AcademicTaskRow,
  type AttendanceLogRow,
} from '@/store/useAppStore';
import { isWeb, runSql, transaction } from '@/lib/db/platformDb';
import { getSyncCursor, setSyncCursor } from '@/lib/db/localDatabase';
import {
  getLocalBaseSchedules,
  upsertLocalBaseSchedules,
  deleteLocalBaseSchedule,
  getLocalScheduleOverrides,
  upsertLocalScheduleOverrides,
  deleteLocalScheduleOverride,
} from '@/lib/db/scheduleRepository';
import {
  getLocalTasks,
  upsertLocalTasks,
  deleteLocalTask,
  getLocalTaskCompletions,
  getLocalAttendanceLogs,
  upsertLocalAttendanceLogs,
  deleteLocalAttendanceLog,
} from '@/lib/db/taskAttendanceRepository';

export type SyncTombstoneRow = Tables<'sync_tombstones'>;

export interface DeltaFetchResult<T> {
  data: T[];
  latestTimestamp: string | null;
  error?: Error | null;
}

/**
 * Extracts the maximum timestamp from an array of records given a timestamp field name.
 */
export function extractMaxTimestamp<T>(
  records: T[],
  timestampField: keyof T
): string | null {
  if (!records || records.length === 0) return null;

  let maxTime = 0;
  let maxIso: string | null = null;

  for (const record of records) {
    const val = record[timestampField];
    if (typeof val === 'string') {
      const time = new Date(val).getTime();
      if (!isNaN(time) && time > maxTime) {
        maxTime = time;
        maxIso = val;
      }
    }
  }

  return maxIso;
}

/**
 * Fetches base schedules modified after lastSyncedAt for the specified courses.
 */
export async function fetchScheduleDeltas(
  supabase: SupabaseClient<Database>,
  courseIds: string[],
  lastSyncedAt?: string | null
): Promise<DeltaFetchResult<BaseScheduleRow>> {
  if (!courseIds || courseIds.length === 0) {
    return { data: [], latestTimestamp: null };
  }

  try {
    let query = supabase
      .from('base_schedule')
      .select('*, course:courses(*)')
      .in('course_id', courseIds);

    if (lastSyncedAt) {
      query = query.gt('updated_at', lastSyncedAt);
    }

    const { data, error } = await query.order('updated_at', { ascending: true });

    if (error) {
      console.warn('⚠️ [deltaSyncService] Error fetching schedule deltas:', error.message);
      return { data: [], latestTimestamp: null, error: new Error(error.message) };
    }

    const records = (data as BaseScheduleRow[]) || [];
    const latestTimestamp = extractMaxTimestamp(records, 'updated_at');

    return { data: records, latestTimestamp };
  } catch (err: any) {
    console.warn('⚠️ [deltaSyncService] Network failure fetching schedule deltas:', err);
    return { data: [], latestTimestamp: null, error: err };
  }
}

/**
 * Fetches schedule overrides modified after lastSyncedAt for the specified courses.
 */
export async function fetchOverrideDeltas(
  supabase: SupabaseClient<Database>,
  courseIds: string[],
  lastSyncedAt?: string | null
): Promise<DeltaFetchResult<ScheduleOverrideRow>> {
  if (!courseIds || courseIds.length === 0) {
    return { data: [], latestTimestamp: null };
  }

  try {
    let query = supabase
      .from('schedule_overrides')
      .select('*, course:courses(*)')
      .in('course_id', courseIds);

    if (lastSyncedAt) {
      query = query.gt('updated_at', lastSyncedAt);
    }

    const { data, error } = await query.order('updated_at', { ascending: true });

    if (error) {
      console.warn('⚠️ [deltaSyncService] Error fetching override deltas:', error.message);
      return { data: [], latestTimestamp: null, error: new Error(error.message) };
    }

    const records = (data as ScheduleOverrideRow[]) || [];
    const latestTimestamp = extractMaxTimestamp(records, 'updated_at');

    return { data: records, latestTimestamp };
  } catch (err: any) {
    console.warn('⚠️ [deltaSyncService] Network failure fetching override deltas:', err);
    return { data: [], latestTimestamp: null, error: err };
  }
}

/**
 * Fetches academic tasks modified after lastSyncedAt for a section.
 */
export async function fetchTaskDeltas(
  supabase: SupabaseClient<Database>,
  sectionId?: string | null,
  lastSyncedAt?: string | null
): Promise<DeltaFetchResult<AcademicTaskRow>> {
  if (!sectionId) {
    return { data: [], latestTimestamp: null };
  }

  try {
    let query = supabase
      .from('academic_tasks')
      .select('*, course:courses(*)')
      .eq('section_id', sectionId);

    if (lastSyncedAt) {
      query = query.gt('updated_at', lastSyncedAt);
    }

    const { data, error } = await query.order('updated_at', { ascending: true });

    if (error) {
      console.warn('⚠️ [deltaSyncService] Error fetching task deltas:', error.message);
      return { data: [], latestTimestamp: null, error: new Error(error.message) };
    }

    const records = (data as AcademicTaskRow[]) || [];
    const latestTimestamp = extractMaxTimestamp(records, 'updated_at');

    return { data: records, latestTimestamp };
  } catch (err: any) {
    console.warn('⚠️ [deltaSyncService] Network failure fetching task deltas:', err);
    return { data: [], latestTimestamp: null, error: err };
  }
}

/**
 * Fetches user task completions modified/recorded after lastSyncedAt.
 */
export async function fetchTaskCompletionDeltas(
  supabase: SupabaseClient<Database>,
  userId?: string | null,
  lastSyncedAt?: string | null
): Promise<DeltaFetchResult<Tables<'user_task_completions'>>> {
  if (!userId) {
    return { data: [], latestTimestamp: null };
  }

  try {
    let query = supabase
      .from('user_task_completions')
      .select('*')
      .eq('user_id', userId);

    if (lastSyncedAt) {
      query = query.gt('completed_at', lastSyncedAt);
    }

    const { data, error } = await query.order('completed_at', { ascending: true });

    if (error) {
      console.warn('⚠️ [deltaSyncService] Error fetching task completions:', error.message);
      return { data: [], latestTimestamp: null, error: new Error(error.message) };
    }

    const records = data || [];
    const latestTimestamp = extractMaxTimestamp(records, 'completed_at');

    return { data: records, latestTimestamp };
  } catch (err: any) {
    console.warn('⚠️ [deltaSyncService] Network failure fetching task completions:', err);
    return { data: [], latestTimestamp: null, error: err };
  }
}

/**
 * Fetches attendance logs modified after lastSyncedAt for a specific student.
 */
export async function fetchAttendanceDeltas(
  supabase: SupabaseClient<Database>,
  userId?: string | null,
  courseIds?: string[],
  lastSyncedAt?: string | null
): Promise<DeltaFetchResult<AttendanceLogRow>> {
  if (!userId) {
    return { data: [], latestTimestamp: null };
  }

  try {
    let query = supabase
      .from('attendance_logs')
      .select('*, course:courses(*), schedule_block:base_schedule(*), override:schedule_overrides(*)')
      .eq('user_id', userId);

    if (courseIds && courseIds.length > 0) {
      query = query.in('course_id', courseIds);
    }

    if (lastSyncedAt) {
      query = query.gt('updated_at', lastSyncedAt);
    }

    const { data, error } = await query.order('updated_at', { ascending: true });

    if (error) {
      console.warn('⚠️ [deltaSyncService] Error fetching attendance deltas:', error.message);
      return { data: [], latestTimestamp: null, error: new Error(error.message) };
    }

    const records = (data as AttendanceLogRow[]) || [];
    const latestTimestamp = extractMaxTimestamp(records, 'updated_at');

    return { data: records, latestTimestamp };
  } catch (err: any) {
    console.warn('⚠️ [deltaSyncService] Network failure fetching attendance deltas:', err);
    return { data: [], latestTimestamp: null, error: err };
  }
}

/**
 * Fetches deletion audit tombstones for the user's entire relevant scope:
 * 1. Personal records tied to userId (task completions, attendance logs)
 * 2. Section-level records tied to sectionId (cohort tasks, schedule blocks)
 * 3. Course-level records tied to enrolled courseIds (overrides, course tasks)
 */
export async function fetchTombstones(
  supabase: SupabaseClient<Database>,
  userId?: string | null,
  sectionId?: string | null,
  courseIds: string[] = [],
  lastSyncedAt?: string | null
): Promise<DeltaFetchResult<SyncTombstoneRow>> {
  try {
    let query = supabase
      .from('sync_tombstones')
      .select('*');

    if (lastSyncedAt) {
      query = query.gt('deleted_at', lastSyncedAt);
    }

    // Build multi-scope OR condition so we query all three domain boundaries:
    const orConditions: string[] = [];

    if (userId) {
      orConditions.push(`user_id.eq.${userId}`);
    }

    if (sectionId) {
      orConditions.push(`section_id.eq.${sectionId}`);
    }

    if (courseIds && courseIds.length > 0) {
      orConditions.push(`course_id.in.(${courseIds.join(',')})`);
    }

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    }

    const { data, error } = await query.order('deleted_at', { ascending: true });

    if (error) {
      console.warn('⚠️ [deltaSyncService] Error fetching sync tombstones:', error.message);
      return { data: [], latestTimestamp: null, error: new Error(error.message) };
    }

    const records = (data as SyncTombstoneRow[]) || [];
    const latestTimestamp = extractMaxTimestamp(records, 'deleted_at');

    return { data: records, latestTimestamp };
  } catch (err: any) {
    console.warn('⚠️ [deltaSyncService] Network failure fetching tombstones:', err);
    return { data: [], latestTimestamp: null, error: err };
  }
}

// ============================================================================
// ATOMIC BATCH INGESTION & RECONCILIATION
// ============================================================================

export interface SyncContext {
  supabase: SupabaseClient<Database>;
  userId?: string | null;
  sectionId?: string | null;
  courseIds: string[];
}

export interface SyncResult {
  schedulesUpdated: number;
  overridesUpdated: number;
  tasksUpdated: number;
  attendanceUpdated: number;
  tombstonesProcessed: number;
  success: boolean;
  error?: Error | null;
}

/**
 * Executes a full high-water mark delta synchronization pass:
 * 1. Queries Supabase for entity deltas modified after local cursors.
 * 2. Prunes deleted records matching incoming sync_tombstones.
 * 3. Ingests modified records into local SQLite tables inside an atomic transaction.
 * 4. Advances sync_metadata cursor timestamps.
 * 5. Reconciles updated data into the reactive L1 Zustand store.
 */
export async function syncEntityDeltas(context: SyncContext): Promise<SyncResult> {
  const { supabase, userId, sectionId, courseIds } = context;

  try {
    // 1. Read existing cursor timestamps
    const lastSchedulesSync = getSyncCursor('base_schedule');
    const lastOverridesSync = getSyncCursor('schedule_overrides');
    const lastTasksSync = getSyncCursor('academic_tasks');
    const lastCompletionsSync = getSyncCursor('user_task_completions');
    const lastAttendanceSync = getSyncCursor('attendance_logs');
    const lastTombstonesSync = getSyncCursor('sync_tombstones');

    // 2. Concurrently fetch all modified deltas and tombstones
    const [
      schedulesRes,
      overridesRes,
      tasksRes,
      completionsRes,
      attendanceRes,
      tombstonesRes,
    ] = await Promise.all([
      fetchScheduleDeltas(supabase, courseIds, lastSchedulesSync),
      fetchOverrideDeltas(supabase, courseIds, lastOverridesSync),
      fetchTaskDeltas(supabase, sectionId, lastTasksSync),
      fetchTaskCompletionDeltas(supabase, userId, lastCompletionsSync),
      fetchAttendanceDeltas(supabase, userId, courseIds, lastAttendanceSync),
      fetchTombstones(supabase, userId, sectionId, courseIds, lastTombstonesSync),
    ]);

    // Check if any critical fetch errored
    const firstError =
      schedulesRes.error ||
      overridesRes.error ||
      tasksRes.error ||
      completionsRes.error ||
      attendanceRes.error ||
      tombstonesRes.error;

    if (firstError) {
      console.warn('⚠️ [deltaSyncService] Sync encountered errors during delta fetching:', firstError);
    }

    // 3. Atomically ingest into local SQLite (or bypass if on Web)
    if (!isWeb) {
      transaction(() => {
        // A. Process Deletion Tombstones
        if (tombstonesRes.data.length > 0) {
          for (const tombstone of tombstonesRes.data) {
            switch (tombstone.entity_type) {
              case 'base_schedule':
                deleteLocalBaseSchedule(tombstone.record_id);
                break;
              case 'schedule_override':
                deleteLocalScheduleOverride(tombstone.record_id);
                break;
              case 'academic_task':
                deleteLocalTask(tombstone.record_id);
                break;
              case 'attendance_log':
                deleteLocalAttendanceLog(tombstone.record_id);
                break;
              case 'user_task_completion':
                runSql(
                  'DELETE FROM cached_task_completions WHERE task_id = ? AND user_id = ?',
                  tombstone.record_id,
                  tombstone.user_id || userId
                );
                break;
            }
          }
        }

        // B. Upsert modified records
        if (schedulesRes.data.length > 0) {
          upsertLocalBaseSchedules(schedulesRes.data);
        }
        if (overridesRes.data.length > 0) {
          upsertLocalScheduleOverrides(overridesRes.data);
        }
        if (tasksRes.data.length > 0) {
          upsertLocalTasks(tasksRes.data);
        }
        if (completionsRes.data.length > 0) {
          for (const tc of completionsRes.data) {
            runSql(
              `INSERT INTO cached_task_completions (id, task_id, user_id, completed_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(task_id, user_id) DO UPDATE SET completed_at = excluded.completed_at`,
              tc.id,
              tc.task_id,
              tc.user_id,
              tc.completed_at
            );
          }
        }
        if (attendanceRes.data.length > 0) {
          upsertLocalAttendanceLogs(attendanceRes.data);
        }

        // C. Advance high-water mark cursors
        if (schedulesRes.latestTimestamp) {
          setSyncCursor('base_schedule', schedulesRes.latestTimestamp);
        }
        if (overridesRes.latestTimestamp) {
          setSyncCursor('schedule_overrides', overridesRes.latestTimestamp);
        }
        if (tasksRes.latestTimestamp) {
          setSyncCursor('academic_tasks', tasksRes.latestTimestamp);
        }
        if (completionsRes.latestTimestamp) {
          setSyncCursor('user_task_completions', completionsRes.latestTimestamp);
        }
        if (attendanceRes.latestTimestamp) {
          setSyncCursor('attendance_logs', attendanceRes.latestTimestamp);
        }
        if (tombstonesRes.latestTimestamp) {
          setSyncCursor('sync_tombstones', tombstonesRes.latestTimestamp);
        }
      });
    }

    // 4. Reconcile updated data into reactive Zustand store
    const store = useAppStore.getState();

    if (!isWeb) {
      const freshSchedules = getLocalBaseSchedules({ courseIds });
      const freshOverrides = getLocalScheduleOverrides({ courseIds });
      const freshTasks = getLocalTasks({
        sectionId: sectionId ?? undefined,
        courseIds,
        userId: userId ?? undefined,
      });
      const freshCompletions = userId ? getLocalTaskCompletions(userId) : [];
      const freshAttendance = userId ? getLocalAttendanceLogs({ userId, courseIds }) : [];

      store.setBaseSchedules(freshSchedules);
      store.setOverrides(freshOverrides);
      store.setTasks(freshTasks);
      store.setTaskCompletions(freshCompletions);
      store.setAttendanceLogs(freshAttendance);
    } else {
      // On Web: Fallback memory merge so QA web bundler operates without SQLite
      if (schedulesRes.data.length > 0) store.setBaseSchedules(schedulesRes.data);
      if (overridesRes.data.length > 0) store.setOverrides(overridesRes.data);
      if (tasksRes.data.length > 0) store.setTasks(tasksRes.data);
      if (completionsRes.data.length > 0) {
        store.setTaskCompletions(completionsRes.data.map((c) => c.task_id));
      }
      if (attendanceRes.data.length > 0) store.setAttendanceLogs(attendanceRes.data);
    }

    return {
      schedulesUpdated: schedulesRes.data.length,
      overridesUpdated: overridesRes.data.length,
      tasksUpdated: tasksRes.data.length,
      attendanceUpdated: attendanceRes.data.length,
      tombstonesProcessed: tombstonesRes.data.length,
      success: !firstError,
      error: firstError,
    };
  } catch (err: any) {
    console.error('❌ [deltaSyncService] Fatal sync failure in syncEntityDeltas:', err);
    return {
      schedulesUpdated: 0,
      overridesUpdated: 0,
      tasksUpdated: 0,
      attendanceUpdated: 0,
      tombstonesProcessed: 0,
      success: false,
      error: err,
    };
  }
}

