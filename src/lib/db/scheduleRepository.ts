import {
  queryAll,
  queryFirst,
  runSql,
  transaction,
  isWeb,
} from './platformDb';
import type { BaseScheduleRow, ScheduleOverrideRow } from '@/store/useAppStore';

/**
 * Normalizes an arbitrary timestamp or date input to a strict ISO 8601 string.
 */
export function normalizeIsoDate(dateVal?: string | Date | null): string {
  if (!dateVal) return new Date().toISOString();
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Normalizes an arbitrary date input to a clean 'YYYY-MM-DD' calendar string.
 */
export function normalizeDateString(dateVal?: string | Date | null): string {
  if (!dateVal) {
    return new Date().toISOString().split('T')[0];
  }
  if (typeof dateVal === 'string') {
    return dateVal.split('T')[0];
  }
  return dateVal.toISOString().split('T')[0];
}

// ============================================================================
// BASE SCHEDULES REPOSITORY
// ============================================================================

export interface GetBaseSchedulesOptions {
  courseIds?: string[];
  dayOfWeek?: number;
}

/**
 * Reads local recurring base schedules from SQLite with joined course metadata.
 * Safe empty array on Web.
 */
export function getLocalBaseSchedules(
  options: GetBaseSchedulesOptions = {}
): BaseScheduleRow[] {
  if (isWeb) return [];

  const { courseIds, dayOfWeek } = options;
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (courseIds && courseIds.length > 0) {
    const placeholders = courseIds.map(() => '?').join(',');
    whereClauses.push(`b.course_id IN (${placeholders})`);
    params.push(...courseIds);
  }

  if (typeof dayOfWeek === 'number') {
    whereClauses.push('b.day_of_week = ?');
    params.push(dayOfWeek);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      b.id, b.course_id, b.day_of_week, b.start_time, b.end_time, b.room,
      b.session_type, b.frequency, b.instructor, b.color_override, b.updated_at,
      c.id as c_id, c.section_id as c_section_id, c.name as c_name, c.code as c_code,
      c.color_hex as c_color_hex, c.join_code as c_join_code, c.guest_invite_token as c_guest_invite_token
    FROM cached_base_schedules b
    LEFT JOIN cached_courses c ON b.course_id = c.id
    ${whereSql}
    ORDER BY b.day_of_week ASC, b.start_time ASC
  `;

  const rows = queryAll(sql, ...params);

  return rows.map((row: any): BaseScheduleRow => ({
    id: row.id,
    course_id: row.course_id,
    day_of_week: Number(row.day_of_week),
    start_time: row.start_time,
    end_time: row.end_time,
    room: row.room ?? null,
    session_type: row.session_type ?? 'lecture',
    frequency: row.frequency ?? 'weekly',
    instructor: row.instructor ?? null,
    color_override: row.color_override ?? null,
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
 * Bulk upserts base schedule blocks in a single SQLite ACID transaction.
 * Also preserves associated course metadata in cached_courses.
 */
export function upsertLocalBaseSchedules(blocks: BaseScheduleRow[]): void {
  if (isWeb || blocks.length === 0) return;

  transaction(() => {
    for (const block of blocks) {
      runSql(
        `INSERT INTO cached_base_schedules (
          id, course_id, day_of_week, start_time, end_time, room,
          session_type, frequency, instructor, color_override, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          course_id = excluded.course_id,
          day_of_week = excluded.day_of_week,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          room = excluded.room,
          session_type = excluded.session_type,
          frequency = excluded.frequency,
          instructor = excluded.instructor,
          color_override = excluded.color_override,
          updated_at = excluded.updated_at`,
        block.id,
        block.course_id,
        Number(block.day_of_week),
        block.start_time,
        block.end_time,
        block.room ?? null,
        block.session_type ?? 'lecture',
        block.frequency ?? 'weekly',
        block.instructor ?? null,
        block.color_override ?? null,
        normalizeIsoDate(block.updated_at)
      );

      if (block.course) {
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
          block.course.id,
          block.course.section_id,
          block.course.name,
          block.course.code ?? null,
          block.course.color_hex ?? '#3B82F6',
          block.course.join_code ?? null,
          block.course.guest_invite_token ?? null,
          normalizeIsoDate(block.course.updated_at)
        );
      }
    }
  });
}

/**
 * Deletes a single base schedule block by ID from local SQLite.
 */
export function deleteLocalBaseSchedule(id: string): void {
  if (isWeb) return;
  runSql('DELETE FROM cached_base_schedules WHERE id = ?', id);
}

/**
 * Clears base schedules, optionally filtered by course IDs.
 */
export function clearLocalBaseSchedules(courseIds?: string[]): void {
  if (isWeb) return;
  if (courseIds && courseIds.length > 0) {
    const placeholders = courseIds.map(() => '?').join(',');
    runSql(`DELETE FROM cached_base_schedules WHERE course_id IN (${placeholders})`, ...courseIds);
  } else {
    runSql('DELETE FROM cached_base_schedules');
  }
}

// ============================================================================
// SCHEDULE OVERRIDES REPOSITORY
// ============================================================================

export interface GetScheduleOverridesOptions {
  courseIds?: string[];
  startDate?: string;
  endDate?: string;
}

/**
 * Reads local schedule overrides and ad-hoc makeups with joined course metadata.
 * Deserializes SQLite integer booleans and serializes clean ISO dates.
 */
export function getLocalScheduleOverrides(
  options: GetScheduleOverridesOptions = {}
): ScheduleOverrideRow[] {
  if (isWeb) return [];

  const { courseIds, startDate, endDate } = options;
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (courseIds && courseIds.length > 0) {
    const placeholders = courseIds.map(() => '?').join(',');
    whereClauses.push(`o.course_id IN (${placeholders})`);
    params.push(...courseIds);
  }

  if (startDate) {
    whereClauses.push('o.override_date >= ?');
    params.push(normalizeDateString(startDate));
  }

  if (endDate) {
    whereClauses.push('o.override_date <= ?');
    params.push(normalizeDateString(endDate));
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      o.id, o.base_schedule_id, o.course_id, o.section_id, o.override_date,
      o.status, o.delay_minutes, o.new_room, o.custom_note, o.is_makeup,
      o.makeup_start_time, o.makeup_end_time, o.created_by, o.updated_at,
      c.id as c_id, c.section_id as c_section_id, c.name as c_name, c.code as c_code,
      c.color_hex as c_color_hex, c.join_code as c_join_code, c.guest_invite_token as c_guest_invite_token
    FROM cached_schedule_overrides o
    LEFT JOIN cached_courses c ON o.course_id = c.id
    ${whereSql}
    ORDER BY o.override_date ASC
  `;

  const rows = queryAll(sql, ...params);

  return rows.map((row: any): ScheduleOverrideRow => ({
    id: row.id,
    base_schedule_id: row.base_schedule_id ?? null,
    course_id: row.course_id,
    section_id: row.section_id ?? '',
    override_date: normalizeDateString(row.override_date),
    status: row.status ?? 'scheduled',
    delay_minutes: Number(row.delay_minutes) || 0,
    new_room: row.new_room ?? null,
    custom_note: row.custom_note ?? null,
    is_makeup: Boolean(row.is_makeup),
    makeup_start_time: row.makeup_start_time ?? null,
    makeup_end_time: row.makeup_end_time ?? null,
    created_by: row.created_by ?? null,
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
 * Bulk upserts schedule overrides in a single SQLite ACID transaction.
 */
export function upsertLocalScheduleOverrides(overrides: ScheduleOverrideRow[]): void {
  if (isWeb || overrides.length === 0) return;

  transaction(() => {
    for (const item of overrides) {
      runSql(
        `INSERT INTO cached_schedule_overrides (
          id, base_schedule_id, course_id, section_id, override_date,
          status, delay_minutes, new_room, custom_note, is_makeup,
          makeup_start_time, makeup_end_time, created_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          base_schedule_id = excluded.base_schedule_id,
          course_id = excluded.course_id,
          section_id = excluded.section_id,
          override_date = excluded.override_date,
          status = excluded.status,
          delay_minutes = excluded.delay_minutes,
          new_room = excluded.new_room,
          custom_note = excluded.custom_note,
          is_makeup = excluded.is_makeup,
          makeup_start_time = excluded.makeup_start_time,
          makeup_end_time = excluded.makeup_end_time,
          created_by = excluded.created_by,
          updated_at = excluded.updated_at`,
        item.id,
        item.base_schedule_id ?? null,
        item.course_id,
        item.section_id ?? null,
        normalizeDateString(item.override_date),
        item.status ?? 'scheduled',
        Number(item.delay_minutes) || 0,
        item.new_room ?? null,
        item.custom_note ?? null,
        item.is_makeup ? 1 : 0,
        item.makeup_start_time ?? null,
        item.makeup_end_time ?? null,
        item.created_by ?? null,
        normalizeIsoDate(item.updated_at)
      );

      if (item.course) {
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
          item.course.id,
          item.course.section_id,
          item.course.name,
          item.course.code ?? null,
          item.course.color_hex ?? '#3B82F6',
          item.course.join_code ?? null,
          item.course.guest_invite_token ?? null,
          normalizeIsoDate(item.course.updated_at)
        );
      }
    }
  });
}

/**
 * Deletes a single schedule override by ID from local SQLite.
 */
export function deleteLocalScheduleOverride(id: string): void {
  if (isWeb) return;
  runSql('DELETE FROM cached_schedule_overrides WHERE id = ?', id);
}

/**
 * Clears schedule overrides from local SQLite.
 */
export function clearLocalScheduleOverrides(courseIds?: string[]): void {
  if (isWeb) return;
  if (courseIds && courseIds.length > 0) {
    const placeholders = courseIds.map(() => '?').join(',');
    runSql(`DELETE FROM cached_schedule_overrides WHERE course_id IN (${placeholders})`, ...courseIds);
  } else {
    runSql('DELETE FROM cached_schedule_overrides');
  }
}
