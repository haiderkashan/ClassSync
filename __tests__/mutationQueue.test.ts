jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  enqueueOfflineMutation,
  peekPendingMutations,
  getPendingMutationCount,
  markMutationProcessing,
  markMutationRetry,
  removeCompletedMutation,
  evictPoisonPillMutation,
  clearOfflineMutationQueue,
  executeOptimisticMutation,
} from '@/lib/db/mutationQueue';
import {
  replayOfflineMutations,
  isPoisonPillError,
  computeBackoffDelay,
} from '@/services/mutationReplayWorker';
import * as platformDb from '@/lib/db/platformDb';
import * as scheduleRepository from '@/lib/db/scheduleRepository';
import * as taskAttendanceRepository from '@/lib/db/taskAttendanceRepository';
import { useAppStore } from '@/store/useAppStore';

// Mock dependencies
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

jest.mock('@/lib/db/scheduleRepository', () => ({
  deleteLocalBaseSchedule: jest.fn(),
  deleteLocalScheduleOverride: jest.fn(),
}));

jest.mock('@/lib/db/taskAttendanceRepository', () => ({
  deleteLocalTask: jest.fn(),
  deleteLocalAttendanceLog: jest.fn(),
}));

jest.mock('@/lib/db/platformDb', () => {
  const actual = jest.requireActual('@/lib/db/platformDb');
  return {
    ...actual,
    isWeb: false,
    runSql: jest.fn(),
    queryAll: jest.fn(),
    queryFirst: jest.fn(),
    transaction: jest.fn((cb: () => void) => cb()),
    generateClientUuid: jest.fn(() => 'mock-client-uuid-1234'),
  };
});

describe('Phase 7.4: Durable Offline Mutation Queue & Background Replay Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.getState().reset();
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
  });

  describe('1. Optimistic SQLite Transaction Wrapper (executeOptimisticMutation)', () => {
    it('executes local DB update and mutation enqueue in a single synchronous SQLite transaction', () => {
      const applyLocalDb = jest.fn();
      const applyZustand = jest.fn();

      const result = executeOptimisticMutation({
        entityType: 'attendance_log',
        operation: 'INSERT',
        payload: {
          course_id: 'c1',
          user_id: 'u1',
          attendance_date: '2026-09-23',
          status: 'present',
        },
        applyLocalDb,
        applyZustand,
      });

      // 1. Transaction called
      expect(platformDb.transaction).toHaveBeenCalledTimes(1);

      // 2. Local DB update called with generated client UUID
      expect(applyLocalDb).toHaveBeenCalledWith('mock-client-uuid-1234');

      // 3. Queue insert executed inside transaction with exact UUID
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO offline_mutations'),
        'mock-client-uuid-1234',
        'attendance_log',
        'INSERT',
        expect.stringContaining('"id":"mock-client-uuid-1234"'),
        expect.any(String),
        expect.stringContaining('attendance_log_INSERT_mock-client-uuid-1234')
      );

      // 4. Zustand applied immediately for 0ms UI latency
      expect(applyZustand).toHaveBeenCalledWith('mock-client-uuid-1234');

      // 5. Result contains consistent recordId
      expect(result.recordId).toBe('mock-client-uuid-1234');
      expect(result.mutation?.id).toBe('mock-client-uuid-1234');
    });

    it('preserves existing recordId for updates and ensures UUID consistency across payload', () => {
      const applyLocalDb = jest.fn();
      const applyZustand = jest.fn();
      const fixedId = 'custom-task-uuid-888';

      const result = executeOptimisticMutation({
        entityType: 'academic_task',
        operation: 'UPDATE',
        recordId: fixedId,
        payload: {
          title: 'Complete Lab Report',
          section_id: 'sec-1',
        },
        applyLocalDb,
        applyZustand,
      });

      expect(applyLocalDb).toHaveBeenCalledWith(fixedId);
      expect(applyZustand).toHaveBeenCalledWith(fixedId);
      expect(result.recordId).toBe(fixedId);
      expect((result.mutation?.payload as any).id).toBe(fixedId);
    });

    it('bypasses SQLite transactions safely on web while still applying Zustand', () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });

      const applyLocalDb = jest.fn();
      const applyZustand = jest.fn();

      const result = executeOptimisticMutation({
        entityType: 'attendance_log',
        operation: 'INSERT',
        payload: { status: 'present' },
        applyLocalDb,
        applyZustand,
      });

      expect(platformDb.transaction).not.toHaveBeenCalled();
      expect(applyLocalDb).not.toHaveBeenCalled();
      expect(applyZustand).toHaveBeenCalled();
      expect(result.recordId).toBeDefined();

      Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
    });
  });

  describe('2. Offline Mutation Queue CRUD Operations', () => {
    it('enqueueOfflineMutation inserts record into SQLite queue with status pending', () => {
      const mutation = enqueueOfflineMutation({
        entityType: 'academic_task',
        operation: 'INSERT',
        payload: { title: 'Study for Midterm' },
      });

      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO offline_mutations'),
        'mock-client-uuid-1234',
        'academic_task',
        'INSERT',
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
      expect(mutation?.status).toBe('pending');
    });

    it('peekPendingMutations queries records ordered by created_at ASC (FIFO)', () => {
      (platformDb.queryAll as jest.Mock).mockReturnValue([
        {
          id: 'm1',
          entity_type: 'attendance_log',
          operation: 'INSERT',
          payload: '{"id":"m1","status":"present"}',
          created_at: '2026-09-23T10:00:00.000Z',
          retry_count: 0,
          idempotency_key: 'key1',
          status: 'pending',
        },
      ]);

      const pending = peekPendingMutations(10);
      expect(platformDb.queryAll).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at ASC'),
        10
      );
      expect(pending).toHaveLength(1);
      expect(pending[0].payload).toEqual({ id: 'm1', status: 'present' });
    });

    it('getPendingMutationCount returns integer count of pending records', () => {
      (platformDb.queryFirst as jest.Mock).mockReturnValue({ count: 4 });
      expect(getPendingMutationCount()).toBe(4);
    });

    it('markMutationProcessing, markMutationRetry, removeCompletedMutation, evictPoisonPillMutation execute expected SQL', () => {
      markMutationProcessing('m1');
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'processing'"),
        'm1'
      );

      markMutationRetry('m1', 2);
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'pending', retry_count = ?"),
        3,
        'm1'
      );

      removeCompletedMutation('m1');
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM offline_mutations WHERE id = ?'),
        'm1'
      );

      evictPoisonPillMutation('m1', '403 Forbidden');
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM offline_mutations WHERE id = ?'),
        'm1'
      );

      clearOfflineMutationQueue();
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM offline_mutations')
      );
    });
  });

  describe('3. Error Classification & Exponential Backoff Utilities', () => {
    it('isPoisonPillError classifies 4xx errors as poison pills', () => {
      expect(isPoisonPillError({ status: 400, message: 'Bad Request' })).toBe(true);
      expect(isPoisonPillError({ status: 403, message: 'Permission Denied' })).toBe(true);
      expect(isPoisonPillError({ status: 404, message: 'Not Found' })).toBe(true);
      expect(isPoisonPillError({ status: 422, message: 'Unprocessable Entity' })).toBe(true);
    });

    it('isPoisonPillError classifies Postgres RLS and constraint codes as poison pills', () => {
      expect(isPoisonPillError({ code: '42501', message: 'row-level security violation' })).toBe(true);
      expect(isPoisonPillError({ code: '23503', message: 'violates foreign key constraint' })).toBe(true);
      expect(isPoisonPillError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(true);
      expect(isPoisonPillError({ code: 'PGRST116', message: 'Resource not found' })).toBe(true);
    });

    it('isPoisonPillError classifies 5xx and network dropouts as transient (NOT poison pills)', () => {
      expect(isPoisonPillError({ status: 500, message: 'Internal Server Error' })).toBe(false);
      expect(isPoisonPillError({ status: 502, message: 'Bad Gateway' })).toBe(false);
      expect(isPoisonPillError({ status: 503, message: 'Service Unavailable' })).toBe(false);
      expect(isPoisonPillError({ status: 408, message: 'Request Timeout' })).toBe(false);
      expect(isPoisonPillError(new Error('Network request failed'))).toBe(false);
    });

    it('computeBackoffDelay calculates exponential backoff capped at maxBackoffMs', () => {
      expect(computeBackoffDelay(0, 2000, 60000)).toBe(2000);
      expect(computeBackoffDelay(1, 2000, 60000)).toBe(4000);
      expect(computeBackoffDelay(2, 2000, 60000)).toBe(8000);
      expect(computeBackoffDelay(3, 2000, 60000)).toBe(16000);
      expect(computeBackoffDelay(10, 2000, 60000)).toBe(60000); // capped
    });
  });

  describe('4. Network-Aware Idempotent Replay Worker (replayOfflineMutations)', () => {
    function createMockSupabase(tableResponses: Record<string, any>) {
      return {
        from: jest.fn((tableName: string) => {
          const res = tableResponses[tableName] || { data: null, error: null };
          return {
            upsert: jest.fn().mockResolvedValue(res),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue(res),
              match: jest.fn().mockResolvedValue(res),
            }),
          };
        }),
      } as unknown as SupabaseClient<Database>;
    }

    it('CRITICAL BATTERY CHECK: Halts immediately if NetInfo.isConnected is false with 0 network calls', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

      const mockSupabase = { from: jest.fn() } as unknown as SupabaseClient<Database>;
      const result = await replayOfflineMutations(mockSupabase);

      expect(result.haltedOffline).toBe(true);
      expect(result.processed).toBe(0);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(platformDb.queryAll).not.toHaveBeenCalled();
    });

    it('replays pending mutations in FIFO order and removes completed records from SQLite', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

      const mockMutations = [
        {
          id: 'mut-1',
          entity_type: 'attendance_log',
          operation: 'INSERT',
          payload: {
            id: 'att-1',
            course_id: 'c1',
            user_id: 'u1',
            attendance_date: '2026-09-23',
            status: 'present',
          },
          created_at: '2026-09-23T10:00:00.000Z',
          retry_count: 0,
          idempotency_key: 'k1',
          status: 'pending',
        },
        {
          id: 'mut-2',
          entity_type: 'academic_task',
          operation: 'INSERT',
          payload: {
            id: 'task-1',
            section_id: 'sec-1',
            title: 'CS 101 Homework',
            due_datetime: '2026-09-25T23:59:00.000Z',
            created_by: 'u1',
          },
          created_at: '2026-09-23T10:01:00.000Z',
          retry_count: 0,
          idempotency_key: 'k2',
          status: 'pending',
        },
      ];

      (platformDb.queryAll as jest.Mock).mockReturnValue(
        mockMutations.map((m) => ({ ...m, payload: JSON.stringify(m.payload) }))
      );

      const mockSupabase = createMockSupabase({
        attendance_logs: { data: null, error: null },
        academic_tasks: { data: null, error: null },
      });

      const result = await replayOfflineMutations(mockSupabase);

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.haltedOffline).toBe(false);

      // Verify remote calls preserved offline UUIDs
      expect(mockSupabase.from).toHaveBeenCalledWith('attendance_logs');
      expect(mockSupabase.from).toHaveBeenCalledWith('academic_tasks');

      // Verify completion deletions
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM offline_mutations WHERE id = ?'),
        'mut-1'
      );
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM offline_mutations WHERE id = ?'),
        'mut-2'
      );
    });

    it('evicts poison pills (4xx error) and rolls back optimistic local state', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

      const poisonMutation = {
        id: 'mut-poison',
        entity_type: 'attendance_log',
        operation: 'INSERT',
        payload: {
          id: 'att-bad',
          course_id: 'c1',
          user_id: 'u1',
          attendance_date: '2026-09-23',
        },
        created_at: '2026-09-23T10:00:00.000Z',
        retry_count: 0,
        idempotency_key: 'kp',
        status: 'pending',
      };

      (platformDb.queryAll as jest.Mock).mockReturnValue([
        { ...poisonMutation, payload: JSON.stringify(poisonMutation.payload) },
      ]);

      const mockSupabase = createMockSupabase({
        attendance_logs: {
          data: null,
          error: { status: 403, message: 'Row-level security policy violation' },
        },
      });

      const result = await replayOfflineMutations(mockSupabase);

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.poisonPillsEvicted).toBe(1);

      // Rollback was executed
      expect(taskAttendanceRepository.deleteLocalAttendanceLog).toHaveBeenCalledWith('att-bad');

      // Poison pill was evicted
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM offline_mutations WHERE id = ?'),
        'mut-poison'
      );
    });

    it('backs off and halts FIFO processing on transient server errors (5xx)', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

      const transientMutation = {
        id: 'mut-transient',
        entity_type: 'attendance_log',
        operation: 'INSERT',
        payload: { id: 'att-1' },
        created_at: '2026-09-23T10:00:00.000Z',
        retry_count: 1,
        idempotency_key: 'kt',
        status: 'pending',
      };

      (platformDb.queryAll as jest.Mock).mockReturnValue([
        { ...transientMutation, payload: JSON.stringify(transientMutation.payload) },
      ]);

      const mockSupabase = createMockSupabase({
        attendance_logs: {
          data: null,
          error: { status: 500, message: 'Internal Server Error' },
        },
      });

      const result = await replayOfflineMutations(mockSupabase);

      expect(result.failed).toBe(1);
      expect(result.haltedTransientError).toBe(true);
      expect(result.poisonPillsEvicted).toBe(0);

      // Retry count incremented
      expect(platformDb.runSql).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'pending', retry_count = ?"),
        2,
        'mut-transient'
      );
    });
  });
});
