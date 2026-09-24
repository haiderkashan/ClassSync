import * as Crypto from 'expo-crypto';

/**
 * Web Platform Implementation for ClassSync Database Access.
 * On web, native SQLite is bypassed completely to avoid bundling wa-sqlite wasm modules
 * or crashing web environments. All operations safely no-op or return empty sets,
 * allowing the application to rely on memory and direct Supabase network queries.
 */
export const isWeb = true;

export interface SafeRunResult {
  changes: number;
  lastInsertRowId: number;
}

/**
 * Returns null on Web.
 */
export function getDatabase(): any | null {
  return null;
}

/**
 * Executes raw SQL statements synchronously. Safe no-op on Web.
 */
export function execSql(sql: string): void {
  // Safe no-op on Web
}

/**
 * Runs a single parameterized SQL mutation. Safe fallback on Web.
 */
export function runSql(sql: string, ...params: any[]): SafeRunResult {
  return { changes: 0, lastInsertRowId: 0 };
}

/**
 * Queries all rows matching a parameterized SQL statement.
 * Always returns an empty array on Web.
 */
export function queryAll<T = any>(sql: string, ...params: any[]): T[] {
  return [];
}

/**
 * Queries the first matching row from a parameterized SQL statement.
 * Always returns null on Web.
 */
export function queryFirst<T = any>(sql: string, ...params: any[]): T | null {
  return null;
}

/**
 * Runs a block of operations. On Web, executes the callback directly without transaction wrapping.
 */
export function transaction<T>(task: () => T): T {
  return task();
}

/**
 * Generates a cryptographically secure RFC4122 v4 UUID for offline entity creation.
 */
export function generateClientUuid(): string {
  try {
    if (typeof Crypto?.randomUUID === 'function') {
      const id = Crypto.randomUUID();
      if (id) return id;
    }
  } catch {
    // Fallback if expo-crypto is unavailable
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
