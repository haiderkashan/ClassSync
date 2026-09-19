/**
 * ClassSync Time & Duration Utilities
 *
 * Provides pure mathematical time conversions, 12-hour/24-hour formatting,
 * and duration arithmetic for the recurring timetable engine.
 */

/**
 * Converts a time string ("HH:mm" or "HH:mm:ss") to scalar minutes from midnight [0..1439].
 *
 * @param timeStr Time string in 24-hour format
 * @returns Integer minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    return 0;
  }

  const parts = timeStr.trim().split(':');
  if (parts.length < 2) {
    return 0;
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) {
    return 0;
  }

  return Math.max(0, Math.min(1439, hours * 60 + minutes));
}

/**
 * Converts scalar minutes from midnight to a 24-hour time string ("HH:mm" or "HH:mm:ss").
 *
 * @param minutes Scalar minutes from midnight
 * @param includeSeconds Whether to append ":00"
 * @returns Formatted 24-hour string (e.g. "09:30" or "09:30:00")
 */
export function minutesToTime(minutes: number, includeSeconds: boolean = false): string {
  const normalized = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = mins.toString().padStart(2, '0');

  return includeSeconds ? `${hh}:${mm}:00` : `${hh}:${mm}`;
}

/**
 * Formats a 24-hour time string ("HH:mm" or "HH:mm:ss") to a human-friendly 12-hour string.
 *
 * Examples:
 * - "09:30:00" -> "9:30 AM"
 * - "14:05:00" -> "2:05 PM"
 * - "00:00:00" -> "12:00 AM"
 * - "12:00:00" -> "12:00 PM"
 */
export function formatTime12Hour(timeStr: string): string {
  if (!timeStr) return '';

  const totalMinutes = timeToMinutes(timeStr);
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const mm = minutes.toString().padStart(2, '0');

  return `${hours12}:${mm} ${period}`;
}

/**
 * Calculates duration in minutes between a start time and an end time.
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  return Math.max(0, endMins - startMins);
}

/**
 * Formats duration minutes into a compact human-friendly badge.
 *
 * Examples:
 * - 50 -> "50m"
 * - 60 -> "1h"
 * - 90 -> "1h 30m"
 * - 120 -> "2h"
 * - 150 -> "2h 30m"
 */
export function formatDuration(durationMinutes: number): string {
  if (durationMinutes <= 0) return '0m';

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Adds an integer duration (in minutes) to a time string and returns the new "HH:mm" string.
 *
 * @param startTime Base time string (e.g. "09:30")
 * @param minutesToAdd Minutes to add (e.g. 90)
 * @returns Resulting "HH:mm" string (e.g. "11:00")
 */
export function addMinutesToTime(startTime: string, minutesToAdd: number): string {
  const startMins = timeToMinutes(startTime);
  const newMins = (startMins + minutesToAdd) % 1440;
  return minutesToTime(newMins);
}

/**
 * Returns the weekday name for a 1-based day integer (1 = Monday, 7 = Sunday).
 */
export function getDayName(dayOfWeek: number, short: boolean = false): string {
  const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const index = dayOfWeek - 1;
  if (index < 0 || index > 6) {
    return '';
  }

  return short ? DAYS_SHORT[index] : DAYS_FULL[index];
}

/**
 * Validates that both start and end time are valid and end time strictly succeeds start time.
 */
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  return endMins > startMins;
}
