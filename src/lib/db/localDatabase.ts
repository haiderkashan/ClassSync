import {
  execSql,
  runSql,
  queryFirst,
  queryAll,
  transaction,
  isWeb,
} from './platformDb';

export interface SyncMetadataRow {
  entity_name: string;
  last_synced_at: string | null;
  last_sync_status: string;
  updated_at: string;
}

export interface OfflineMutationRow {
  id: string;
  entity_type: string;
  operation: string;
  payload: string;
  created_at: string;
  retry_count: number;
  idempotency_key: string;
  status: string;
}

/**
 * Initializes local SQLite tables, composite performance indexes,
 * and executes PRAGMA tuning for concurrent WAL performance.
 * On Web, gracefully no-ops.
 */
export function initLocalDatabase(): void {
  if (isWeb) {
    return;
  }

  try {
    // 1. PRAGMA performance tuning
    execSql(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
    `);

    // 2. Relational Cache Tables
    execSql(`
      -- Cached Sections (Cohorts)
      CREATE TABLE IF NOT EXISTS cached_sections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        institution_tag TEXT,
        join_code TEXT,
        cycle_mode TEXT NOT NULL DEFAULT 'weekly',
        week_a_anchor_date TEXT,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        role TEXT,
        updated_at TEXT
      );

      -- Cached Courses
      CREATE TABLE IF NOT EXISTS cached_courses (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT,
        color_hex TEXT NOT NULL DEFAULT '#3B82F6',
        join_code TEXT,
        guest_invite_token TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_muted INTEGER NOT NULL DEFAULT 0,
        is_guest INTEGER NOT NULL DEFAULT 0,
        enrollment_id TEXT,
        updated_at TEXT,
        FOREIGN KEY (section_id) REFERENCES cached_sections(id) ON DELETE CASCADE
      );

      -- Cached Base Recurring Schedules
      CREATE TABLE IF NOT EXISTS cached_base_schedules (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room TEXT,
        session_type TEXT NOT NULL DEFAULT 'lecture',
        frequency TEXT NOT NULL DEFAULT 'weekly',
        instructor TEXT,
        color_override TEXT,
        updated_at TEXT,
        FOREIGN KEY (course_id) REFERENCES cached_courses(id) ON DELETE CASCADE
      );

      -- Cached Date-Specific Schedule Overrides & Exceptions
      CREATE TABLE IF NOT EXISTS cached_schedule_overrides (
        id TEXT PRIMARY KEY,
        base_schedule_id TEXT,
        course_id TEXT NOT NULL,
        section_id TEXT,
        override_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        delay_minutes INTEGER NOT NULL DEFAULT 0,
        new_room TEXT,
        custom_note TEXT,
        is_makeup INTEGER NOT NULL DEFAULT 0,
        makeup_start_time TEXT,
        makeup_end_time TEXT,
        created_by TEXT,
        updated_at TEXT,
        FOREIGN KEY (base_schedule_id) REFERENCES cached_base_schedules(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES cached_courses(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES cached_sections(id) ON DELETE CASCADE
      );

      -- Cached Academic Tasks
      CREATE TABLE IF NOT EXISTS cached_academic_tasks (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        course_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        task_type TEXT NOT NULL DEFAULT 'assignment',
        due_datetime TEXT NOT NULL,
        is_personal INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY (section_id) REFERENCES cached_sections(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES cached_courses(id) ON DELETE CASCADE
      );

      -- Cached Task Completions
      CREATE TABLE IF NOT EXISTS cached_task_completions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        UNIQUE(task_id, user_id),
        FOREIGN KEY (task_id) REFERENCES cached_academic_tasks(id) ON DELETE CASCADE
      );

      -- Cached Attendance Logs
      CREATE TABLE IF NOT EXISTS cached_attendance_logs (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        schedule_block_id TEXT,
        override_id TEXT,
        attendance_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'present',
        notes TEXT,
        updated_at TEXT,
        FOREIGN KEY (course_id) REFERENCES cached_courses(id) ON DELETE CASCADE,
        FOREIGN KEY (schedule_block_id) REFERENCES cached_base_schedules(id) ON DELETE SET NULL,
        FOREIGN KEY (override_id) REFERENCES cached_schedule_overrides(id) ON DELETE SET NULL
      );

      -- Sync Metadata Cursors
      CREATE TABLE IF NOT EXISTS sync_metadata (
        entity_name TEXT PRIMARY KEY,
        last_synced_at TEXT,
        last_sync_status TEXT DEFAULT 'success',
        updated_at TEXT
      );

      -- Durable Offline Mutation Queue
      CREATE TABLE IF NOT EXISTS offline_mutations (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        idempotency_key TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      );
    `);

    // 3. Composite Performance Indexes for Sub-Millisecond Lookups
    execSql(`
      CREATE INDEX IF NOT EXISTS idx_cached_base_schedules_day_freq
        ON cached_base_schedules(day_of_week, frequency);
      CREATE INDEX IF NOT EXISTS idx_cached_base_schedules_course
        ON cached_base_schedules(course_id);

      CREATE INDEX IF NOT EXISTS idx_cached_overrides_date
        ON cached_schedule_overrides(override_date);
      CREATE INDEX IF NOT EXISTS idx_cached_overrides_course
        ON cached_schedule_overrides(course_id);
      CREATE INDEX IF NOT EXISTS idx_cached_overrides_base
        ON cached_schedule_overrides(base_schedule_id);

      CREATE INDEX IF NOT EXISTS idx_cached_tasks_due
        ON cached_academic_tasks(due_datetime);
      CREATE INDEX IF NOT EXISTS idx_cached_tasks_course
        ON cached_academic_tasks(course_id);
      CREATE INDEX IF NOT EXISTS idx_cached_tasks_personal
        ON cached_academic_tasks(is_personal, created_by);

      CREATE INDEX IF NOT EXISTS idx_cached_completions_user
        ON cached_task_completions(user_id);

      CREATE INDEX IF NOT EXISTS idx_cached_attendance_lookup
        ON cached_attendance_logs(user_id, course_id, attendance_date);

      CREATE INDEX IF NOT EXISTS idx_offline_mutations_queue
        ON offline_mutations(status, created_at);
    `);
  } catch (err) {
    console.warn('⚠️ [localDatabase] Failed to initialize local SQLite schema:', err);
  }
}

/**
 * Drops all local cached tables, metadata, and mutation queues.
 * Used during complete cache purge or user account switch.
 */
export function resetLocalDatabase(): void {
  if (isWeb) {
    return;
  }

  try {
    execSql(`
      DROP TABLE IF EXISTS offline_mutations;
      DROP TABLE IF EXISTS sync_metadata;
      DROP TABLE IF EXISTS cached_attendance_logs;
      DROP TABLE IF EXISTS cached_task_completions;
      DROP TABLE IF EXISTS cached_academic_tasks;
      DROP TABLE IF EXISTS cached_schedule_overrides;
      DROP TABLE IF EXISTS cached_base_schedules;
      DROP TABLE IF EXISTS cached_courses;
      DROP TABLE IF EXISTS cached_sections;
    `);
    initLocalDatabase();
  } catch (err) {
    console.warn('⚠️ [localDatabase] Failed to reset database:', err);
  }
}

/**
 * Retrieves the high-water mark timestamp for a given sync entity.
 */
export function getSyncCursor(entityName: string): string | null {
  if (isWeb) return null;
  const row = queryFirst<SyncMetadataRow>(
    'SELECT last_synced_at FROM sync_metadata WHERE entity_name = ?',
    entityName
  );
  return row?.last_synced_at ?? null;
}

/**
 * Updates or sets the high-water mark timestamp for a given sync entity.
 */
export function setSyncCursor(
  entityName: string,
  lastSyncedAt: string,
  status: string = 'success'
): void {
  if (isWeb) return;
  const now = new Date().toISOString();
  runSql(
    `INSERT INTO sync_metadata (entity_name, last_synced_at, last_sync_status, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(entity_name) DO UPDATE SET
       last_synced_at = excluded.last_synced_at,
       last_sync_status = excluded.last_sync_status,
       updated_at = excluded.updated_at`,
    entityName,
    lastSyncedAt,
    status,
    now
  );
}
