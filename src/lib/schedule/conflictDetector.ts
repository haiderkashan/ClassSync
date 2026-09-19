import { timeToMinutes, formatTime12Hour } from './timeUtils';

export type ScheduleFrequency = 'weekly' | 'biweekly_week_a' | 'biweekly_week_b';

export interface ScheduleBlockInterval {
  id?: string;
  courseId?: string;
  courseTitle?: string;
  courseCode?: string;
  dayOfWeek: number; // 1 (Mon) .. 7 (Sun)
  startTime: string; // "HH:mm" or "HH:mm:ss"
  endTime: string;   // "HH:mm" or "HH:mm:ss"
  frequency?: ScheduleFrequency | string;
  room?: string | null;
  sessionType?: string;
}

export interface ConflictItem {
  conflictingBlock: ScheduleBlockInterval;
  reason: 'time_overlap' | 'room_collision';
  message: string;
}

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflicts: ConflictItem[];
}

/**
 * Checks whether two recurring schedule frequencies can coincide in the same calendar week.
 *
 * Rules:
 * - 'weekly' coincides with all frequencies ('weekly', 'biweekly_week_a', 'biweekly_week_b').
 * - 'biweekly_week_a' coincides with 'weekly' and 'biweekly_week_a'.
 * - 'biweekly_week_b' coincides with 'weekly' and 'biweekly_week_b'.
 * - 'biweekly_week_a' and 'biweekly_week_b' are MUTUALLY EXCLUSIVE (run on alternating weeks).
 */
export function areFrequenciesOverlapping(
  freqA: ScheduleFrequency | string = 'weekly',
  freqB: ScheduleFrequency | string = 'weekly'
): boolean {
  const fA = freqA || 'weekly';
  const fB = freqB || 'weekly';

  if (fA === 'weekly' || fB === 'weekly') {
    return true;
  }

  return fA === fB;
}

/**
 * Evaluates whether two intervals on the same day overlap in time.
 *
 * Formula:
 * max(startA, startB) < min(endA, endB)
 *
 * Note: Strict inequality (<) ensures back-to-back classes (e.g. 09:00-10:00 and 10:00-11:00)
 * do NOT collide.
 */
export function areIntervalsOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);

  // If either interval is invalid or zero-duration, no overlap
  if (eA <= sA || eB <= sB) {
    return false;
  }

  const overlapStart = Math.max(sA, sB);
  const overlapEnd = Math.min(eA, eB);

  return overlapStart < overlapEnd;
}

/**
 * Detects schedule and room conflicts between a candidate class block and a set of existing blocks.
 *
 * @param candidate The block being added or edited
 * @param existingBlocks List of currently scheduled blocks for the cohort section
 * @returns ConflictDetectionResult with hasConflict flag and human-readable diagnostics
 */
export function detectScheduleConflicts(
  candidate: ScheduleBlockInterval,
  existingBlocks: ScheduleBlockInterval[]
): ConflictDetectionResult {
  const conflicts: ConflictItem[] = [];

  if (!candidate || !existingBlocks || existingBlocks.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  for (const existing of existingBlocks) {
    // 1. Skip comparing against self when editing an existing block
    if (candidate.id && existing.id && candidate.id === existing.id) {
      continue;
    }

    // 2. Must be on the same day of the week to conflict
    if (candidate.dayOfWeek !== existing.dayOfWeek) {
      continue;
    }

    // 3. Frequencies must be overlapping (e.g. Week A vs Week B do not clash)
    if (!areFrequenciesOverlapping(candidate.frequency, existing.frequency)) {
      continue;
    }

    // 4. Check time interval intersection
    const isTimeOverlapping = areIntervalsOverlapping(
      candidate.startTime,
      candidate.endTime,
      existing.startTime,
      existing.endTime
    );

    if (isTimeOverlapping) {
      const existingName = existing.courseTitle || existing.courseCode || 'Another class';
      const timeWindow = `${formatTime12Hour(existing.startTime)} - ${formatTime12Hour(existing.endTime)}`;

      // Check if there is also an identical room collision
      const candidateRoom = candidate.room?.trim().toLowerCase();
      const existingRoom = existing.room?.trim().toLowerCase();
      const hasRoomCollision = !!candidateRoom && !!existingRoom && candidateRoom === existingRoom;

      if (hasRoomCollision) {
        conflicts.push({
          conflictingBlock: existing,
          reason: 'room_collision',
          message: `Room "${existing.room}" double-booked with ${existingName} (${timeWindow})`,
        });
      } else {
        conflicts.push({
          conflictingBlock: existing,
          reason: 'time_overlap',
          message: `Schedule overlaps with ${existingName} (${timeWindow})`,
        });
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}
