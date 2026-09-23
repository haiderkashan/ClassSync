import { Platform } from 'react-native';
import {
  isWeb,
  runSql,
  queryAll,
  queryFirst,
  transaction,
  generateClientUuid,
} from './platformDb';

export type MutationEntityType =
  | 'attendance_log'
  | 'academic_task'
  | 'user_task_completion'
  | 'schedule_override'
  | 'base_schedule'
  | string;

export type MutationOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export type MutationStatus = 'pending' | 'processing' | 'failed';

export interface OfflineMutationRecord<T = any> {
  id: string;
  entity_type: MutationEntityType;
  operation: MutationOperation;
  payload: T;
  created_at: string;
  retry_count: number;
  idempotency_key: string;
  status: MutationStatus;
}

export interface EnqueueMutationInput<T = any> {
  id?: string;
  entityType: MutationEntityType;
  operation: MutationOperation;
  payload: T;
  idempotencyKey?: string;
}

export interface OptimisticMutationConfig<T = any> {
  entityType: MutationEntityType;
  operation: MutationOperation;
  recordId?: string;
  payload: T;
  idempotencyKey?: string;
  applyLocalDb: (recordId: string) => void;
  applyZustand?: (recordId: string) => void;
}

export interface OptimisticMutationResult<T = any> {
  recordId: string;
  mutation: OfflineMutationRecord<T> | null;
}

/**
 * Enqueues a standalone mutation into the durable SQLite queue.
 */
export function enqueueOfflineMutation<T = any>(
  input: EnqueueMutationInput<T>
): OfflineMutationRecord<T> | null {
  const isWebRuntime = Platform.OS === 'web' || isWeb;
  const id = input.id || generateClientUuid();
  const createdAt = new Date().toISOString();
  const idempotencyKey =
    input.idempotencyKey || `${input.entityType}_${input.operation}_${id}`;

  if (isWebRuntime) {
    return {
      id,
      entity_type: input.entityType,
      operation: input.operation,
      payload: input.payload,
      created_at: createdAt,
      retry_count: 0,
      idempotency_key: idempotencyKey,
      status: 'pending',
    };
  }

  try {
    const payloadJson = JSON.stringify(input.payload);
    runSql(
      `INSERT INTO offline_mutations (id, entity_type, operation, payload, created_at, retry_count, idempotency_key, status)
       VALUES (?, ?, ?, ?, ?, 0, ?, 'pending')
       ON CONFLICT(idempotency_key) DO UPDATE SET
         payload = excluded.payload,
         created_at = excluded.created_at,
         status = 'pending'`,
      id,
      input.entityType,
      input.operation,
      payloadJson,
      createdAt,
      idempotencyKey
    );

    return {
      id,
      entity_type: input.entityType,
      operation: input.operation,
      payload: input.payload,
      created_at: createdAt,
      retry_count: 0,
      idempotency_key: idempotencyKey,
      status: 'pending',
    };
  } catch (err) {
    console.error('❌ [mutationQueue] Failed to enqueue offline mutation:', err);
    return null;
  }
}

/**
 * Retrieves the oldest pending mutations from the queue in strict FIFO order (created_at ASC).
 */
export function peekPendingMutations(limit = 50): OfflineMutationRecord[] {
  const isWebRuntime = Platform.OS === 'web' || isWeb;
  if (isWebRuntime) {
    return [];
  }

  try {
    const rows = queryAll(
      `SELECT id, entity_type, operation, payload, created_at, retry_count, idempotency_key, status
       FROM offline_mutations
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?`,
      limit
    );

    return rows.map((row: any) => {
      let parsedPayload: any = row.payload;
      try {
        parsedPayload = JSON.parse(row.payload);
      } catch {
        // Keep string if JSON parsing fails
      }

      return {
        id: row.id,
        entity_type: row.entity_type,
        operation: row.operation,
        payload: parsedPayload,
        created_at: row.created_at,
        retry_count: row.retry_count,
        idempotency_key: row.idempotency_key,
        status: row.status,
      };
    });
  } catch (err) {
    console.error('❌ [mutationQueue] Failed to peek pending mutations:', err);
    return [];
  }
}

/**
 * Returns the total count of pending mutations in the offline queue.
 */
export function getPendingMutationCount(): number {
  const isWebRuntime = Platform.OS === 'web' || isWeb;
  if (isWebRuntime) {
    return 0;
  }

  try {
    const row = queryFirst(
      `SELECT COUNT(*) as count FROM offline_mutations WHERE status = 'pending'`
    );
    return row?.count ? Number(row.count) : 0;
  } catch (err) {
    console.error('❌ [mutationQueue] Failed to get pending mutation count:', err);
    return 0;
  }
}

/**
 * Marks a mutation as currently 'processing' to prevent concurrent worker execution.
 */
export function markMutationProcessing(id: string): void {
  const isWebRuntime = Platform.OS === 'web' || isWeb;
  if (isWebRuntime) return;

  try {
    runSql(`UPDATE offline_mutations SET status = 'processing' WHERE id = ?`, id);
  } catch (err) {
    console.error(`❌ [mutationQueue] Failed to mark mutation ${id} as processing:`, err);
  }
}

/**
 * Marks a failed mutation back to 'pending' and increments its retry count with exponential backoff awareness.
 */
export function markMutationRetry(id: string, currentRetryCount: number): void {
  const isWebRuntime = Platform.OS === 'web' || isWeb;
  if (isWebRuntime) return;

  try {
    runSql(
      `UPDATE offline_mutations
       SET status = 'pending', retry_count = ?
       WHERE id = ?`,
      currentRetryCount + 1,
      id
    );
  } catch (err) {
    console.error(`❌ [mutationQueue] Failed to mark mutation ${id} for retry:`, err);
  }
}

/**
 * Removes a successfully replayed mutation from the durable queue.
 */
export function removeCompletedMutation(id: string): void {
  const isWebRuntime = Platform.OS === 'web' || isWeb;
  if (isWebRuntime) return;

  try {
    runSql(`DELETE FROM offline_mutations WHERE id = ?`, id);
  } catch (err) {
    console.error(`❌ [mutationQueue] Failed to remove completed mutation ${id}:`, err);
  }
}

/**
 * Evicts a permanent poison pill mutation (e.g. 4xx validation or RLS error)
 * from the queue so it does not permanently block subsequent FIFO mutations.
 */
export function evictPoisonPillMutation(id: string, reason: string): void {
  const isWebRuntime = Platform.OS === 'web' || isWeb;
  if (isWebRuntime) return;

  try {
    console.warn(`⚠️ [mutationQueue] Evicting poison pill mutation ${id}. Reason: ${reason}`);
    runSql(`DELETE FROM offline_mutations WHERE id = ?`, id);
  } catch (err) {
    console.error(`❌ [mutationQueue] Failed to evict poison pill mutation ${id}:`, err);
  }
}

/**
 * Drops all mutations in the offline queue (e.g., during account switch or logout).
 */
export function clearOfflineMutationQueue(): void {
  const isWebRuntime = Platform.OS === 'web' || isWeb;
  if (isWebRuntime) return;

  try {
    runSql(`DELETE FROM offline_mutations`);
  } catch (err) {
    console.error('❌ [mutationQueue] Failed to clear offline mutation queue:', err);
  }
}

/**
 * OPTIMISTIC MUTATION WRAPPER:
 * Executes the local SQLite table update AND the queue insertion in the EXACT SAME
 * synchronous SQLite transaction. Updates L1 Zustand state immediately for 0ms UI latency.
 * Ensures strict UUID consistency between local SQLite, Zustand, and server RPC payloads.
 */
export function executeOptimisticMutation<T = any>(
  config: OptimisticMutationConfig<T>
): OptimisticMutationResult<T> {
  const isWebRuntime = Platform.OS === 'web' || isWeb;

  // 1. Guarantee client-side RFC4122 v4 UUID for net-new records
  const recordId =
    config.recordId || (config.payload as any)?.id || generateClientUuid();

  const resolvedPayload =
    typeof config.payload === 'object' && config.payload !== null
      ? { ...config.payload, id: (config.payload as any).id || recordId }
      : config.payload;

  const idempotencyKey =
    config.idempotencyKey || `${config.entityType}_${config.operation}_${recordId}`;

  // Web Bundler Bypass: Apply Zustand directly
  if (isWebRuntime) {
    if (config.applyZustand) {
      config.applyZustand(recordId);
    }
    return {
      recordId,
      mutation: {
        id: generateClientUuid(),
        entity_type: config.entityType,
        operation: config.operation,
        payload: resolvedPayload,
        created_at: new Date().toISOString(),
        retry_count: 0,
        idempotency_key: idempotencyKey,
        status: 'pending',
      },
    };
  }

  let createdMutation: OfflineMutationRecord<T> | null = null;

  try {
    // 2. ATOMIC TRANSACTION: Local Table Update + Queue Enqueue
    transaction(() => {
      // A. Write to local SQLite table (L2)
      config.applyLocalDb(recordId);

      // B. Enqueue into offline_mutations inside the same synchronous transaction
      const mutationId = generateClientUuid();
      const createdAt = new Date().toISOString();
      const payloadJson = JSON.stringify(resolvedPayload);

      runSql(
        `INSERT INTO offline_mutations (id, entity_type, operation, payload, created_at, retry_count, idempotency_key, status)
         VALUES (?, ?, ?, ?, ?, 0, ?, 'pending')
         ON CONFLICT(idempotency_key) DO UPDATE SET
           payload = excluded.payload,
           created_at = excluded.created_at,
           status = 'pending'`,
        mutationId,
        config.entityType,
        config.operation,
        payloadJson,
        createdAt,
        idempotencyKey
      );

      createdMutation = {
        id: mutationId,
        entity_type: config.entityType,
        operation: config.operation,
        payload: resolvedPayload,
        created_at: createdAt,
        retry_count: 0,
        idempotency_key: idempotencyKey,
        status: 'pending',
      };
    });

    // 3. Update reactive Zustand store (L1) so UI turns green / updates instantly
    if (config.applyZustand) {
      config.applyZustand(recordId);
    }
  } catch (err) {
    console.error('❌ [mutationQueue] Failed to execute optimistic mutation transaction:', err);
    throw err;
  }

  return { recordId, mutation: createdMutation };
}
