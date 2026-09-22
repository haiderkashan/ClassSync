import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/database.types';
import type {
  BaseScheduleRow,
  ScheduleOverrideRow,
  AcademicTaskRow,
  AttendanceLogRow,
} from '@/store/useAppStore';

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
