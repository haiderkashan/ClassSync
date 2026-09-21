/**
 * Quiet Hours & Urgency Evaluation Engine
 * File: src/lib/notifications/quietHoursEvaluator.ts
 *
 * Implements pure, timezone-aware interval math for Quiet Hours,
 * Urgency Classification Matrix, and Recipient Notification Plan evaluation.
 */

export type NotificationUrgency = 'CRITICAL' | 'NORMAL' | 'LOW';

export type NotificationDispatchAction = 'SEND_IMMEDIATELY' | 'QUEUE_FOR_LATER' | 'MUTE';

export interface RecipientNotificationSettings {
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  bypass_for_urgent: boolean;
  timezone?: string | null;
}

export interface NotificationEventPayload {
  eventCategory: string;
  eventStatus?: string | null;
  timestamp?: string | Date;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  [key: string]: any;
}

export interface RecipientNotificationPlan {
  action: NotificationDispatchAction;
  urgency: NotificationUrgency;
  isWithinQuietHours: boolean;
  scheduledFor?: string | null;
  reason: string;
}

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

/**
 * Classifies the urgency of a notification based on the Event Category and Status.
 *
 * Urgency Matrix:
 * - CRITICAL: Class Cancellations, Delays, Room Moves (override quiet hours if bypass allowed).
 * - NORMAL: Academic/Cohort Tasks, Announcements (queued during quiet hours).
 * - LOW: Attendance logs, sync notifications (muted during quiet hours).
 */
export function determineNotificationUrgency(
  eventCategory: string,
  eventStatus?: string | null
): NotificationUrgency {
  const cat = (eventCategory || '').toLowerCase().trim();
  const status = (eventStatus || '').toLowerCase().trim();

  // Critical: Class Cancellations, Delays, Room Moves
  if (
    cat === 'cancellation' ||
    cat === 'class_cancellation' ||
    cat === 'delay' ||
    cat === 'class_delay' ||
    cat === 'room_move' ||
    cat === 'room_change' ||
    (cat === 'schedule_override' &&
      (status === 'cancelled' ||
        status === 'cancellation' ||
        status === 'delayed' ||
        status === 'delay' ||
        status === 'room_move' ||
        status === 'room_change' ||
        status === 'rescheduled'))
  ) {
    return 'CRITICAL';
  }

  // Normal: New Cohort Tasks, Announcements
  if (
    cat === 'academic_task' ||
    cat === 'cohort_task' ||
    cat === 'task' ||
    cat === 'announcement' ||
    cat === 'broadcast' ||
    cat === 'assignment' ||
    cat === 'exam' ||
    cat === 'quiz' ||
    cat === 'project'
  ) {
    return 'NORMAL';
  }

  // Low: Routine logs / sync
  if (
    cat === 'attendance' ||
    cat === 'reminder' ||
    cat === 'routine'
  ) {
    return 'LOW';
  }

  return 'NORMAL';
}

/**
 * Helper to extract 24-hour time string ("HH:mm:ss") in a given IANA timezone.
 */
export function getTimeInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch (e) {
    // Fallback to UTC ISO time
    return date.toISOString().split('T')[1].slice(0, 8);
  }
}

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Extracts calendar date parts of a Date in a specific timezone.
 */
function getZonedDateParts(date: Date, timezone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 0,
    month = 0,
    day = 0,
    hour = 0,
    minute = 0,
    second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    else if (part.type === 'month') month = parseInt(part.value, 10);
    else if (part.type === 'day') day = parseInt(part.value, 10);
    else if (part.type === 'hour') hour = parseInt(part.value, 10) % 24;
    else if (part.type === 'minute') minute = parseInt(part.value, 10);
    else if (part.type === 'second') second = parseInt(part.value, 10);
  }

  return { year, month, day, hour, minute, second };
}

/**
 * Calculates the exact UTC Date when the current/upcoming quiet hours window ends.
 */
export function calculateNextQuietHoursEnd(
  currentTime: Date,
  quietHoursEnd: string,
  timezone: string
): Date {
  const targetTz = timezone || 'UTC';
  const endSec = parseTimeToSeconds(quietHoursEnd);
  const endHours = Math.floor(endSec / 3600);
  const endMinutes = Math.floor((endSec % 3600) / 60);
  const endSeconds = endSec % 60;

  const currentParts = getZonedDateParts(currentTime, targetTz);
  const currentSec = currentParts.hour * 3600 + currentParts.minute * 60 + currentParts.second;

  // Determine target calendar day in recipient's timezone:
  // If currentSec < endSec, quiet hours expire today.
  // If currentSec >= endSec, quiet hours expire tomorrow.
  const targetDayOffset = currentSec >= endSec ? 1 : 0;

  // Create Date in UTC with adjusted day
  const baseUtc = new Date(
    Date.UTC(
      currentParts.year,
      currentParts.month - 1,
      currentParts.day + targetDayOffset,
      endHours,
      endMinutes,
      endSeconds
    )
  );

  // Measure offset between target timezone and UTC to produce exact timestamp
  const zonedParts = getZonedDateParts(baseUtc, targetTz);
  const zonedAsUtc = new Date(
    Date.UTC(
      zonedParts.year,
      zonedParts.month - 1,
      zonedParts.day,
      zonedParts.hour,
      zonedParts.minute,
      zonedParts.second
    )
  );
  const offsetMs = zonedAsUtc.getTime() - baseUtc.getTime();

  return new Date(baseUtc.getTime() - offsetMs);
}

/**
 * Evaluates recipient quiet hours settings and event payload to decide whether
 * to SEND_IMMEDIATELY, QUEUE_FOR_LATER, or MUTE.
 *
 * @param recipientSettings Student's quiet hours and bypass settings
 * @param eventPayload Notification details containing category, status, and optional timestamp
 */
export function evaluateRecipientNotificationPlan(
  recipientSettings: RecipientNotificationSettings | null | undefined,
  eventPayload: NotificationEventPayload
): RecipientNotificationPlan {
  const urgency = determineNotificationUrgency(
    eventPayload.eventCategory,
    eventPayload.eventStatus
  );

  // If recipient has no quiet hours configured or quiet hours are disabled
  if (!recipientSettings || !recipientSettings.quiet_hours_enabled) {
    return {
      action: 'SEND_IMMEDIATELY',
      urgency,
      isWithinQuietHours: false,
      scheduledFor: null,
      reason: 'Quiet hours are disabled by recipient',
    };
  }

  const tz = recipientSettings.timezone || 'UTC';
  const evalDate = eventPayload.timestamp
    ? new Date(eventPayload.timestamp)
    : new Date();

  const currentLocalTime = getTimeInTimezone(evalDate, tz);
  const inQuietHours = isWithinQuietHours(
    currentLocalTime,
    recipientSettings.quiet_hours_start,
    recipientSettings.quiet_hours_end
  );

  // Outside quiet hours -> Send immediately
  if (!inQuietHours) {
    return {
      action: 'SEND_IMMEDIATELY',
      urgency,
      isWithinQuietHours: false,
      scheduledFor: null,
      reason: 'Recipient is currently outside quiet hours',
    };
  }

  // Inside Quiet Hours:
  // 1. Critical alerts (Cancellations, Delays, Room Moves)
  if (urgency === 'CRITICAL') {
    if (recipientSettings.bypass_for_urgent !== false) {
      return {
        action: 'SEND_IMMEDIATELY',
        urgency,
        isWithinQuietHours: true,
        scheduledFor: null,
        reason: 'Critical urgent notification bypassed quiet hours',
      };
    } else {
      const scheduledDate = calculateNextQuietHoursEnd(
        evalDate,
        recipientSettings.quiet_hours_end,
        tz
      );
      return {
        action: 'QUEUE_FOR_LATER',
        urgency,
        isWithinQuietHours: true,
        scheduledFor: scheduledDate.toISOString(),
        reason: 'Critical alert queued because recipient disabled urgent bypass',
      };
    }
  }

  // 2. Normal alerts (Cohort Tasks, Announcements)
  if (urgency === 'NORMAL') {
    const scheduledDate = calculateNextQuietHoursEnd(
      evalDate,
      recipientSettings.quiet_hours_end,
      tz
    );
    return {
      action: 'QUEUE_FOR_LATER',
      urgency,
      isWithinQuietHours: true,
      scheduledFor: scheduledDate.toISOString(),
      reason: 'Quiet hours active; notification queued for morning dispatch',
    };
  }

  // 3. Low priority alerts (Routine logs, sync)
  return {
    action: 'MUTE',
    urgency,
    isWithinQuietHours: true,
    scheduledFor: null,
    reason: 'Quiet hours active; low priority notification muted',
  };
}
