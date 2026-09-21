import type { Tables } from '@/types/database.types';
import type { BaseScheduleRow, CourseRow, WeekParity } from '@/store/useAppStore';
import {
  timeToMinutes,
  minutesToTime,
  calculateDurationMinutes,
} from '@/lib/schedule/timeUtils';
import {
  getDayOfWeekFromDateString,
  calculateWeekParity,
} from '@/lib/schedule/calendarUtils';

export type ScheduleOverrideRow = Tables<'schedule_overrides'> & {
  course?: Tables<'courses'> | null;
};

export type ScheduleOverrideStatus =
  | 'scheduled'
  | 'started'
  | 'delayed'
  | 'cancelled'
  | 'room_moved'
  | 'instructor_away';

export interface CompiledScheduleItem {
  id: string;
  base_schedule_id: string | null;
  override_id: string | null;
  section_id: string;
  course_id: string;
  course: Tables<'courses'> | null;
  date: string; // 'YYYY-MM-DD'
  session_type: string;
  frequency: string;
  instructor: string | null;

  // Effective timing (accounting for delays or makeup times)
  original_start_time: string;
  original_end_time: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;

  // Effective room location
  original_room: string | null;
  room: string | null;

  // Status and exception metadata
  status: ScheduleOverrideStatus;
  delay_minutes: number;
  custom_note: string | null;
  is_makeup: boolean;
  is_cancelled: boolean;
  color_override: string | null;

  // Convenience computed flags
  is_delayed: boolean;
  is_room_moved: boolean;
  has_override: boolean;
}

export interface CompileDailyScheduleOptions {
  /** Target calendar date in 'YYYY-MM-DD' format */
  targetDate: string;
  /** Recurring base schedule blocks */
  baseSchedules: BaseScheduleRow[];
  /** Date-specific schedule overrides */
  overrides?: ScheduleOverrideRow[];
  /** Active courses enrolled by the student (used for Bundle & Toggle filtering) */
  activeCourses?: CourseRow[];
  /** Active week parity ('weekly', 'biweekly_week_a', 'biweekly_week_b') */
  targetParity?: WeekParity;
  /** Week A anchor date for auto-parity calculation if targetParity is omitted */
  anchorDate?: string | null;
  /** Section cycle mode ('standard_weekly' | 'alternating_ab') */
  cycleMode?: string;
  /** Whether to include cancelled sessions in the compiled output (default: true) */
  includeCancelled?: boolean;
}

/**
 * Checks if a base block's frequency is active for the given parity.
 */
function matchesParity(frequency: string, parity: WeekParity): boolean {
  if (parity === 'biweekly_week_a') {
    return frequency !== 'biweekly_week_b';
  }
  if (parity === 'biweekly_week_b') {
    return frequency !== 'biweekly_week_a';
  }
  // Standard weekly or all-inclusive
  return true;
}

/**
 * Calculates new start and end time strings by applying delay minutes,
 * preserving the original string format (with or without seconds).
 */
function applyDelayToTimes(
  startTime: string,
  endTime: string,
  delayMinutes: number
): { startTime: string; endTime: string } {
  if (delayMinutes <= 0) {
    return { startTime, endTime };
  }

  const includeSeconds = startTime.includes(':00') || startTime.split(':').length === 3;
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);

  const delayedStartMins = startMins + delayMinutes;
  const delayedEndMins = endMins + delayMinutes;

  return {
    startTime: minutesToTime(delayedStartMins, includeSeconds),
    endTime: minutesToTime(delayedEndMins, includeSeconds),
  };
}

/**
 * Pure Schedule Compilation Engine
 *
 * Merges recurring `base_schedules` with date-specific `schedule_overrides`
 * for a specific calendar date:
 *
 * 1. Resolves the day of week (1=Mon ... 7=Sun) from the target date string.
 * 2. Resolves week parity (Weekly vs Week A vs Week B).
 * 3. Filters out unselected/muted courses (where `is_active === false` or `is_muted === true`).
 * 4. Merges recurring blocks with date-specific overrides (status, delay, room move, cancellation).
 * 5. Injects ad-hoc makeup sessions (`base_schedule_id === null` or `is_makeup === true`).
 * 6. Sorts the compiled agenda chronologically by effective start time.
 *
 * @param options Compilation options and data collections
 * @returns Chronologically sorted array of CompiledScheduleItem
 */
export function compileDailySchedule(
  options: CompileDailyScheduleOptions
): CompiledScheduleItem[] {
  const {
    targetDate,
    baseSchedules = [],
    overrides = [],
    activeCourses = [],
    targetParity,
    anchorDate,
    cycleMode = 'standard_weekly',
    includeCancelled = true,
  } = options;

  if (!targetDate) {
    return [];
  }

  // 1. Resolve Day of Week from target date (1 = Monday, ..., 7 = Sunday)
  const targetDayOfWeek = getDayOfWeekFromDateString(targetDate);

  // 2. Resolve Week Parity (Weekly vs Week A vs Week B)
  const activeParity: WeekParity =
    targetParity ?? calculateWeekParity(targetDate, anchorDate, cycleMode);

  // 3. Build lookup set of inactive course IDs for Bundle & Toggle filtering
  const inactiveCourseIds = new Set<string>();
  for (const c of activeCourses) {
    if (c.is_active === false || c.is_muted === true) {
      inactiveCourseIds.add(c.id);
    }
  }

  const isCourseInactive = (
    courseId?: string | null,
    courseObj?: (Tables<'courses'> & { is_active?: boolean; is_muted?: boolean }) | null
  ): boolean => {
    if (courseObj && (courseObj.is_active === false || courseObj.is_muted === true)) {
      return true;
    }
    if (courseId && inactiveCourseIds.has(courseId)) {
      return true;
    }
    return false;
  };

  // 4. Filter overrides specific to the target calendar date
  const dateOverrides = overrides.filter((o) => o.override_date === targetDate);

  // Map overrides by base_schedule_id for fast O(1) lookup
  const baseOverrideMap = new Map<string, ScheduleOverrideRow>();
  const adHocMakeups: ScheduleOverrideRow[] = [];

  for (const o of dateOverrides) {
    if (o.base_schedule_id) {
      baseOverrideMap.set(o.base_schedule_id, o);
    } else if (o.is_makeup || !o.base_schedule_id) {
      adHocMakeups.push(o);
    }
  }

  const compiledItems: CompiledScheduleItem[] = [];

  // 5. Process Recurring Base Schedule blocks for this weekday
  for (const base of baseSchedules) {
    if (base.day_of_week !== targetDayOfWeek) {
      continue;
    }

    const override = baseOverrideMap.get(base.id);

    // If there is no explicit override for this date, enforce week parity filter
    if (!override && !matchesParity(base.frequency, activeParity)) {
      continue;
    }

    // General sessions (breaks, prayers, meetings) without course binding are always visible
    const isGeneral =
      base.session_type === 'break' ||
      base.session_type === 'prayer' ||
      base.session_type === 'meeting';

    if (!isGeneral && isCourseInactive(base.course_id, base.course)) {
      continue;
    }

    // Extract status and exception fields
    const rawStatus = (override?.status as ScheduleOverrideStatus) || 'scheduled';
    const status: ScheduleOverrideStatus = [
      'scheduled',
      'started',
      'delayed',
      'cancelled',
      'room_moved',
      'instructor_away',
    ].includes(rawStatus)
      ? rawStatus
      : 'scheduled';

    const isCancelled = status === 'cancelled';
    if (isCancelled && !includeCancelled) {
      continue;
    }

    const delayMinutes = override?.delay_minutes ?? 0;
    const { startTime: effectiveStart, endTime: effectiveEnd } = applyDelayToTimes(
      base.start_time,
      base.end_time,
      delayMinutes
    );

    const hasNewRoom = typeof override?.new_room === 'string' && override.new_room.trim().length > 0;
    const effectiveRoom = hasNewRoom ? (override!.new_room as string).trim() : base.room;
    const durationMins = calculateDurationMinutes(effectiveStart, effectiveEnd);

    compiledItems.push({
      id: base.id,
      base_schedule_id: base.id,
      override_id: override?.id ?? null,
      section_id: override?.section_id ?? '',
      course_id: base.course_id,
      course: base.course ?? null,
      date: targetDate,
      session_type: base.session_type,
      frequency: base.frequency,
      instructor: base.instructor ?? null,

      original_start_time: base.start_time,
      original_end_time: base.end_time,
      start_time: effectiveStart,
      end_time: effectiveEnd,
      duration_minutes: durationMins,

      original_room: base.room ?? null,
      room: effectiveRoom ?? null,

      status,
      delay_minutes: delayMinutes,
      custom_note: override?.custom_note ?? null,
      is_makeup: false,
      is_cancelled: isCancelled,
      color_override: base.color_override ?? null,

      is_delayed: status === 'delayed' || delayMinutes > 0,
      is_room_moved: status === 'room_moved' || hasNewRoom,
      has_override: !!override,
    });
  }

  // 6. Process Ad-Hoc Makeup Sessions for this date
  for (const makeup of adHocMakeups) {
    if (isCourseInactive(makeup.course_id, makeup.course)) {
      continue;
    }

    const rawStatus = (makeup.status as ScheduleOverrideStatus) || 'scheduled';
    const status: ScheduleOverrideStatus = [
      'scheduled',
      'started',
      'delayed',
      'cancelled',
      'room_moved',
      'instructor_away',
    ].includes(rawStatus)
      ? rawStatus
      : 'scheduled';

    const isCancelled = status === 'cancelled';
    if (isCancelled && !includeCancelled) {
      continue;
    }

    const baseStart = makeup.makeup_start_time || '09:00:00';
    const baseEnd = makeup.makeup_end_time || '10:00:00';
    const delayMinutes = makeup.delay_minutes ?? 0;

    const { startTime: effectiveStart, endTime: effectiveEnd } = applyDelayToTimes(
      baseStart,
      baseEnd,
      delayMinutes
    );

    const durationMins = calculateDurationMinutes(effectiveStart, effectiveEnd);

    compiledItems.push({
      id: makeup.id,
      base_schedule_id: null,
      override_id: makeup.id,
      section_id: makeup.section_id,
      course_id: makeup.course_id,
      course: makeup.course ?? null,
      date: targetDate,
      session_type: 'makeup',
      frequency: 'weekly',
      instructor: null,

      original_start_time: baseStart,
      original_end_time: baseEnd,
      start_time: effectiveStart,
      end_time: effectiveEnd,
      duration_minutes: durationMins,

      original_room: null,
      room: typeof makeup.new_room === 'string' ? makeup.new_room.trim() : (makeup.new_room ?? null),

      status,
      delay_minutes: delayMinutes,
      custom_note: makeup.custom_note ?? null,
      is_makeup: true,
      is_cancelled: isCancelled,
      color_override: null,

      is_delayed: status === 'delayed' || delayMinutes > 0,
      is_room_moved: false,
      has_override: true,
    });
  }

  // 7. Chronological Sort by effective start time (scalar minutes from midnight)
  compiledItems.sort((a, b) => {
    const aStart = timeToMinutes(a.start_time);
    const bStart = timeToMinutes(b.start_time);
    if (aStart !== bStart) {
      return aStart - bStart;
    }

    const aEnd = timeToMinutes(a.end_time);
    const bEnd = timeToMinutes(b.end_time);
    if (aEnd !== bEnd) {
      return aEnd - bEnd;
    }

    return a.id.localeCompare(b.id);
  });

  return compiledItems;
}
