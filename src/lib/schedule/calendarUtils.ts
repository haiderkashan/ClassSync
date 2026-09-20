import type { WeekParity } from '@/store/useAppStore';

/**
 * Parses a YYYY-MM-DD date string into [year, monthIndex, dayOfMonth].
 */
function parseDateParts(dateStr: string): [number, number, number] {
  const cleanStr = dateStr.slice(0, 10);
  const [y, m, d] = cleanStr.split('-').map(Number);
  return [y, m - 1, d];
}

/**
 * Returns the Monday timestamp for a given UTC epoch timestamp.
 * Monday is treated as day 1 of the week, Sunday as day 7.
 */
function getMondayOfDate(utcMs: number): number {
  const d = new Date(utcMs);
  const day = d.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return utcMs + diffToMonday * 86400000;
}

/**
 * Converts a Date, ISO string, or timestamp to a local 'YYYY-MM-DD' calendar date string
 * in the specified IANA timezone (e.g., 'America/New_York', 'Europe/London', 'Asia/Karachi').
 * Defaults to 'UTC' if no timezone is provided or if an invalid timezone is supplied.
 */
export function getLocalDateString(
  date: Date | string | number = new Date(),
  timezone: string = 'UTC'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    // Fallback for invalid timezone string
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Returns the 'YYYY-MM-DD' date string for Tomorrow in the specified IANA timezone.
 */
export function getTomorrowDateString(
  timezone: string = 'UTC',
  fromDate: Date = new Date()
): string {
  const todayStr = getLocalDateString(fromDate, timezone);
  const [y, m, d] = parseDateParts(todayStr);
  const tomorrowUtc = Date.UTC(y, m, d + 1);
  const tom = new Date(tomorrowUtc);
  const year = tom.getUTCFullYear();
  const month = String(tom.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tom.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates whether a target calendar date falls on 'biweekly_week_a' or 'biweekly_week_b'
 * based on the semester's Week A anchor date (the Monday of Week A).
 *
 * Algorithm:
 * 1. Normalizes both dates to the Monday of their respective calendar weeks in UTC.
 * 2. Computes the exact elapsed calendar days and divides by 7 to determine elapsed full weeks.
 * 3. Applies modular arithmetic:
 *      (diffWeeks % 2 === 0) => 'biweekly_week_a'
 *      (diffWeeks % 2 !== 0) => 'biweekly_week_b'
 *
 * This math is 100% immune to Daylight Saving Time shifts (23-hour / 25-hour days),
 * leap years, and supports dates occurring before the anchor date.
 */
export function calculateWeekParity(
  targetDate: string | Date,
  anchorDate?: string | Date | null,
  cycleMode: string = 'alternating_ab'
): WeekParity {
  if (cycleMode !== 'alternating_ab' || !anchorDate) {
    return 'weekly';
  }

  const targetStr = typeof targetDate === 'string' ? targetDate : targetDate.toISOString();
  const anchorStr = typeof anchorDate === 'string' ? anchorDate : anchorDate.toISOString();

  const [ty, tm, td] = parseDateParts(targetStr);
  const [ay, am, ad] = parseDateParts(anchorStr);

  const targetUTC = Date.UTC(ty, tm, td);
  const anchorUTC = Date.UTC(ay, am, ad);

  const targetMonday = getMondayOfDate(targetUTC);
  const anchorMonday = getMondayOfDate(anchorUTC);

  const diffDays = Math.round((targetMonday - anchorMonday) / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  // Symmetrical modulo that correctly handles negative numbers in JS
  const mod = ((diffWeeks % 2) + 2) % 2;
  return mod === 0 ? 'biweekly_week_a' : 'biweekly_week_b';
}

/**
 * Computes the remaining milliseconds until the next midnight (00:00:01 AM)
 * in the specified IANA timezone.
 *
 * Used by the live midnight watcher to schedule a zero-overhead timer that
 * refreshes the dynamic agenda when the clock strikes midnight locally.
 */
export function getMillisecondsUntilMidnight(
  timezone: string = 'UTC',
  fromDate: Date = new Date()
): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });

    const parts = formatter.formatToParts(fromDate);
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    for (const part of parts) {
      if (part.type === 'hour') hours = Number(part.value) % 24;
      if (part.type === 'minute') minutes = Number(part.value);
      if (part.type === 'second') seconds = Number(part.value);
    }

    const elapsedSecondsInDay = hours * 3600 + minutes * 60 + seconds;
    const totalSecondsInDay = 86400;
    const remainingSeconds = totalSecondsInDay - elapsedSecondsInDay;
    
    // Add 1000ms buffer so timeout fires safely 1 second inside the new calendar day
    const remainingMs = remainingSeconds * 1000 - fromDate.getMilliseconds() + 1000;
    return Math.max(remainingMs, 1000);
  } catch {
    // Fallback if timezone format fails: estimate based on UTC
    const utcHours = fromDate.getUTCHours();
    const utcMinutes = fromDate.getUTCMinutes();
    const utcSeconds = fromDate.getUTCSeconds();
    const elapsed = utcHours * 3600 + utcMinutes * 60 + utcSeconds;
    const remainingMs = (86400 - elapsed) * 1000 - fromDate.getMilliseconds() + 1000;
    return Math.max(remainingMs, 1000);
  }
}

/**
 * Resolves the 1-indexed day of week (1=Monday ... 7=Sunday) for a given YYYY-MM-DD date.
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
  const [y, m, d] = parseDateParts(dateStr);
  const utcDate = new Date(Date.UTC(y, m, d));
  const day = utcDate.getUTCDay();
  return day === 0 ? 7 : day;
}
