import type { WeekParity } from '@/store/useAppStore';

export interface CalendarBreak {
  id?: string;
  section_id?: string;
  break_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  freeze_cycle: boolean;
}

export type CycleNamingConvention = 'week_ab' | 'odd_even' | 'cycle_12';

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

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = parseDateParts(dateStr);
  const targetUtc = Date.UTC(y, m, d + days);
  const targetDate = new Date(targetUtc);
  const year = targetDate.getUTCFullYear();
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the 'YYYY-MM-DD' date string for Tomorrow in the specified IANA timezone.
 */
export function getTomorrowDateString(
  timezone: string = 'UTC',
  fromDate: Date = new Date()
): string {
  const todayStr = getLocalDateString(fromDate, timezone);
  return addDaysToDateString(todayStr, 1);
}

/**
 * Determines whether a given calendar date falls inside any active break.
 * Returns the matching break record if found, or null if classes are active.
 */
export function isDateInBreak(
  targetDate: string | Date,
  breaks: CalendarBreak[] = []
): CalendarBreak | null {
  const targetStr = typeof targetDate === 'string' ? targetDate.slice(0, 10) : getLocalDateString(targetDate);
  for (const b of breaks) {
    const startStr = b.start_date.slice(0, 10);
    const endStr = b.end_date.slice(0, 10);
    if (targetStr >= startStr && targetStr <= endStr) {
      return b;
    }
  }
  return null;
}

/**
 * Checks whether the instructional week (Monday to Friday) represented by a Monday timestamp
 * overlaps with any break configured to freeze the cycle.
 */
function isWeekFrozen(mondayMs: number, breaks: CalendarBreak[]): boolean {
  const d = new Date(mondayMs);
  const mondayStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

  const fridayD = new Date(mondayMs + 4 * 86400000);
  const fridayStr = `${fridayD.getUTCFullYear()}-${String(fridayD.getUTCMonth() + 1).padStart(2, '0')}-${String(fridayD.getUTCDate()).padStart(2, '0')}`;

  for (const b of breaks) {
    if (!b.freeze_cycle) continue;
    const bStart = b.start_date.slice(0, 10);
    const bEnd = b.end_date.slice(0, 10);

    // Overlap condition between week's instructional days [mondayStr, fridayStr] and break [bStart, bEnd]
    if (mondayStr <= bEnd && fridayStr >= bStart) {
      return true;
    }
  }
  return false;
}

/**
 * Calculates whether a target calendar date falls on 'biweekly_week_a' or 'biweekly_week_b'
 * based on the semester's Week A anchor date and optional frozen term breaks.
 *
 * Algorithm:
 * 1. Normalizes both dates to the Monday of their respective calendar weeks in UTC.
 * 2. Computes the elapsed calendar weeks.
 * 3. Subtracts all intervening weeks that are covered by breaks with `freeze_cycle: true`.
 * 4. Applies modular arithmetic:
 *      (effectiveWeeks % 2 === 0) => 'biweekly_week_a'
 *      (effectiveWeeks % 2 !== 0) => 'biweekly_week_b'
 *
 * 100% immune to DST shifts, leap years, and negative date ranges.
 */
export function calculateWeekParity(
  targetDate: string | Date,
  anchorDate?: string | Date | null,
  cycleMode: string = 'alternating_ab',
  breaks: CalendarBreak[] = []
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

  // Compute intervening frozen break weeks
  let frozenWeeks = 0;
  if (targetMonday > anchorMonday) {
    let currentMonday = anchorMonday + 7 * 86400000;
    while (currentMonday <= targetMonday) {
      // If an intervening week was frozen, it paused cycle toggling
      if (currentMonday < targetMonday && isWeekFrozen(currentMonday, breaks)) {
        frozenWeeks++;
      }
      currentMonday += 7 * 86400000;
    }
  } else if (targetMonday < anchorMonday) {
    let currentMonday = targetMonday;
    while (currentMonday < anchorMonday) {
      if (isWeekFrozen(currentMonday, breaks)) {
        frozenWeeks++;
      }
      currentMonday += 7 * 86400000;
    }
  }

  const effectiveWeeks = targetMonday >= anchorMonday
    ? diffWeeks - frozenWeeks
    : diffWeeks + frozenWeeks;

  // Symmetrical modulo that correctly handles negative numbers in JS
  const mod = ((effectiveWeeks % 2) + 2) % 2;
  return mod === 0 ? 'biweekly_week_a' : 'biweekly_week_b';
}

/**
 * Computes the 1-indexed instructional week number for a target date relative to semester start,
 * subtracting non-instructional weeks covered by frozen breaks.
 * Returns null if the target date is prior to semester start.
 */
export function getInstructionalWeekNumber(
  targetDate: string | Date,
  semesterStartDate?: string | Date | null,
  breaks: CalendarBreak[] = []
): number | null {
  if (!semesterStartDate) return null;

  const targetStr = typeof targetDate === 'string' ? targetDate : targetDate.toISOString();
  const startStr = typeof semesterStartDate === 'string' ? semesterStartDate : semesterStartDate.toISOString();

  const [ty, tm, td] = parseDateParts(targetStr);
  const [sy, sm, sd] = parseDateParts(startStr);

  const targetUTC = Date.UTC(ty, tm, td);
  const startUTC = Date.UTC(sy, sm, sd);

  const targetMonday = getMondayOfDate(targetUTC);
  const startMonday = getMondayOfDate(startUTC);

  if (targetMonday < startMonday) {
    return null; // Prior to semester start
  }

  const calendarWeeks = Math.floor(Math.round((targetMonday - startMonday) / 86400000) / 7);

  // Count frozen break weeks between startMonday and targetMonday
  let frozenWeeks = 0;
  let currentMonday = startMonday;
  while (currentMonday < targetMonday) {
    if (isWeekFrozen(currentMonday, breaks)) {
      frozenWeeks++;
    }
    currentMonday += 7 * 86400000;
  }

  const instructionalWeek = calendarWeeks - frozenWeeks + 1;
  return Math.max(1, instructionalWeek);
}

export interface AcademicWeekLabelOptions {
  parity: WeekParity;
  weekNumber?: number | null;
  namingConvention?: CycleNamingConvention;
  inBreak?: boolean;
  breakName?: string | null;
}

/**
 * Formats a user-friendly academic week string for headers and timeline cards
 * according to the section's naming convention (Week A/B, Odd/Even, Cycle 1/2).
 */
export function formatAcademicWeekLabel({
  parity,
  weekNumber,
  namingConvention = 'week_ab',
  inBreak = false,
  breakName = null,
}: AcademicWeekLabelOptions): string {
  if (inBreak && breakName) {
    return breakName;
  }

  let cycleTag = '';
  if (parity === 'biweekly_week_a') {
    if (namingConvention === 'odd_even') cycleTag = 'Odd Week';
    else if (namingConvention === 'cycle_12') cycleTag = 'Cycle 1';
    else cycleTag = 'Week A';
  } else if (parity === 'biweekly_week_b') {
    if (namingConvention === 'odd_even') cycleTag = 'Even Week';
    else if (namingConvention === 'cycle_12') cycleTag = 'Cycle 2';
    else cycleTag = 'Week B';
  }

  if (weekNumber) {
    if (cycleTag) {
      return `Week ${weekNumber} • ${cycleTag}`;
    }
    return `Week ${weekNumber}`;
  }

  return cycleTag || 'Weekly Schedule';
}

/**
 * Computes the remaining milliseconds until the next midnight (00:00:01 AM)
 * in the specified IANA timezone.
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
