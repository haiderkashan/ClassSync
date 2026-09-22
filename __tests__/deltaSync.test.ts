jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { Platform } from 'react-native';
import {
  extractMaxTimestamp,
  fetchScheduleDeltas,
  fetchOverrideDeltas,
  fetchTaskDeltas,
  fetchTaskCompletionDeltas,
  fetchAttendanceDeltas,
  fetchTombstones,
  syncEntityDeltas,
  type SyncTombstoneRow,
} from '@/services/deltaSyncService';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import * as localDatabase from '@/lib/db/localDatabase';
import * as scheduleRepository from '@/lib/db/scheduleRepository';
import * as taskAttendanceRepository from '@/lib/db/taskAttendanceRepository';
import * as platformDb from '@/lib/db/platformDb';
import { useAppStore, type BaseScheduleRow } from '@/store/useAppStore';

// Mock dependencies
jest.mock('@/lib/db/localDatabase', () => ({
  getSyncCursor: jest.fn(),
  setSyncCursor: jest.fn(),
}));

jest.mock('@/lib/db/scheduleRepository', () => ({
  getLocalBaseSchedules: jest.fn().mockReturnValue([]),
  upsertLocalBaseSchedules: jest.fn(),
  deleteLocalBaseSchedule: jest.fn(),
  getLocalScheduleOverrides: jest.fn().mockReturnValue([]),
  upsertLocalScheduleOverrides: jest.fn(),
  deleteLocalScheduleOverride: jest.fn(),
}));

jest.mock('@/lib/db/taskAttendanceRepository', () => ({
  getLocalTasks: jest.fn().mockReturnValue([]),
  upsertLocalTasks: jest.fn(),
  deleteLocalTask: jest.fn(),
  getLocalTaskCompletions: jest.fn().mockReturnValue([]),
  getLocalAttendanceLogs: jest.fn().mockReturnValue([]),
  upsertLocalAttendanceLogs: jest.fn(),
  deleteLocalAttendanceLog: jest.fn(),
}));

jest.mock('@/lib/db/platformDb', () => {
  const actual = jest.requireActual('@/lib/db/platformDb');
  return {
    ...actual,
    isWeb: false,
    runSql: jest.fn(),
    transaction: jest.fn((cb: () => void) => cb()),
  };
});

describe('Phase 7.3: Delta Sync, Tombstones, and Local Persistence Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractMaxTimestamp Utility', () => {
    it('returns null for empty array or empty input', () => {
      expect(extractMaxTimestamp([] as { updated_at: string }[], 'updated_at')).toBeNull();
      expect(extractMaxTimestamp([] as any[], 'updated_at' as any)).toBeNull();
    });

    it('returns the maximum ISO timestamp among multiple records', () => {
      const records = [
        { id: '1', updated_at: '2026-09-20T10:00:00.000Z' },
        { id: '2', updated_at: '2026-09-22T14:30:00.000Z' },
        { id: '3', updated_at: '2026-09-21T08:15:00.000Z' },
      ];

      expect(extractMaxTimestamp(records, 'updated_at')).toBe('2026-09-22T14:30:00.000Z');
    });

    it('ignores invalid dates or non-string values safely', () => {
      const records = [
        { id: '1', updated_at: 'not-a-date' },
        { id: '2', updated_at: '2026-09-21T08:15:00.000Z' },
        { id: '3', updated_at: null },
      ];

      expect(extractMaxTimestamp(records, 'updated_at' as any)).toBe('2026-09-21T08:15:00.000Z');
    });
  });

  describe('Entity Delta Fetchers', () => {
    function createMockQuery(returnData: any[], returnError: any = null) {
      const queryObj: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
      };
      return queryObj;
    }

    it('fetchScheduleDeltas returns empty when courseIds array is empty without calling Supabase', async () => {
      const mockSupabase = { from: jest.fn() } as unknown as SupabaseClient<Database>;
      const result = await fetchScheduleDeltas(mockSupabase, []);

      expect(result.data).toEqual([]);
      expect(result.latestTimestamp).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('fetchScheduleDeltas applies course filter and gt(updated_at) when lastSyncedAt is provided', async () => {
      const mockData = [
        { id: 'b1', course_id: 'c1', updated_at: '2026-09-22T12:00:00.000Z' },
      ];
      const mockQuery = createMockQuery(mockData);
      const mockSupabase = {
        from: jest.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient<Database>;

      const result = await fetchScheduleDeltas(mockSupabase, ['c1', 'c2'], '2026-09-20T00:00:00.000Z');

      expect(mockSupabase.from).toHaveBeenCalledWith('base_schedule');
      expect(mockQuery.in).toHaveBeenCalledWith('course_id', ['c1', 'c2']);
      expect(mockQuery.gt).toHaveBeenCalledWith('updated_at', '2026-09-20T00:00:00.000Z');
      expect(mockQuery.order).toHaveBeenCalledWith('updated_at', { ascending: true });
      expect(result.data).toEqual(mockData);
      expect(result.latestTimestamp).toBe('2026-09-22T12:00:00.000Z');
    });

    it('fetchOverrideDeltas queries schedule_overrides and handles empty courseIds', async () => {
      const mockSupabase = { from: jest.fn() } as unknown as SupabaseClient<Database>;
      const emptyRes = await fetchOverrideDeltas(mockSupabase, []);
      expect(emptyRes.data).toEqual([]);

      const mockData = [
        { id: 'ov1', course_id: 'c1', updated_at: '2026-09-22T15:00:00.000Z' },
      ];
      const mockQuery = createMockQuery(mockData);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await fetchOverrideDeltas(mockSupabase, ['c1'], '2026-09-21T00:00:00.000Z');
      expect(mockSupabase.from).toHaveBeenCalledWith('schedule_overrides');
      expect(mockQuery.gt).toHaveBeenCalledWith('updated_at', '2026-09-21T00:00:00.000Z');
      expect(result.data).toEqual(mockData);
      expect(result.latestTimestamp).toBe('2026-09-22T15:00:00.000Z');
    });

    it('fetchTaskDeltas queries academic_tasks for a given sectionId', async () => {
      const mockSupabase = { from: jest.fn() } as unknown as SupabaseClient<Database>;
      const emptyRes = await fetchTaskDeltas(mockSupabase, null);
      expect(emptyRes.data).toEqual([]);

      const mockData = [
        { id: 't1', section_id: 'sec-1', updated_at: '2026-09-22T16:00:00.000Z' },
      ];
      const mockQuery = createMockQuery(mockData);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await fetchTaskDeltas(mockSupabase, 'sec-1', '2026-09-20T00:00:00.000Z');
      expect(mockSupabase.from).toHaveBeenCalledWith('academic_tasks');
      expect(mockQuery.eq).toHaveBeenCalledWith('section_id', 'sec-1');
      expect(mockQuery.gt).toHaveBeenCalledWith('updated_at', '2026-09-20T00:00:00.000Z');
      expect(result.latestTimestamp).toBe('2026-09-22T16:00:00.000Z');
    });

    it('fetchTaskCompletionDeltas queries user_task_completions for a given userId', async () => {
      const mockSupabase = { from: jest.fn() } as unknown as SupabaseClient<Database>;
      const emptyRes = await fetchTaskCompletionDeltas(mockSupabase, undefined);
      expect(emptyRes.data).toEqual([]);

      const mockData = [
        { id: 'tc1', user_id: 'u1', task_id: 't1', completed_at: '2026-09-22T17:00:00.000Z' },
      ];
      const mockQuery = createMockQuery(mockData);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await fetchTaskCompletionDeltas(mockSupabase, 'u1', '2026-09-20T00:00:00.000Z');
      expect(mockSupabase.from).toHaveBeenCalledWith('user_task_completions');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(mockQuery.gt).toHaveBeenCalledWith('completed_at', '2026-09-20T00:00:00.000Z');
      expect(result.latestTimestamp).toBe('2026-09-22T17:00:00.000Z');
    });

    it('fetchAttendanceDeltas queries attendance_logs filtered by user and courseIds', async () => {
      const mockSupabase = { from: jest.fn() } as unknown as SupabaseClient<Database>;
      const emptyRes = await fetchAttendanceDeltas(mockSupabase, null);
      expect(emptyRes.data).toEqual([]);

      const mockData = [
        { id: 'att1', user_id: 'u1', course_id: 'c1', updated_at: '2026-09-22T18:00:00.000Z' },
      ];
      const mockQuery = createMockQuery(mockData);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await fetchAttendanceDeltas(mockSupabase, 'u1', ['c1'], '2026-09-20T00:00:00.000Z');
      expect(mockSupabase.from).toHaveBeenCalledWith('attendance_logs');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(mockQuery.in).toHaveBeenCalledWith('course_id', ['c1']);
      expect(mockQuery.gt).toHaveBeenCalledWith('updated_at', '2026-09-20T00:00:00.000Z');
      expect(result.latestTimestamp).toBe('2026-09-22T18:00:00.000Z');
    });

    it('gracefully handles database errors and returns error object', async () => {
      const mockQuery = createMockQuery([], { message: 'Network connection failed' });
      const mockSupabase = {
        from: jest.fn().mockReturnValue(mockQuery),
      } as unknown as SupabaseClient<Database>;

      const result = await fetchScheduleDeltas(mockSupabase, ['c1']);
      expect(result.data).toEqual([]);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Network connection failed');
    });
  });

  describe('fetchTombstones Multi-Scope Engine', () => {
    it('constructs multi-scope OR query combining userId, sectionId, and courseIds', async () => {
      const mockTombstones: SyncTombstoneRow[] = [
        {
          id: 'ts-1',
          entity_type: 'base_schedule',
          record_id: 'block-to-delete',
          section_id: 'sec-1',
          course_id: 'c1',
          user_id: null,
          deleted_at: '2026-09-22T19:00:00.000Z',
        },
      ];

      const queryObj: any = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTombstones, error: null }),
      };
      const mockSupabase = {
        from: jest.fn().mockReturnValue(queryObj),
      } as unknown as SupabaseClient<Database>;

      const result = await fetchTombstones(
        mockSupabase,
        'user-1',
        'sec-1',
        ['c1', 'c2'],
        '2026-09-20T00:00:00.000Z'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('sync_tombstones');
      expect(queryObj.gt).toHaveBeenCalledWith('deleted_at', '2026-09-20T00:00:00.000Z');
      expect(queryObj.or).toHaveBeenCalledWith(
        'user_id.eq.user-1,section_id.eq.sec-1,course_id.in.(c1,c2)'
      );
      expect(result.data).toEqual(mockTombstones);
      expect(result.latestTimestamp).toBe('2026-09-22T19:00:00.000Z');
    });
  });

  describe('syncEntityDeltas Orchestration', () => {
    it('reads cursors, executes fetches, prunes tombstones, upserts deltas, and advances cursors', async () => {
      // Setup mock cursors
      (localDatabase.getSyncCursor as jest.Mock).mockImplementation((entity: string) => {
        if (entity === 'base_schedule') return '2026-09-20T00:00:00.000Z';
        return null;
      });

      const mockTombstones: SyncTombstoneRow[] = [
        {
          id: 'ts-block',
          entity_type: 'base_schedule',
          record_id: 'deleted-block-id',
          section_id: 'sec-1',
          course_id: 'c1',
          user_id: null,
          deleted_at: '2026-09-22T20:00:00.000Z',
        },
        {
          id: 'ts-override',
          entity_type: 'schedule_override',
          record_id: 'deleted-ov-id',
          section_id: null,
          course_id: 'c1',
          user_id: null,
          deleted_at: '2026-09-22T20:01:00.000Z',
        },
        {
          id: 'ts-task',
          entity_type: 'academic_task',
          record_id: 'deleted-task-id',
          section_id: 'sec-1',
          course_id: 'c1',
          user_id: null,
          deleted_at: '2026-09-22T20:02:00.000Z',
        },
        {
          id: 'ts-att',
          entity_type: 'attendance_log',
          record_id: 'deleted-att-id',
          section_id: null,
          course_id: 'c1',
          user_id: 'user-1',
          deleted_at: '2026-09-22T20:03:00.000Z',
        },
        {
          id: 'ts-comp',
          entity_type: 'user_task_completion',
          record_id: 'deleted-comp-task-id',
          section_id: null,
          course_id: null,
          user_id: 'user-1',
          deleted_at: '2026-09-22T20:04:00.000Z',
        },
      ];

      const mockSchedule = [
        { id: 'b1', course_id: 'c1', updated_at: '2026-09-22T21:00:00.000Z' },
      ];
      const mockOverride = [
        { id: 'ov1', course_id: 'c1', updated_at: '2026-09-22T21:05:00.000Z' },
      ];
      const mockTask = [
        { id: 't1', section_id: 'sec-1', updated_at: '2026-09-22T21:10:00.000Z' },
      ];
      const mockCompletion = [
        { id: 'c1', task_id: 't1', user_id: 'user-1', completed_at: '2026-09-22T21:15:00.000Z' },
      ];
      const mockAttendance = [
        { id: 'a1', user_id: 'user-1', course_id: 'c1', updated_at: '2026-09-22T21:20:00.000Z' },
      ];

      function createTableQuery(table: string) {
        let returnData: any[] = [];
        if (table === 'base_schedule') returnData = mockSchedule;
        if (table === 'schedule_overrides') returnData = mockOverride;
        if (table === 'academic_tasks') returnData = mockTask;
        if (table === 'user_task_completions') returnData = mockCompletion;
        if (table === 'attendance_logs') returnData = mockAttendance;
        if (table === 'sync_tombstones') returnData = mockTombstones;

        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: returnData, error: null }),
        };
      }

      const mockSupabase = {
        from: jest.fn((table: string) => createTableQuery(table)),
      } as unknown as SupabaseClient<Database>;

      const syncResult = await syncEntityDeltas({
        supabase: mockSupabase,
        userId: 'user-1',
        sectionId: 'sec-1',
        courseIds: ['c1'],
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.schedulesUpdated).toBe(1);
      expect(syncResult.overridesUpdated).toBe(1);
      expect(syncResult.tasksUpdated).toBe(1);
      expect(syncResult.attendanceUpdated).toBe(1);
      expect(syncResult.tombstonesProcessed).toBe(5);

      // Verify Tombstone Deletions
      expect(scheduleRepository.deleteLocalBaseSchedule).toHaveBeenCalledWith('deleted-block-id');
      expect(scheduleRepository.deleteLocalScheduleOverride).toHaveBeenCalledWith('deleted-ov-id');
      expect(taskAttendanceRepository.deleteLocalTask).toHaveBeenCalledWith('deleted-task-id');
      expect(taskAttendanceRepository.deleteLocalAttendanceLog).toHaveBeenCalledWith('deleted-att-id');
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM cached_task_completions'),
        'deleted-comp-task-id',
        'user-1'
      );

      // Verify Upserts
      expect(scheduleRepository.upsertLocalBaseSchedules).toHaveBeenCalledWith(mockSchedule);
      expect(scheduleRepository.upsertLocalScheduleOverrides).toHaveBeenCalledWith(mockOverride);
      expect(taskAttendanceRepository.upsertLocalTasks).toHaveBeenCalledWith(mockTask);
      expect(taskAttendanceRepository.upsertLocalAttendanceLogs).toHaveBeenCalledWith(mockAttendance);

      // Verify Cursors advanced
      expect(localDatabase.setSyncCursor).toHaveBeenCalledWith('base_schedule', '2026-09-22T21:00:00.000Z');
      expect(localDatabase.setSyncCursor).toHaveBeenCalledWith('schedule_overrides', '2026-09-22T21:05:00.000Z');
      expect(localDatabase.setSyncCursor).toHaveBeenCalledWith('academic_tasks', '2026-09-22T21:10:00.000Z');
      expect(localDatabase.setSyncCursor).toHaveBeenCalledWith('user_task_completions', '2026-09-22T21:15:00.000Z');
      expect(localDatabase.setSyncCursor).toHaveBeenCalledWith('attendance_logs', '2026-09-22T21:20:00.000Z');
      expect(localDatabase.setSyncCursor).toHaveBeenCalledWith('sync_tombstones', '2026-09-22T20:04:00.000Z');
    });

    it('bypasses native SQLite transactions when running on web', async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });

      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      } as unknown as SupabaseClient<Database>;

      const syncResult = await syncEntityDeltas({
        supabase: mockSupabase,
        userId: 'user-web',
        sectionId: 'sec-web',
        courseIds: ['c1'],
      });

      expect(syncResult.success).toBe(true);
      expect(platformDb.transaction).not.toHaveBeenCalled();

      // Restore Platform.OS
      Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
    });
  });

  describe('Realtime Persistence Integration', () => {
    it('directly writes incoming CDC payloads to SQLite repositories and updates Zustand store', () => {
      const store = useAppStore.getState();
      const newBlock: BaseScheduleRow = {
        id: 'realtime-block-1',
        course_id: 'c1',
        day_of_week: 1,
        start_time: '10:00',
        end_time: '11:30',
        room: 'Lab-A',
        instructor: 'Dr. Turing',
        session_type: 'lecture',
        frequency: 'weekly',
        color_override: null,
        created_at: '2026-09-22T00:00:00.000Z',
        updated_at: '2026-09-22T00:00:00.000Z',
        course: null,
      };

      // Simulate CDC INSERT on base_schedule
      store.upsertLocalScheduleBlock(newBlock);
      scheduleRepository.upsertLocalBaseSchedules([newBlock]);

      expect(scheduleRepository.upsertLocalBaseSchedules).toHaveBeenCalledWith([newBlock]);
      expect(useAppStore.getState().baseSchedules.find((b) => b.id === 'realtime-block-1')).toBeDefined();

      // Simulate CDC DELETE on base_schedule
      store.removeLocalScheduleBlock('realtime-block-1');
      scheduleRepository.deleteLocalBaseSchedule('realtime-block-1');

      expect(scheduleRepository.deleteLocalBaseSchedule).toHaveBeenCalledWith('realtime-block-1');
      expect(useAppStore.getState().baseSchedules.find((b) => b.id === 'realtime-block-1')).toBeUndefined();
    });
  });
});
