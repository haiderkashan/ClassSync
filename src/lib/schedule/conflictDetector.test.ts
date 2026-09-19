import {
  timeToMinutes,
  minutesToTime,
  formatTime12Hour,
  calculateDurationMinutes,
  formatDuration,
  addMinutesToTime,
  getDayName,
  isValidTimeRange,
} from './timeUtils';
import {
  areFrequenciesOverlapping,
  areIntervalsOverlapping,
  detectScheduleConflicts,
  ScheduleBlockInterval,
} from './conflictDetector';

describe('timeUtils', () => {
  describe('timeToMinutes', () => {
    it('converts HH:mm to minutes from midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('01:30')).toBe(90);
      expect(timeToMinutes('09:30')).toBe(570);
      expect(timeToMinutes('14:05')).toBe(845);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('handles seconds in HH:mm:ss format', () => {
      expect(timeToMinutes('09:30:45')).toBe(570);
      expect(timeToMinutes('14:00:00')).toBe(840);
    });

    it('gracefully handles malformed or empty inputs', () => {
      expect(timeToMinutes('')).toBe(0);
      expect(timeToMinutes('invalid')).toBe(0);
      expect(timeToMinutes('abc:def')).toBe(0);
    });
  });

  describe('minutesToTime', () => {
    it('converts minutes from midnight to HH:mm string', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(90)).toBe('01:30');
      expect(minutesToTime(570)).toBe('09:30');
      expect(minutesToTime(845)).toBe('14:05');
      expect(minutesToTime(1439)).toBe('23:59');
    });

    it('optionally appends seconds', () => {
      expect(minutesToTime(570, true)).toBe('09:30:00');
    });

    it('clamps values out of [0, 1439] range', () => {
      expect(minutesToTime(-10)).toBe('00:00');
      expect(minutesToTime(2000)).toBe('23:59');
    });
  });

  describe('formatTime12Hour', () => {
    it('formats times into 12-hour AM/PM format', () => {
      expect(formatTime12Hour('00:00')).toBe('12:00 AM');
      expect(formatTime12Hour('08:15')).toBe('8:15 AM');
      expect(formatTime12Hour('09:30:00')).toBe('9:30 AM');
      expect(formatTime12Hour('12:00')).toBe('12:00 PM');
      expect(formatTime12Hour('13:45')).toBe('1:45 PM');
      expect(formatTime12Hour('14:05:00')).toBe('2:05 PM');
      expect(formatTime12Hour('23:59')).toBe('11:59 PM');
    });

    it('returns empty string for empty input', () => {
      expect(formatTime12Hour('')).toBe('');
    });
  });

  describe('calculateDurationMinutes & formatDuration', () => {
    it('calculates duration between start and end time', () => {
      expect(calculateDurationMinutes('09:00', '10:30')).toBe(90);
      expect(calculateDurationMinutes('08:00', '08:50')).toBe(50);
      expect(calculateDurationMinutes('10:00', '10:00')).toBe(0);
      expect(calculateDurationMinutes('10:00', '09:00')).toBe(0);
    });

    it('formats duration into readable string', () => {
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(50)).toBe('50m');
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(120)).toBe('2h');
      expect(formatDuration(150)).toBe('2h 30m');
    });
  });

  describe('addMinutesToTime', () => {
    it('adds minutes correctly across clock boundaries', () => {
      expect(addMinutesToTime('09:00', 50)).toBe('09:50');
      expect(addMinutesToTime('09:30', 90)).toBe('11:00');
      expect(addMinutesToTime('11:00', 120)).toBe('13:00');
    });
  });

  describe('getDayName', () => {
    it('returns full and short day names', () => {
      expect(getDayName(1)).toBe('Monday');
      expect(getDayName(1, true)).toBe('Mon');
      expect(getDayName(5)).toBe('Friday');
      expect(getDayName(5, true)).toBe('Fri');
      expect(getDayName(7)).toBe('Sunday');
      expect(getDayName(8)).toBe('');
    });
  });

  describe('isValidTimeRange', () => {
    it('validates strictly positive time ranges', () => {
      expect(isValidTimeRange('09:00', '10:00')).toBe(true);
      expect(isValidTimeRange('10:00', '10:00')).toBe(false);
      expect(isValidTimeRange('11:00', '10:00')).toBe(false);
      expect(isValidTimeRange('', '10:00')).toBe(false);
    });
  });
});

describe('conflictDetector', () => {
  describe('areFrequenciesOverlapping', () => {
    it('considers weekly overlapping with all frequencies', () => {
      expect(areFrequenciesOverlapping('weekly', 'weekly')).toBe(true);
      expect(areFrequenciesOverlapping('weekly', 'biweekly_week_a')).toBe(true);
      expect(areFrequenciesOverlapping('weekly', 'biweekly_week_b')).toBe(true);
      expect(areFrequenciesOverlapping('biweekly_week_a', 'weekly')).toBe(true);
    });

    it('considers identical alternating frequencies overlapping', () => {
      expect(areFrequenciesOverlapping('biweekly_week_a', 'biweekly_week_a')).toBe(true);
      expect(areFrequenciesOverlapping('biweekly_week_b', 'biweekly_week_b')).toBe(true);
    });

    it('considers Week A and Week B mutually exclusive (NO collision)', () => {
      expect(areFrequenciesOverlapping('biweekly_week_a', 'biweekly_week_b')).toBe(false);
      expect(areFrequenciesOverlapping('biweekly_week_b', 'biweekly_week_a')).toBe(false);
    });
  });

  describe('areIntervalsOverlapping', () => {
    it('detects partial overlap', () => {
      // 09:00 - 10:30 and 10:00 - 11:30
      expect(areIntervalsOverlapping('09:00', '10:30', '10:00', '11:30')).toBe(true);
      // 10:00 - 11:30 and 09:00 - 10:30
      expect(areIntervalsOverlapping('10:00', '11:30', '09:00', '10:30')).toBe(true);
    });

    it('detects completely nested / enclosed intervals', () => {
      // 09:00 - 12:00 encloses 10:00 - 11:00
      expect(areIntervalsOverlapping('09:00', '12:00', '10:00', '11:00')).toBe(true);
      expect(areIntervalsOverlapping('10:00', '11:00', '09:00', '12:00')).toBe(true);
    });

    it('detects identical intervals', () => {
      expect(areIntervalsOverlapping('09:00', '10:00', '09:00', '10:00')).toBe(true);
    });

    it('detects completely disjoint intervals as non-overlapping', () => {
      // 09:00 - 10:00 and 11:00 - 12:00
      expect(areIntervalsOverlapping('09:00', '10:00', '11:00', '12:00')).toBe(false);
    });

    it('strictly treats back-to-back boundary intervals as NON-OVERLAPPING', () => {
      // Class 1 ends at 10:00, Class 2 starts at 10:00
      expect(areIntervalsOverlapping('09:00', '10:00', '10:00', '11:00')).toBe(false);
      expect(areIntervalsOverlapping('10:00', '11:00', '09:00', '10:00')).toBe(false);
    });

    it('returns false for invalid or inverted intervals', () => {
      expect(areIntervalsOverlapping('10:00', '09:00', '09:00', '10:00')).toBe(false);
      expect(areIntervalsOverlapping('09:00', '09:00', '09:00', '10:00')).toBe(false);
    });
  });

  describe('detectScheduleConflicts', () => {
    const existingBlocks: ScheduleBlockInterval[] = [
      {
        id: 'block-1',
        courseId: 'course-1',
        courseTitle: 'Web Engineering',
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '10:30',
        frequency: 'weekly',
        room: 'Lab 1',
      },
      {
        id: 'block-2',
        courseId: 'course-2',
        courseTitle: 'Data Structures Lab (Group A)',
        dayOfWeek: 2, // Tuesday
        startTime: '11:00',
        endTime: '14:00',
        frequency: 'biweekly_week_a',
        room: 'Lab 2',
      },
    ];

    it('detects overlap on the same day for weekly classes', () => {
      const candidate: ScheduleBlockInterval = {
        courseTitle: 'Software Architecture',
        dayOfWeek: 1, // Monday
        startTime: '10:00',
        endTime: '11:30',
        frequency: 'weekly',
      };

      const result = detectScheduleConflicts(candidate, existingBlocks);
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toBe('time_overlap');
      expect(result.conflicts[0].message).toContain('Web Engineering');
    });

    it('allows back-to-back classes on the same day without conflict', () => {
      const candidate: ScheduleBlockInterval = {
        courseTitle: 'Database Systems',
        dayOfWeek: 1, // Monday
        startTime: '10:30', // Starts exactly when Web Engineering ends
        endTime: '12:00',
        frequency: 'weekly',
      };

      const result = detectScheduleConflicts(candidate, existingBlocks);
      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('allows classes with overlapping times on DIFFERENT days', () => {
      const candidate: ScheduleBlockInterval = {
        courseTitle: 'Computer Networks',
        dayOfWeek: 3, // Wednesday
        startTime: '09:00',
        endTime: '10:30',
        frequency: 'weekly',
      };

      const result = detectScheduleConflicts(candidate, existingBlocks);
      expect(result.hasConflict).toBe(false);
    });

    it('allows alternating classes (Week A vs Week B) on the exact same time slot', () => {
      const candidate: ScheduleBlockInterval = {
        courseTitle: 'Data Structures Lab (Group B)',
        dayOfWeek: 2, // Tuesday
        startTime: '11:00',
        endTime: '14:00',
        frequency: 'biweekly_week_b', // Alternating parity!
        room: 'Lab 2',
      };

      const result = detectScheduleConflicts(candidate, existingBlocks);
      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('flags room double-booking collision specifically', () => {
      const candidate: ScheduleBlockInterval = {
        courseTitle: 'Guest Seminar',
        dayOfWeek: 1,
        startTime: '09:30',
        endTime: '11:00',
        frequency: 'weekly',
        room: 'Lab 1', // Same room as Web Engineering
      };

      const result = detectScheduleConflicts(candidate, existingBlocks);
      expect(result.hasConflict).toBe(true);
      expect(result.conflicts[0].reason).toBe('room_collision');
      expect(result.conflicts[0].message).toContain('Room "Lab 1" double-booked');
    });

    it('ignores self when editing an existing block', () => {
      const editingBlock1: ScheduleBlockInterval = {
        id: 'block-1', // Same ID
        courseTitle: 'Web Engineering (Updated)',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:30',
        frequency: 'weekly',
        room: 'Lab 1',
      };

      const result = detectScheduleConflicts(editingBlock1, existingBlocks);
      expect(result.hasConflict).toBe(false);
    });
  });
});
