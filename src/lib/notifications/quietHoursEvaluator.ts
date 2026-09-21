/**
 * Quiet Hours & Urgency Evaluation Engine
 * File: src/lib/notifications/quietHoursEvaluator.ts
 *
 * Implements pure, timezone-aware interval math for Quiet Hours
 * and evaluates notification urgency for dispatch vs queuing.
 */

/**
 * Parses a time string ("HH:mm", "HH:mm:ss") or Date object into total seconds from midnight.
 * Range: 0 to 86399 seconds.
 */
export function parseTimeToSeconds(timeInput: string | Date): number {
  if (timeInput instanceof Date) {
    return (
      timeInput.getHours() * 3600 +
      timeInput.getMinutes() * 60 +
      timeInput.getSeconds()
    );
  }

  const str = timeInput.trim();
  // If ISO string containing 'T', extract the time portion
  const timePart = str.includes('T') ? str.split('T')[1].split('.')[0] : str;
  const parts = timePart.split(':');

  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  const seconds = parts[2] ? parseFloat(parts[2]) : 0;

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
    throw new Error(`Invalid time string format: "${timeInput}". Expected "HH:mm" or "HH:mm:ss".`);
  }

  return (hours % 24) * 3600 + (minutes % 60) * 60 + Math.floor(seconds % 60);
}

/**
 * Determines whether a given time falls within the configured Quiet Hours interval.
 *
 * CRITICAL MIDNIGHT-SPANNING MATH:
 * Standard interval math (S <= T < E) works only when the interval is within the same day (S < E).
 * When Quiet Hours cross midnight (e.g. 22:00:00 to 07:00:00, where S > E),
 * the time falls in Quiet Hours if it is EITHER:
 * 1. Later than or equal to start time (T >= S) [late night: 22:00 to 23:59:59], OR
 * 2. Earlier than end time (T < E) [early morning: 00:00 to 06:59:59].
 *
 * Boundary rules:
 * - Start time (S) is INCLUSIVE (at 22:00:00, Quiet Hours are active).
 * - End time (E) is EXCLUSIVE (at 07:00:00, Quiet Hours expire, allowing immediate morning dispatch).
 * - If S === E, duration is 0, returning false.
 *
 * @param currentTime Current time ("HH:mm", "HH:mm:ss", or Date)
 * @param startTime Quiet Hours start time ("HH:mm" or "HH:mm:ss")
 * @param endTime Quiet Hours end time ("HH:mm" or "HH:mm:ss")
 * @returns boolean true if currentTime falls inside Quiet Hours
 */
export function isWithinQuietHours(
  currentTime: string | Date,
  startTime: string | Date,
  endTime: string | Date
): boolean {
  const currentSec = parseTimeToSeconds(currentTime);
  const startSec = parseTimeToSeconds(startTime);
  const endSec = parseTimeToSeconds(endTime);

  // Zero-duration interval
  if (startSec === endSec) {
    return false;
  }

  // Case 1: Standard same-day interval (e.g. 13:00 to 15:00)
  if (startSec < endSec) {
    return currentSec >= startSec && currentSec < endSec;
  }

  // Case 2: Midnight-spanning interval (e.g. 22:00 to 07:00)
  // Symmetrical formula: T >= S OR T < E
  return currentSec >= startSec || currentSec < endSec;
}
