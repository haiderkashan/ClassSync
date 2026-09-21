import {
  isWithinQuietHours,
  parseTimeToSeconds,
  determineNotificationUrgency,
  calculateNextQuietHoursEnd,
  evaluateRecipientNotificationPlan,
  RecipientNotificationSettings,
  NotificationEventPayload,
} from './quietHoursEvaluator';

describe('Quiet Hours & Urgency Evaluation Engine', () => {
  describe('parseTimeToSeconds', () => {
    it('parses "HH:mm" strings accurately', () => {
      expect(parseTimeToSeconds('00:00')).toBe(0);
      expect(parseTimeToSeconds('07:00')).toBe(7 * 3600);
      expect(parseTimeToSeconds('22:30')).toBe(22 * 3600 + 30 * 60);
      expect(parseTimeToSeconds('23:59')).toBe(23 * 3600 + 59 * 60);
    });

    it('parses "HH:mm:ss" strings accurately', () => {
      expect(parseTimeToSeconds('00:00:00')).toBe(0);
      expect(parseTimeToSeconds('07:00:00')).toBe(25200);
      expect(parseTimeToSeconds('21:59:59')).toBe(21 * 3600 + 59 * 60 + 59);
      expect(parseTimeToSeconds('22:00:00')).toBe(79200);
    });

    it('parses ISO strings containing time parts', () => {
      expect(parseTimeToSeconds('2026-09-21T14:30:00.000Z')).toBe(14 * 3600 + 30 * 60);
    });

    it('parses JavaScript Date objects accurately', () => {
      const date = new Date(2026, 8, 21, 10, 15, 30);
      expect(parseTimeToSeconds(date)).toBe(10 * 3600 + 15 * 60 + 30);
    });

    it('throws on invalid time string formats', () => {
      expect(() => parseTimeToSeconds('invalid-time')).toThrow();
    });
  });

  describe('isWithinQuietHours - Standard Day Intervals (S < E)', () => {
    const startTime = '13:00:00';
    const endTime = '15:00:00';

    it('returns false before start time', () => {
      expect(isWithinQuietHours('12:59:59', startTime, endTime)).toBe(false);
      expect(isWithinQuietHours('09:00:00', startTime, endTime)).toBe(false);
    });

    it('returns true at exact start boundary (inclusive)', () => {
      expect(isWithinQuietHours('13:00:00', startTime, endTime)).toBe(true);
    });

    it('returns true during the middle of the interval', () => {
      expect(isWithinQuietHours('14:00:00', startTime, endTime)).toBe(true);
      expect(isWithinQuietHours('14:59:59', startTime, endTime)).toBe(true);
    });

    it('returns false at exact end boundary (exclusive)', () => {
      expect(isWithinQuietHours('15:00:00', startTime, endTime)).toBe(false);
    });

    it('returns false after end boundary', () => {
      expect(isWithinQuietHours('15:00:01', startTime, endTime)).toBe(false);
      expect(isWithinQuietHours('20:00:00', startTime, endTime)).toBe(false);
    });
  });

  describe('isWithinQuietHours - Midnight-Spanning Intervals (S > E)', () => {
    const startTime = '22:00:00'; // 10:00 PM
    const endTime = '07:00:00';   // 07:00 AM

    it('returns false before start time in the evening', () => {
      expect(isWithinQuietHours('21:59:59', startTime, endTime)).toBe(false);
      expect(isWithinQuietHours('20:30:00', startTime, endTime)).toBe(false);
      expect(isWithinQuietHours('12:00:00', startTime, endTime)).toBe(false);
    });

    it('returns true at exact start boundary (inclusive)', () => {
      expect(isWithinQuietHours('22:00:00', startTime, endTime)).toBe(true);
    });

    it('returns true late night before midnight', () => {
      expect(isWithinQuietHours('22:00:01', startTime, endTime)).toBe(true);
      expect(isWithinQuietHours('23:00:00', startTime, endTime)).toBe(true);
      expect(isWithinQuietHours('23:59:59', startTime, endTime)).toBe(true);
    });

    it('returns true across midnight (00:00:00)', () => {
      expect(isWithinQuietHours('00:00:00', startTime, endTime)).toBe(true);
    });

    it('returns true in the early morning before end time', () => {
      expect(isWithinQuietHours('00:00:01', startTime, endTime)).toBe(true);
      expect(isWithinQuietHours('03:30:00', startTime, endTime)).toBe(true);
      expect(isWithinQuietHours('06:59:59', startTime, endTime)).toBe(true);
    });

    it('returns false at exact end boundary (exclusive: 07:00:00)', () => {
      expect(isWithinQuietHours('07:00:00', startTime, endTime)).toBe(false);
    });

    it('returns false after morning end time', () => {
      expect(isWithinQuietHours('07:00:01', startTime, endTime)).toBe(false);
      expect(isWithinQuietHours('08:30:00', startTime, endTime)).toBe(false);
      expect(isWithinQuietHours('18:00:00', startTime, endTime)).toBe(false);
    });

    it('returns false when start and end times are identical (0 duration)', () => {
      expect(isWithinQuietHours('22:00:00', '22:00:00', '22:00:00')).toBe(false);
      expect(isWithinQuietHours('10:00:00', '10:00:00', '10:00:00')).toBe(false);
    });
  });

  describe('determineNotificationUrgency - Urgency Classification Matrix', () => {
    it('classifies Class Cancellations, Delays, and Room Moves as CRITICAL', () => {
      expect(determineNotificationUrgency('cancellation')).toBe('CRITICAL');
      expect(determineNotificationUrgency('class_cancellation')).toBe('CRITICAL');
      expect(determineNotificationUrgency('delay')).toBe('CRITICAL');
      expect(determineNotificationUrgency('class_delay')).toBe('CRITICAL');
      expect(determineNotificationUrgency('room_move')).toBe('CRITICAL');
      expect(determineNotificationUrgency('room_change')).toBe('CRITICAL');

      // Schedule override events
      expect(determineNotificationUrgency('schedule_override', 'cancelled')).toBe('CRITICAL');
      expect(determineNotificationUrgency('schedule_override', 'delayed')).toBe('CRITICAL');
      expect(determineNotificationUrgency('schedule_override', 'room_move')).toBe('CRITICAL');
      expect(determineNotificationUrgency('schedule_override', 'rescheduled')).toBe('CRITICAL');
    });

    it('classifies Academic/Cohort Tasks and Announcements as NORMAL', () => {
      expect(determineNotificationUrgency('academic_task')).toBe('NORMAL');
      expect(determineNotificationUrgency('cohort_task')).toBe('NORMAL');
      expect(determineNotificationUrgency('task')).toBe('NORMAL');
      expect(determineNotificationUrgency('announcement')).toBe('NORMAL');
      expect(determineNotificationUrgency('broadcast')).toBe('NORMAL');
      expect(determineNotificationUrgency('assignment')).toBe('NORMAL');
      expect(determineNotificationUrgency('exam')).toBe('NORMAL');
      expect(determineNotificationUrgency('quiz')).toBe('NORMAL');
    });

    it('classifies routine logs and reminders as LOW', () => {
      expect(determineNotificationUrgency('attendance')).toBe('LOW');
      expect(determineNotificationUrgency('reminder')).toBe('LOW');
      expect(determineNotificationUrgency('routine')).toBe('LOW');
    });

    it('falls back to NORMAL for unrecognized categories', () => {
      expect(determineNotificationUrgency('unknown_event')).toBe('NORMAL');
    });
  });

  describe('calculateNextQuietHoursEnd', () => {
    it('calculates morning delivery time when current time is late night before midnight', () => {
      // 2026-09-21 23:30:00 UTC
      const current = new Date(Date.UTC(2026, 8, 21, 23, 30, 0));
      const nextEnd = calculateNextQuietHoursEnd(current, '07:00:00', 'UTC');

      // Expected: 2026-09-22 07:00:00 UTC
      expect(nextEnd.toISOString()).toBe('2026-09-22T07:00:00.000Z');
    });

    it('calculates morning delivery time when current time is early morning after midnight', () => {
      // 2026-09-22 04:15:00 UTC
      const current = new Date(Date.UTC(2026, 8, 22, 4, 15, 0));
      const nextEnd = calculateNextQuietHoursEnd(current, '07:00:00', 'UTC');

      // Expected: 2026-09-22 07:00:00 UTC (today morning)
      expect(nextEnd.toISOString()).toBe('2026-09-22T07:00:00.000Z');
    });

    it('calculates daytime quiet hours end within the same day', () => {
      // 2026-09-22 13:30:00 UTC, quiet hours end at 15:00:00
      const current = new Date(Date.UTC(2026, 8, 22, 13, 30, 0));
      const nextEnd = calculateNextQuietHoursEnd(current, '15:00:00', 'UTC');

      // Expected: 2026-09-22 15:00:00 UTC
      expect(nextEnd.toISOString()).toBe('2026-09-22T15:00:00.000Z');
    });
  });

  describe('evaluateRecipientNotificationPlan', () => {
    const defaultSettings: RecipientNotificationSettings = {
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00:00',
      quiet_hours_end: '07:00:00',
      bypass_for_urgent: true,
      timezone: 'UTC',
    };

    it('sends immediately when quiet hours are disabled by recipient', () => {
      const settings: RecipientNotificationSettings = {
        ...defaultSettings,
        quiet_hours_enabled: false,
      };

      const payload: NotificationEventPayload = {
        eventCategory: 'cohort_task',
        timestamp: '2026-09-21T23:30:00.000Z', // In quiet hours if enabled
      };

      const plan = evaluateRecipientNotificationPlan(settings, payload);
      expect(plan.action).toBe('SEND_IMMEDIATELY');
      expect(plan.isWithinQuietHours).toBe(false);
      expect(plan.scheduledFor).toBeNull();
    });

    it('sends immediately when recipient is currently outside quiet hours', () => {
      const payload: NotificationEventPayload = {
        eventCategory: 'cohort_task',
        timestamp: '2026-09-21T14:30:00.000Z', // 14:30 UTC: Outside quiet hours
      };

      const plan = evaluateRecipientNotificationPlan(defaultSettings, payload);
      expect(plan.action).toBe('SEND_IMMEDIATELY');
      expect(plan.isWithinQuietHours).toBe(false);
    });

    it('bypasses quiet hours and sends immediately for CRITICAL events when bypass_for_urgent is true', () => {
      const payload: NotificationEventPayload = {
        eventCategory: 'schedule_override',
        eventStatus: 'cancelled',
        timestamp: '2026-09-21T23:30:00.000Z', // In quiet hours
      };

      const plan = evaluateRecipientNotificationPlan(defaultSettings, payload);
      expect(plan.action).toBe('SEND_IMMEDIATELY');
      expect(plan.urgency).toBe('CRITICAL');
      expect(plan.isWithinQuietHours).toBe(true);
      expect(plan.scheduledFor).toBeNull();
    });

    it('queues CRITICAL events if recipient explicitly disabled bypass_for_urgent', () => {
      const strictSettings: RecipientNotificationSettings = {
        ...defaultSettings,
        bypass_for_urgent: false,
      };

      const payload: NotificationEventPayload = {
        eventCategory: 'cancellation',
        timestamp: '2026-09-21T23:30:00.000Z', // In quiet hours
      };

      const plan = evaluateRecipientNotificationPlan(strictSettings, payload);
      expect(plan.action).toBe('QUEUE_FOR_LATER');
      expect(plan.urgency).toBe('CRITICAL');
      expect(plan.isWithinQuietHours).toBe(true);
      expect(plan.scheduledFor).toBe('2026-09-22T07:00:00.000Z');
    });

    it('queues NORMAL events (cohort tasks, announcements) during quiet hours for 07:00 AM dispatch', () => {
      const payload: NotificationEventPayload = {
        eventCategory: 'cohort_task',
        timestamp: '2026-09-21T23:30:00.000Z', // In quiet hours
      };

      const plan = evaluateRecipientNotificationPlan(defaultSettings, payload);
      expect(plan.action).toBe('QUEUE_FOR_LATER');
      expect(plan.urgency).toBe('NORMAL');
      expect(plan.isWithinQuietHours).toBe(true);
      expect(plan.scheduledFor).toBe('2026-09-22T07:00:00.000Z');
    });

    it('mutes LOW priority events (attendance reminders) during quiet hours', () => {
      const payload: NotificationEventPayload = {
        eventCategory: 'attendance',
        timestamp: '2026-09-21T23:30:00.000Z', // In quiet hours
      };

      const plan = evaluateRecipientNotificationPlan(defaultSettings, payload);
      expect(plan.action).toBe('MUTE');
      expect(plan.urgency).toBe('LOW');
      expect(plan.isWithinQuietHours).toBe(true);
      expect(plan.scheduledFor).toBeNull();
    });
  });
});
