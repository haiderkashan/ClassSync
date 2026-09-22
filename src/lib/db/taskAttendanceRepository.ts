import {
  queryAll,
  queryFirst,
  runSql,
  transaction,
  isWeb,
  generateClientUuid,
} from './platformDb';
import { normalizeIsoDate, normalizeDateString } from './scheduleRepository';
import type { AcademicTaskRow, AttendanceLogRow } from '@/store/useAppStore';

// ============================================================================
// ACADEMIC TASKS & COMPLETIONS REPOSITORY
// ============================================================================

export interface GetTasksOptions {
  sectionId?: string;
  courseIds?: string[];
  userId?: string;
}

/**
 * Retrieves academic tasks with joined course metadata and completion status for userId.
 * Safe empty array on Web.
 */
export function getLocalTasks(options: GetTasksOptions = {}): AcademicTaskRow[] {
  if (isWeb) return [];

  const { sectionId, courseIds, userId } = options;
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (sectionId) {
    whereClauses.push('t.section_id = ?');
    params.push(sectionId);
  }

  if (courseIds && courseIds.length > 0) {
    const placeholders = courseIds.map(() => '?').join(',');
    // Tasks can either belong to one of the active courses or be cohort-wide announcements (course_id IS NULL)
    whereClauses.push(`(t.course_id IN (${placeholders}) OR t.course_id IS NULL)`);
    params.push(...courseIds);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Include user completion check if userId is provided
  const completionJoin = userId
    ? 'LEFT JOIN cached_task_completions tc ON t.id = tc.task_id AND tc.user_id = ?'
    : 'LEFT JOIN cached_task_completions tc ON 1 = 0';

  const allParams = userId ? [userId, ...params] : params;

  const sql = `
    SELECT 
      t.id, t.section_id, t.course_id, t.title, t.description,
      t.task_type, t.due_datetime, t.is_personal, t.created_by, t.updated_at,
      tc.completed_at as tc_completed_at,
      c.id as c_id, c.section_id as c_section_id, c.name as c_name, c.code as c_code,
      c.color_hex as c_color_hex, c.join_code as c_join_code, c.guest_invite_token as c_guest_invite_token
    FROM cached_academic_tasks t
    ${completionJoin}
    LEFT JOIN cached_courses c ON t.course_id = c.id
    ${whereSql}
    ORDER BY t.due_datetime ASC
  `;

  const rows = queryAll(sql, ...allParams);

  return rows.map((row: any): AcademicTaskRow => ({
    id: row.id,
    section_id: row.section_id,
    course_id: row.course_id ?? null,
    title: row.title,
    description: row.description ?? null,
    task_type: row.task_type ?? 'assignment',
    due_datetime: normalizeIsoDate(row.due_datetime),
    is_personal: Boolean(row.is_personal),
    created_by: row.created_by,
    created_at: normalizeIsoDate(row.updated_at),
    updated_at: normalizeIsoDate(row.updated_at),
    is_completed: Boolean(row.tc_completed_at),
    course: row.c_id
      ? {
          id: row.c_id,
          section_id: row.c_section_id,
          name: row.c_name,
          code: row.c_code ?? null,
          color_hex: row.c_color_hex ?? '#3B82F6',
          join_code: row.c_join_code ?? null,
          guest_invite_token: row.c_guest_invite_token ?? '',
          is_archived: false,
          created_at: normalizeIsoDate(row.updated_at),
          updated_at: normalizeIsoDate(row.updated_at),
        }
      : null,
  }));
}

/**
 * Bulk upserts academic tasks in a single SQLite ACID transaction.
 */
export function upsertLocalTasks(tasks: AcademicTaskRow[]): void {
  if (isWeb || tasks.length === 0) return;

  transaction(() => {
    for (const task of tasks) {
      runSql(
        `INSERT INTO cached_academic_tasks (
          id, section_id, course_id, title, description,
          task_type, due_datetime, is_personal, created_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          section_id = excluded.section_id,
          course_id = excluded.course_id,
          title = excluded.title,
          description = excluded.description,
          task_type = excluded.task_type,
          due_datetime = excluded.due_datetime,
          is_personal = excluded.is_personal,
          created_by = excluded.created_by,
          updated_at = excluded.updated_at`,
        task.id,
        task.section_id,
        task.course_id ?? null,
        task.title,
        task.description ?? null,
        task.task_type ?? 'assignment',
        normalizeIsoDate(task.due_datetime),
        task.is_personal ? 1 : 0,
        task.created_by,
        normalizeIsoDate(task.updated_at)
      );

      if (task.course) {
        runSql(
          `INSERT INTO cached_courses (
            id, section_id, name, code, color_hex, join_code, guest_invite_token, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code,
            color_hex = excluded.color_hex,
            join_code = excluded.join_code,
            guest_invite_token = excluded.guest_invite_token,
            updated_at = excluded.updated_at`,
          task.course.id,
          task.course.section_id,
          task.course.name,
          task.course.code ?? null,
          task.course.color_hex ?? '#3B82F6',
          task.course.join_code ?? null,
          task.course.guest_invite_token ?? null,
          normalizeIsoDate(task.course.updated_at)
        );
      }
    }
  });
}

/**
 * Deletes a single academic task by ID from local SQLite.
 */
export function deleteLocalTask(id: string): void {
  if (isWeb) return;
  runSql('DELETE FROM cached_academic_tasks WHERE id = ?', id);
}

/**
 * Clears academic tasks from local SQLite.
 */
export function clearLocalTasks(sectionId?: string): void {
  if (isWeb) return;
  if (sectionId) {
    runSql('DELETE FROM cached_academic_tasks WHERE section_id = ?', sectionId);
  } else {
    runSql('DELETE FROM cached_academic_tasks');
  }
}

/**
 * Retrieves all completed task IDs for a given user.
 */
export function getLocalTaskCompletions(userId: string): string[] {
  if (isWeb || !userId) return [];
  const rows = queryAll<{ task_id: string }>(
    'SELECT task_id FROM cached_task_completions WHERE user_id = ?',
    userId
  );
  return rows.map((r) => r.task_id);
}

/**
 * Toggles completion status for a task locally.
 * Returns true if now completed, false if unmarked.
 */
export function toggleLocalTaskCompletion(
  taskId: string,
  userId: string,
  completedAt?: string
): boolean {
  if (isWeb || !taskId || !userId) return false;

  const existing = queryFirst<{ id: string }>(
    'SELECT id FROM cached_task_completions WHERE task_id = ? AND user_id = ?',
    taskId,
    userId
  );

  if (existing) {
    runSql(
      'DELETE FROM cached_task_completions WHERE task_id = ? AND user_id = ?',
      taskId,
      userId
    );
    return false;
  } else {
    const id = generateClientUuid();
    const timestamp = normalizeIsoDate(completedAt);
    runSql(
      `INSERT INTO cached_task_completions (id, task_id, user_id, completed_at)
       VALUES (?, ?, ?, ?)`,
      id,
      taskId,
      userId,
      timestamp
    );
    return true;
  }
}

/**
 * Bulk sets task completions for a user.
 */
export function setLocalTaskCompletions(userId: string, taskIds: string[]): void {
  if (isWeb || !userId) return;

  transaction(() => {
    runSql('DELETE FROM cached_task_completions WHERE user_id = ?', userId);
    const now = new Date().toISOString();
    for (const taskId of taskIds) {
      runSql(
        `INSERT INTO cached_task_completions (id, task_id, user_id, completed_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(task_id, user_id) DO NOTHING`,
        generateClientUuid(),
        taskId,
        userId,
        now
      );
    }
  });
}

// ============================================================================
// ATTENDANCE LOGS REPOSITORY
// ============================================================================

export interface GetAttendanceLogsOptions {
  userId?: string;
  courseId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Retrieves attendance logs with joined course metadata.
 * Safe empty array on Web.
 */
export function getLocalAttendanceLogs(
  options: GetAttendanceLogsOptions = {}
): AttendanceLogRow[] {
  if (isWeb) return [];

  const { userId, courseId, startDate, endDate } = options;
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (userId) {
    whereClauses.push('a.user_id = ?');
    params.push(userId);
  }

  if (courseId) {
    whereClauses.push('a.course_id = ?');
    params.push(courseId);
  }

  if (startDate) {
    whereClauses.push('a.attendance_date >= ?');
    params.push(normalizeDateString(startDate));
  }

  if (endDate) {
    whereClauses.push('a.attendance_date <= ?');
    params.push(normalizeDateString(endDate));
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      a.id, a.course_id, a.user_id, a.schedule_block_id, a.override_id,
      a.attendance_date, a.status, a.notes, a.updated_at,
      c.id as c_id, c.section_id as c_section_id, c.name as c_name, c.code as c_code,
      c.color_hex as c_color_hex, c.join_code as c_join_code, c.guest_invite_token as c_guest_invite_token
    FROM cached_attendance_logs a
    LEFT JOIN cached_courses c ON a.course_id = c.id
    ${whereSql}
    ORDER BY a.attendance_date DESC
  `;

  const rows = queryAll(sql, ...params);

  return rows.map((row: any): AttendanceLogRow => ({
    id: row.id,
    course_id: row.course_id,
    user_id: row.user_id,
    schedule_block_id: row.schedule_block_id ?? null,
    override_id: row.override_id ?? null,
    attendance_date: normalizeDateString(row.attendance_date),
    status: row.status ?? 'present',
    notes: row.notes ?? null,
    created_at: normalizeIsoDate(row.updated_at),
    updated_at: normalizeIsoDate(row.updated_at),
    course: row.c_id
      ? {
          id: row.c_id,
          section_id: row.c_section_id,
          name: row.c_name,
          code: row.c_code ?? null,
          color_hex: row.c_color_hex ?? '#3B82F6',
          join_code: row.c_join_code ?? null,
          guest_invite_token: row.c_guest_invite_token ?? '',
          is_archived: false,
          created_at: normalizeIsoDate(row.updated_at),
          updated_at: normalizeIsoDate(row.updated_at),
        }
      : null,
  }));
}

/**
 * Bulk upserts attendance logs in a single SQLite ACID transaction.
 */
export function upsertLocalAttendanceLogs(logs: AttendanceLogRow[]): void {
  if (isWeb || logs.length === 0) return;

  transaction(() => {
    for (const log of logs) {
      runSql(
        `INSERT INTO cached_attendance_logs (
          id, course_id, user_id, schedule_block_id, override_id,
          attendance_date, status, notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          course_id = excluded.course_id,
          user_id = excluded.user_id,
          schedule_block_id = excluded.schedule_block_id,
          override_id = excluded.override_id,
          attendance_date = excluded.attendance_date,
          status = excluded.status,
          notes = excluded.notes,
          updated_at = excluded.updated_at`,
        log.id,
        log.course_id,
        log.user_id,
        log.schedule_block_id ?? null,
        log.override_id ?? null,
        normalizeDateString(log.attendance_date),
        log.status ?? 'present',
        log.notes ?? null,
        normalizeIsoDate(log.updated_at)
      );

      if (log.course) {
        runSql(
          `INSERT INTO cached_courses (
            id, section_id, name, code, color_hex, join_code, guest_invite_token, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code,
            color_hex = excluded.color_hex,
            join_code = excluded.join_code,
            guest_invite_token = excluded.guest_invite_token,
            updated_at = excluded.updated_at`,
          log.course.id,
          log.course.section_id,
          log.course.name,
          log.course.code ?? null,
          log.course.color_hex ?? '#3B82F6',
          log.course.join_code ?? null,
          log.course.guest_invite_token ?? null,
          normalizeIsoDate(log.course.updated_at)
        );
      }
    }
  });
}

/**
 * Deletes a single attendance log by ID from local SQLite.
 */
export function deleteLocalAttendanceLog(id: string): void {
  if (isWeb) return;
  runSql('DELETE FROM cached_attendance_logs WHERE id = ?', id);
}

/**
 * Clears attendance logs from local SQLite.
 */
export function clearLocalAttendanceLogs(userId?: string): void {
  if (isWeb) return;
  if (userId) {
    runSql('DELETE FROM cached_attendance_logs WHERE user_id = ?', userId);
  } else {
    runSql('DELETE FROM cached_attendance_logs');
  }
}
