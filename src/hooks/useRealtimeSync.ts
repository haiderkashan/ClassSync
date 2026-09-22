import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  useAppStore,
  type BaseScheduleRow,
  type AttendanceLogRow,
} from '@/store/useAppStore';
import {
  upsertLocalBaseSchedules,
  deleteLocalBaseSchedule,
  deleteLocalScheduleOverride,
} from '@/lib/db/scheduleRepository';
import {
  deleteLocalTask,
  upsertLocalAttendanceLogs,
  deleteLocalAttendanceLog,
} from '@/lib/db/taskAttendanceRepository';
import { runSql, isWeb } from '@/lib/db/platformDb';
import type { Tables } from '@/types/database.types';

export interface UseRealtimeSyncOptions {
  enabled?: boolean;
}

/**
 * Root-level Realtime synchronization hook:
 * Listens to Postgres CDC events on sync_tombstones, base_schedule, and attendance_logs,
 * immediately writing live modifications to local SQLite (L2) and the reactive Zustand store (L1).
 */
export function useRealtimeSync(options: UseRealtimeSyncOptions = {}) {
  const { enabled = true } = options;
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { activeSectionId } = useWorkspaces();
  const {
    removeLocalOverride,
    removeLocalTask,
    upsertLocalScheduleBlock,
    removeLocalScheduleBlock,
    upsertLocalAttendanceLog,
    removeLocalAttendanceLog,
  } = useAppStore();

  useEffect(() => {
    if (!enabled) return;

    const instanceSuffix = Math.random().toString(36).substring(2, 8);
    const channelName = `realtime_sync_engine_${activeSectionId ?? 'global'}_${instanceSuffix}`;

    const channel = supabase.channel(channelName);

    // 1. Listen for Deletion Tombstones
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'sync_tombstones',
      },
      (payload) => {
        const tombstone = payload.new as Tables<'sync_tombstones'>;
        if (!tombstone || !tombstone.record_id) return;

        console.log(`⚡ [RealtimeSync] Tombstone received for ${tombstone.entity_type}:`, tombstone.record_id);

        switch (tombstone.entity_type) {
          case 'base_schedule':
            deleteLocalBaseSchedule(tombstone.record_id);
            removeLocalScheduleBlock(tombstone.record_id);
            queryClient.invalidateQueries({ queryKey: ['base_schedule'] });
            break;
          case 'schedule_override':
            deleteLocalScheduleOverride(tombstone.record_id);
            removeLocalOverride(tombstone.record_id);
            queryClient.invalidateQueries({ queryKey: ['schedule_overrides'] });
            break;
          case 'academic_task':
            deleteLocalTask(tombstone.record_id);
            removeLocalTask(tombstone.record_id);
            queryClient.invalidateQueries({ queryKey: ['academic_tasks'] });
            break;
          case 'attendance_log':
            deleteLocalAttendanceLog(tombstone.record_id);
            removeLocalAttendanceLog(tombstone.record_id);
            queryClient.invalidateQueries({ queryKey: ['attendance_logs'] });
            break;
          case 'user_task_completion':
            if (!isWeb) {
              runSql('DELETE FROM cached_task_completions WHERE task_id = ?', tombstone.record_id);
            }
            break;
        }
      }
    );

    // 2. Listen for Base Schedule modifications
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'base_schedule',
      },
      (payload) => {
        console.log(`⚡ [RealtimeSync] base_schedule event [${payload.eventType}]:`, payload);

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const newRow = payload.new as Tables<'base_schedule'>;
          if (newRow && newRow.id) {
            const blockItem: BaseScheduleRow = {
              ...newRow,
              course: null,
            };
            upsertLocalScheduleBlock(blockItem);
            upsertLocalBaseSchedules([blockItem]);
          }
          queryClient.invalidateQueries({ queryKey: ['base_schedule'] });
        } else if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as { id?: string };
          if (oldRow && oldRow.id) {
            removeLocalScheduleBlock(oldRow.id);
            deleteLocalBaseSchedule(oldRow.id);
          }
          queryClient.invalidateQueries({ queryKey: ['base_schedule'] });
        }
      }
    );

    // 3. Listen for Attendance Log modifications
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance_logs',
      },
      (payload) => {
        console.log(`⚡ [RealtimeSync] attendance_logs event [${payload.eventType}]:`, payload);

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const newRow = payload.new as Tables<'attendance_logs'>;
          if (newRow && newRow.id) {
            const logItem: AttendanceLogRow = {
              ...newRow,
              course: null,
              schedule_block: null,
              override: null,
            };
            upsertLocalAttendanceLog(logItem);
            upsertLocalAttendanceLogs([logItem]);
          }
          queryClient.invalidateQueries({ queryKey: ['attendance_logs'] });
        } else if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as { id?: string };
          if (oldRow && oldRow.id) {
            removeLocalAttendanceLog(oldRow.id);
            deleteLocalAttendanceLog(oldRow.id);
          }
          queryClient.invalidateQueries({ queryKey: ['attendance_logs'] });
        }
      }
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`📡 [RealtimeSync] Subscribed to realtime sync channel: ${channelName}`);
      }
    });

    return () => {
      console.log(`🧹 [RealtimeSync] Cleaning up channel: ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [
    enabled,
    supabase,
    activeSectionId,
    queryClient,
    removeLocalOverride,
    removeLocalTask,
    upsertLocalScheduleBlock,
    removeLocalScheduleBlock,
    upsertLocalAttendanceLog,
    removeLocalAttendanceLog,
  ]);
}
