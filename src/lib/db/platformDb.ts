import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

/**
 * Platform detection flag for web bypass.
 * When true, all native SQLite operations are bypassed to prevent bundler / DOM crashes.
 */
export const isWeb = Platform.OS === 'web';

export interface SafeRunResult {
  changes: number;
  lastInsertRowId: number;
}

let dbInstance: any = null;

/**
 * Returns the open SQLite database handle on iOS/Android,
 * or null when running on the Web.
 */
export function getDatabase(): any | null {
  if (isWeb) {
    return null;
  }

  if (!dbInstance) {
    try {
      // Dynamic require ensures expo-sqlite native code is never evaluated on web bundlers
      const SQLite = require('expo-sqlite');
      dbInstance = SQLite.openDatabaseSync('classsync.db');
    } catch (err) {
      console.warn('⚠️ [platformDb] Failed to initialize native SQLite database:', err);
      return null;
    }
  }

  return dbInstance;
}

/**
 * Executes one or more raw SQL statements synchronously.
 * Safe no-op on Web.
 */
export function execSql(sql: string): void {
  const db = getDatabase();
  if (!db) return;
  db.execSync(sql);
}

/**
 * Runs a single parameterized SQL mutation (INSERT, UPDATE, DELETE).
 * Returns { changes, lastInsertRowId }. Safe fallback on Web.
 */
export function runSql(sql: string, ...params: any[]): SafeRunResult {
  const db = getDatabase();
  if (!db) {
    return { changes: 0, lastInsertRowId: 0 };
  }
  return db.runSync(sql, ...params);
}

/**
 * Queries all rows matching a parameterized SQL statement synchronously.
 * Returns empty array on Web.
 */
export function queryAll<T = any>(sql: string, ...params: any[]): T[] {
  const db = getDatabase();
  if (!db) {
    return [];
  }
  return db.getAllSync(sql, ...params);
}

/**
 * Queries the first matching row from a parameterized SQL statement synchronously.
 * Returns null on Web or when no rows match.
 */
export function queryFirst<T = any>(sql: string, ...params: any[]): T | null {
  const db = getDatabase();
  if (!db) {
    return null;
  }
  return db.getFirstSync(sql, ...params) ?? null;
}

/**
 * Runs a block of synchronous SQLite operations inside an ACID transaction.
 * On Web, simply executes the callback in-memory.
 */
export function transaction<T>(task: () => T): T {
  const db = getDatabase();
  if (!db) {
    return task();
  }
  return db.withTransactionSync(task);
}

/**
 * Generates a cryptographically secure RFC4122 v4 UUID for offline entity creation.
 * Works seamlessly across Native (expo-crypto), Browser/Node (globalThis.crypto), and test environments.
 */
export function generateClientUuid(): string {
  try {
    if (typeof Crypto?.randomUUID === 'function') {
      const id = Crypto.randomUUID();
      if (id) return id;
    }
  } catch {
    // Fallback if expo-crypto native bridge is unavailable in Node/Jest
  }

  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
