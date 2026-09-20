// ============================================================================
// ClassSync Attendance & Bunk Calculator Pure Math Engine
// File: src/lib/attendance/bunkCalculator.ts
// Description: Pure mathematical formulas for attendance percentage, allowable
//              skips ("bunks"), and recovery classes needed to maintain or reach
//              a target threshold (default 75%). Handles edge cases, zero-classes,
//              and floating-point stability.
// ============================================================================

import { Database } from '../../types/database.types';
import { getLocalDateString } from '../schedule/calendarUtils';
import { timeToMinutes } from '../schedule/timeUtils';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];

export interface BunkCalculatorOptions {
  /** Target attendance ratio between 0.0 and 1.0. Default is 0.75 (75%). */
  threshold?: number;
  /** Credit given for 'late' status (between 0.0 and 1.0). Default is 1.0 (full credit). */
  lateCredit?: number;
  /** Whether 'excused' classes are counted as attended (true) or excluded from total (false). Default is false (excluded from total held). */
  countExcusedAsAttended?: boolean;
}

export interface AttendanceMetrics {
  /** Total academic sessions held / considered */
  totalHeld: number;
  /** Weighted attended sessions (present + weighted late + counted excused) */
  attended: number;
  /** Count of sessions marked present */
  presentCount: number;
  /** Count of sessions marked absent */
  absentCount: number;
  /** Count of sessions marked late */
  lateCount: number;
  /** Count of sessions marked excused */
  excusedCount: number;
  /** Attendance percentage (0 to 100), rounded to 1 decimal place */
  percentage: number;
  /** Unrounded exact percentage (0 to 100) */
  exactPercentage: number;
  /** Configured threshold ratio (e.g., 0.75 for 75%) */
  threshold: number;
  /** Whether the current percentage meets or exceeds threshold */
  isSafe: boolean;
  /**
   * Number of upcoming consecutive classes the student can safely skip
   * without dropping below the target threshold.
   * Formula: floor( (P - R * T) / R ) when percentage >= threshold.
   */
  skipsAllowed: number;
  /**
   * Number of upcoming consecutive classes the student must attend to reach
   * or restore the target threshold.
   * Formula: ceil( (R * T - P) / (1 - R) ) when percentage < threshold.
   */
  recoveryNeeded: number;
  /** Visual theme status */
  status: 'safe' | 'warning' | 'danger';
  /** Human-readable status message for student */
  statusMessage: string;
}

const EPSILON = 1e-9;

/**
 * Calculates attendance metrics and bunk/recovery allowances from raw counts.
 *
 * Mathematical derivation:
 * Let T = total classes held, P = attended classes, R = threshold ratio (e.g. 0.75).
 *
 * 1. Skips Allowed (when P / T >= R):
 *    If student skips k future classes, new attendance is P / (T + k).
 *    Condition: P / (T + k) >= R => P >= R*T + R*k => k <= (P - R*T) / R.
 *    Max integer skips = floor( (P - R*T) / R ).
 *
 * 2. Recovery Needed (when P / T < R):
 *    If student attends m consecutive future classes, new attendance is (P + m) / (T + m).
 *    Condition: (P + m) / (T + m) >= R => P + m >= R*T + R*m => m*(1 - R) >= R*T - P => m >= (R*T - P) / (1 - R).
 *    Min integer classes to attend = ceil( (R*T - P) / (1 - R) ).
 */
export function calculateAttendanceMetrics(
  totalHeld: number,
  attended: number,
  options?: BunkCalculatorOptions,
  rawCounts?: { present?: number; absent?: number; late?: number; excused?: number }
): AttendanceMetrics {
  const threshold = options?.threshold ?? 0.75;
  const safeThreshold = Math.min(Math.max(threshold, 0.01), 0.99); // Bound between 1% and 99%

  const presentCount = rawCounts?.present ?? Math.floor(attended);
  const absentCount = rawCounts?.absent ?? Math.max(0, totalHeld - Math.floor(attended));
  const lateCount = rawCounts?.late ?? 0;
  const excusedCount = rawCounts?.excused ?? 0;

  // Edge case: No classes have been held yet
  if (totalHeld <= 0) {
    return {
      totalHeld: 0,
      attended: 0,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      percentage: 100,
      exactPercentage: 100,
      threshold: safeThreshold,
      isSafe: true,
      skipsAllowed: 0,
      recoveryNeeded: 0,
      status: 'safe',
      statusMessage: 'No classes held yet. Perfect attendance record.',
    };
  }

  const exactPercentage = (attended / totalHeld) * 100;
  // Round percentage to 1 decimal place (e.g. 75.0, 83.3)
  const percentage = Math.round(exactPercentage * 10) / 10;

  // Threshold comparison with epsilon tolerance to eliminate floating point issues (e.g. 0.75 * 4 = 3)
  const differenceFromTarget = attended - safeThreshold * totalHeld;
  const isSafe = differenceFromTarget >= -EPSILON;

  let skipsAllowed = 0;
  let recoveryNeeded = 0;
  let status: 'safe' | 'warning' | 'danger';
  let statusMessage = '';

  if (isSafe) {
    recoveryNeeded = 0;
    // Skips allowed: floor( (P - R * T) / R )
    // Epsilon added to numerator to prevent floating point inaccuracies like 0.999999999999 from flooring down
    const rawSkips = (differenceFromTarget + EPSILON) / safeThreshold;
    skipsAllowed = Math.max(0, Math.floor(rawSkips));

    if (skipsAllowed > 0) {
      status = 'safe';
      statusMessage = `You can safely miss ${skipsAllowed} upcoming ${skipsAllowed === 1 ? 'class' : 'classes'}.`;
    } else {
      status = 'warning';
      statusMessage = 'On the threshold boundary. Missing the next class will put you at risk.';
    }
  } else {
    skipsAllowed = 0;
    // Recovery needed: ceil( (R * T - P) / (1 - R) )
    // Epsilon subtracted to avoid ceiling up due to infinitesimal floating point residues
    const deficit = safeThreshold * totalHeld - attended;
    const rawRecovery = (deficit - EPSILON) / (1 - safeThreshold);
    recoveryNeeded = Math.max(1, Math.ceil(rawRecovery));

    status = 'danger';
    statusMessage = `Attend the next ${recoveryNeeded} consecutive ${recoveryNeeded === 1 ? 'class' : 'classes'} to restore ${Math.round(safeThreshold * 100)}% attendance.`;
  }

  return {
    totalHeld,
    attended,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    percentage,
    exactPercentage,
    threshold: safeThreshold,
    isSafe,
    skipsAllowed,
    recoveryNeeded,
    status,
    statusMessage,
  };
}

/**
 * Calculates attendance metrics directly from an array of attendance log records for a course.
 */
export function calculateCourseAttendance(
  logs: AttendanceLog[],
  options?: BunkCalculatorOptions
): AttendanceMetrics {
  const lateCredit = options?.lateCredit ?? 1.0;
  const countExcusedAsAttended = options?.countExcusedAsAttended ?? false;

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;

  for (const log of logs) {
    switch (log.status) {
      case 'present':
        presentCount++;
        break;
      case 'absent':
        absentCount++;
        break;
      case 'late':
        lateCount++;
        break;
      case 'excused':
        excusedCount++;
        break;
    }
  }

  // Determine total held sessions
  // If excused is excluded from total, totalHeld = present + absent + late
  // If countExcusedAsAttended is true, excused count is added to total and attended
  const totalHeld = countExcusedAsAttended
    ? presentCount + absentCount + lateCount + excusedCount
    : presentCount + absentCount + lateCount;

  const attended = countExcusedAsAttended
    ? presentCount + lateCount * lateCredit + excusedCount
    : presentCount + lateCount * lateCredit;

  return calculateAttendanceMetrics(
    totalHeld,
    attended,
    options,
    { present: presentCount, absent: absentCount, late: lateCount, excused: excusedCount }
  );
}

/**
 * Convenience helper to simulate what the attendance percentage would become
 * if the student attends or skips N upcoming sessions.
 */
export function simulateFutureAttendance(
  currentMetrics: AttendanceMetrics,
  futureClassesToAttend: number,
  futureClassesToSkip: number
): { projectedTotal: number; projectedAttended: number; projectedPercentage: number } {
  const projectedTotal = currentMetrics.totalHeld + futureClassesToAttend + futureClassesToSkip;
  const projectedAttended = currentMetrics.attended + futureClassesToAttend;

  if (projectedTotal <= 0) {
    return { projectedTotal: 0, projectedAttended: 0, projectedPercentage: 100 };
  }

  const exact = (projectedAttended / projectedTotal) * 100;
  return {
    projectedTotal,
    projectedAttended,
    projectedPercentage: Math.round(exact * 10) / 10,
  };
}

export interface AttendanceTimeGuardResult {
  isEligible: boolean;
  reason: 'past' | 'ongoing' | 'future_today' | 'future_date';
}

/**
 * Validates whether an attendance session is eligible to be logged based on time guards.
 * Prevents the Future Logging Bug: Students cannot log attendance for upcoming classes.
 */
export function isAttendanceEligible(
  targetDateStr: string,
  startTimeStr: string,
  timezone = 'UTC',
  referenceNow = new Date()
): AttendanceTimeGuardResult {
  const todayStr = getLocalDateString(referenceNow, timezone);

  if (targetDateStr < todayStr) {
    return { isEligible: true, reason: 'past' };
  }

  if (targetDateStr > todayStr) {
    return { isEligible: false, reason: 'future_date' };
  }

  // Same calendar day: check if class start time has arrived or passed
  const currentMinutes = referenceNow.getHours() * 60 + referenceNow.getMinutes();
  const startMinutes = timeToMinutes(startTimeStr);

  if (currentMinutes >= startMinutes) {
    return { isEligible: true, reason: 'ongoing' };
  }

  return { isEligible: false, reason: 'future_today' };
}
