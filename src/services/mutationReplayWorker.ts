import NetInfo from '@react-native-community/netinfo';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  peekPendingMutations,
  markMutationProcessing,
  markMutationRetry,
  removeCompletedMutation,
  evictPoisonPillMutation,
  type OfflineMutationRecord,
} from '@/lib/db/mutationQueue';
import {
  deleteLocalBaseSchedule,
  deleteLocalScheduleOverride,
} from '@/lib/db/scheduleRepository';
import {
  deleteLocalTask,
  deleteLocalAttendanceLog,
} from '@/lib/db/taskAttendanceRepository';
import { runSql, isWeb } from '@/lib/db/platformDb';
import { useAppStore } from '@/store/useAppStore';

export interface ReplayWorkerOptions {
  batchSize?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface ReplayResult {
  processed: number;
  failed: number;
  poisonPillsEvicted: number;
  haltedOffline: boolean;
  haltedTransientError: boolean;
}

let isReplayWorkerRunning = false;

/**
 * Distinguishes between permanent poison pills (4xx, schema/RLS violations)
 * and retryable transient errors (5xx, timeouts, connection drops).
 */
export function isPoisonPillError(error: any): boolean {
  if (!error) return false;

  // 1. HTTP status code evaluation
  const status = error.status || error.statusCode;
  if (typeof status === 'number') {
    // 4xx errors (except 408 Request Timeout & 429 Rate Limit) are non-retryable poison pills
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return true;
    }
    if (status >= 500) {
      return false; // 5xx server errors are transient
    }
  }

  // 2. Postgres Error Codes
  const code = String(error.code || '');
  if (
    code.startsWith('22') || // data exception
    code.startsWith('23') || // integrity constraint violation (e.g. 23503 foreign key, 23505 unique)
    code.startsWith('42') || // syntax error or RLS access violation
    code.startsWith('PGRST1') || // PostgREST resource error
    code.startsWith('PGRST2')
  ) {
    return true;
  }

  // 3. Error Message string analysis
  const message = String(error.message || '').toLowerCase();
  if (
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('violates foreign key') ||
    message.includes('violates not-null') ||
    message.includes('invalid input syntax')
  ) {
    return true;
  }

  return false;
}

/**
 * Computes exponential backoff delay based on retry count.
 * Formula: min(baseBackoffMs * 2^(retry_count), maxBackoffMs)
 */
export function computeBackoffDelay(
  retryCount: number,
  baseMs = 2000,
  maxMs = 60000
): number {
  const exponential = baseMs * Math.pow(2, retryCount);
  return Math.min(exponential, maxMs);
}

/**
 * Reverts optimistic local state when a mutation turns out to be a permanent poison pill.
 */
function rollbackOptimisticState(mutation: OfflineMutationRecord): void {
  const { entity_type, operation, payload } = mutation;
  const store = useAppStore.getState();

  try {
    if (operation === 'INSERT' || operation === 'UPDATE') {
      switch (entity_type) {
        case 'attendance_log':
          if (payload?.id) {
            deleteLocalAttendanceLog(payload.id);
            store.removeLocalAttendanceLog(payload.id);
          }
          break;
        case 'academic_task':
          if (payload?.id) {
            deleteLocalTask(payload.id);
            store.removeLocalTask(payload.id);
          }
          break;
        case 'user_task_completion':
          if (payload?.task_id && payload?.user_id) {
            if (!isWeb) {
              runSql(
                'DELETE FROM cached_task_completions WHERE task_id = ? AND user_id = ?',
                payload.task_id,
                payload.user_id
              );
            }
            store.toggleLocalTaskCompletion(payload.task_id);
          }
          break;
        case 'schedule_override':
          if (payload?.id) {
            deleteLocalScheduleOverride(payload.id);
            store.removeLocalOverride(payload.id);
          }
          break;
        case 'base_schedule':
          if (payload?.id) {
            deleteLocalBaseSchedule(payload.id);
            store.removeLocalScheduleBlock(payload.id);
          }
          break;
      }
    }
  } catch (rollbackErr) {
    console.warn(`⚠️ [ReplayWorker] Rollback failed for ${entity_type}:`, rollbackErr);
  }
}

/**
 * Dispatches a single mutation to the Supabase server, preserving offline-generated UUIDs.
 */
async function executeRemoteMutation(
  supabase: SupabaseClient<Database>,
  mutation: OfflineMutationRecord
): Promise<{ error: any }> {
  const { entity_type, operation, payload } = mutation;

  switch (entity_type) {
    case 'attendance_log': {
      if (operation === 'INSERT' || operation === 'UPDATE') {
        const { error } = await supabase.from('attendance_logs').upsert({
          id: payload.id,
          course_id: payload.course_id,
          user_id: payload.user_id,
          schedule_block_id: payload.schedule_block_id || null,
          override_id: payload.override_id || null,
          attendance_date: payload.attendance_date,
          status: payload.status || 'present',
          notes: payload.notes || null,
          updated_at: payload.updated_at || new Date().toISOString(),
        });
        return { error };
      } else if (operation === 'DELETE') {
        const { error } = await supabase
          .from('attendance_logs')
          .delete()
          .eq('id', payload.id);
        return { error };
      }
      break;
    }

    case 'academic_task': {
      if (operation === 'INSERT' || operation === 'UPDATE') {
        const { error } = await supabase.from('academic_tasks').upsert({
          id: payload.id,
          section_id: payload.section_id,
          course_id: payload.course_id || null,
          title: payload.title,
          description: payload.description || null,
          task_type: payload.task_type || 'assignment',
          due_datetime: payload.due_datetime,
          is_personal: !!payload.is_personal,
          created_by: payload.created_by,
          updated_at: payload.updated_at || new Date().toISOString(),
        });
        return { error };
      } else if (operation === 'DELETE') {
        const { error } = await supabase
          .from('academic_tasks')
          .delete()
          .eq('id', payload.id);
        return { error };
      }
      break;
    }

    case 'user_task_completion': {
      if (operation === 'INSERT' || operation === 'UPDATE') {
        const { error } = await supabase.from('user_task_completions').upsert({
          id: payload.id,
          task_id: payload.task_id,
          user_id: payload.user_id,
          completed_at: payload.completed_at || new Date().toISOString(),
        });
        return { error };
      } else if (operation === 'DELETE') {
        const { error } = await supabase
          .from('user_task_completions')
          .delete()
          .match({ task_id: payload.task_id, user_id: payload.user_id });
        return { error };
      }
      break;
    }

    case 'schedule_override': {
      if (operation === 'INSERT' || operation === 'UPDATE') {
        const { error } = await supabase.from('schedule_overrides').upsert({
          id: payload.id,
          base_schedule_id: payload.base_schedule_id || null,
          course_id: payload.course_id,
          section_id: payload.section_id || null,
          override_date: payload.override_date,
          status: payload.status || 'scheduled',
          delay_minutes: payload.delay_minutes ?? 0,
          new_room: payload.new_room || null,
          custom_note: payload.custom_note || null,
          is_makeup: !!payload.is_makeup,
          makeup_start_time: payload.makeup_start_time || null,
          makeup_end_time: payload.makeup_end_time || null,
          created_by: payload.created_by || null,
          updated_at: payload.updated_at || new Date().toISOString(),
        });
        return { error };
      } else if (operation === 'DELETE') {
        const { error } = await supabase
          .from('schedule_overrides')
          .delete()
          .eq('id', payload.id);
        return { error };
      }
      break;
    }

    case 'base_schedule': {
      if (operation === 'INSERT' || operation === 'UPDATE') {
        const { error } = await supabase.from('base_schedule').upsert({
          id: payload.id,
          course_id: payload.course_id,
          day_of_week: payload.day_of_week,
          start_time: payload.start_time,
          end_time: payload.end_time,
          room: payload.room || null,
          session_type: payload.session_type || 'lecture',
          frequency: payload.frequency || 'weekly',
          instructor: payload.instructor || null,
          color_override: payload.color_override || null,
          updated_at: payload.updated_at || new Date().toISOString(),
        });
        return { error };
      } else if (operation === 'DELETE') {
        const { error } = await supabase
          .from('base_schedule')
          .delete()
          .eq('id', payload.id);
        return { error };
      }
      break;
    }
  }

  return { error: new Error(`Unsupported entity_type: ${entity_type}`) };
}

/**
 * NETWORK-AWARE IDEMPOTENT REPLAY WORKER:
 * Drains the SQLite offline_mutations queue in strict FIFO order.
 * 
 * CRITICAL BATTERY SAVER:
 * Verifies NetInfo.isConnected === true before making any network calls.
 * If offline, halts immediately with 0 battery consumption.
 */
export async function replayOfflineMutations(
  supabase: SupabaseClient<Database>,
  options: ReplayWorkerOptions = {}
): Promise<ReplayResult> {
  const {
    batchSize = 25,
    maxRetries = 5,
    baseBackoffMs = 2000,
    maxBackoffMs = 60000,
  } = options;

  // 1. Concurrency Mutex Barrier
  if (isReplayWorkerRunning) {
    console.log('⚡ [ReplayWorker] Replay worker is already actively processing. Skipping duplicate trigger.');
    return {
      processed: 0,
      failed: 0,
      poisonPillsEvicted: 0,
      haltedOffline: false,
      haltedTransientError: false,
    };
  }

  // 2. CRITICAL BATTERY CHECK: NetInfo Connectivity
  const netState = await NetInfo.fetch();
  if (netState.isConnected === false) {
    console.log('⏸️ [ReplayWorker] Device is offline. Halting replay worker immediately to conserve battery.');
    return {
      processed: 0,
      failed: 0,
      poisonPillsEvicted: 0,
      haltedOffline: true,
      haltedTransientError: false,
    };
  }

  isReplayWorkerRunning = true;

  let processedCount = 0;
  let failedCount = 0;
  let poisonPillsEvictedCount = 0;
  let haltedTransient = false;

  try {
    const pendingMutations = peekPendingMutations(batchSize);

    if (pendingMutations.length === 0) {
      return {
        processed: 0,
        failed: 0,
        poisonPillsEvicted: 0,
        haltedOffline: false,
        haltedTransientError: false,
      };
    }

    console.log(`🚀 [ReplayWorker] Starting FIFO replay for ${pendingMutations.length} pending mutations.`);

    for (const mutation of pendingMutations) {
      // Re-verify network before each network request to prevent hanging on dropped connections
      const currentNetState = await NetInfo.fetch();
      if (currentNetState.isConnected === false) {
        console.log('⏸️ [ReplayWorker] Network dropped during replay loop. Halting worker.');
        return {
          processed: processedCount,
          failed: failedCount,
          poisonPillsEvicted: poisonPillsEvictedCount,
          haltedOffline: true,
          haltedTransientError: false,
        };
      }

      markMutationProcessing(mutation.id);

      try {
        const { error } = await executeRemoteMutation(supabase, mutation);

        if (!error) {
          // Success: Remove from queue and proceed
          removeCompletedMutation(mutation.id);
          processedCount++;
          console.log(`✅ [ReplayWorker] Successfully replayed ${mutation.entity_type} [${mutation.operation}] id=${mutation.id}`);
        } else {
          // Failure: Classify error
          failedCount++;

          if (isPoisonPillError(error)) {
            // POISON PILL: Permanent 4xx or constraint violation
            console.warn(`🛑 [ReplayWorker] Poison pill detected for mutation ${mutation.id}:`, error.message);
            rollbackOptimisticState(mutation);
            evictPoisonPillMutation(mutation.id, error.message);
            poisonPillsEvictedCount++;
          } else {
            // TRANSIENT ERROR: 5xx, network timeout, connection reset
            const backoff = computeBackoffDelay(mutation.retry_count, baseBackoffMs, maxBackoffMs);
            console.warn(
              `⚠️ [ReplayWorker] Transient error for mutation ${mutation.id}. Backing off for ${backoff}ms (Retry #${mutation.retry_count + 1}):`,
              error.message
            );

            if (mutation.retry_count >= maxRetries) {
              console.error(`❌ [ReplayWorker] Max retries (${maxRetries}) exceeded for mutation ${mutation.id}. Evicting.`);
              rollbackOptimisticState(mutation);
              evictPoisonPillMutation(mutation.id, `Max retries exceeded: ${error.message}`);
              poisonPillsEvictedCount++;
            } else {
              markMutationRetry(mutation.id, mutation.retry_count);
              // Halt processing subsequent FIFO mutations to preserve dependent ordering
              haltedTransient = true;
              break;
            }
          }
        }
      } catch (mutationErr: any) {
        failedCount++;
        console.warn(`⚠️ [ReplayWorker] Exception while replaying mutation ${mutation.id}:`, mutationErr);

        if (isPoisonPillError(mutationErr)) {
          rollbackOptimisticState(mutation);
          evictPoisonPillMutation(mutation.id, mutationErr.message);
          poisonPillsEvictedCount++;
        } else {
          markMutationRetry(mutation.id, mutation.retry_count);
          haltedTransient = true;
          break;
        }
      }
    }

    return {
      processed: processedCount,
      failed: failedCount,
      poisonPillsEvicted: poisonPillsEvictedCount,
      haltedOffline: false,
      haltedTransientError: haltedTransient,
    };
  } finally {
    isReplayWorkerRunning = false;
  }
}
