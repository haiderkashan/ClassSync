import {
  getLocalDateString,
  getTomorrowDateString,
  calculateWeekParity,
  getMillisecondsUntilMidnight,
  getDayOfWeekFromDateString,
  isDateInBreak,
  getInstructionalWeekNumber,
  formatAcademicWeekLabel,
  CalendarBreak,
} from './calendarUtils';

describe('calendarUtils', () => {
  describe('getLocalDateString', () => {
    it('formats a date to YYYY-MM-DD in UTC', () => {
      const d = new Date(Date.UTC(2026, 8, 20, 14, 30, 0));
      expect(getLocalDateString(d, 'UTC')).toBe('2026-09-20');
    });

    it('formats local date across different timezones', () => {
      const d = new Date(Date.UTC(2026, 8, 20, 2, 0, 0));
      expect(getLocalDateString(d, 'America/New_York')).toBe('2026-09-19');
      expect(getLocalDateString(d, 'Asia/Karachi')).toBe('2026-09-20');
      expect(getLocalDateString(d, 'Asia/Tokyo')).toBe('2026-09-20');
    });

    it('handles ISO string and timestamp inputs', () => {
      expect(getLocalDateString('2026-12-25T10:00:00Z', 'UTC')).toBe('2026-12-25');
      const ts = Date.UTC(2026, 0, 1, 12, 0, 0);
      expect(getLocalDateString(ts, 'UTC')).toBe('2026-01-01');
    });

    it('falls back gracefully on invalid timezone string', () => {
      const d = new Date(Date.UTC(2026, 4, 15, 12, 0, 0));
      expect(getLocalDateString(d, 'INVALID_TIMEZONE_STRING')).toBe('2026-05-15');
    });
  });

  describe('getTomorrowDateString', () => {
    it('returns tomorrow for standard mid-month date', () => {
      const today = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));
      expect(getTomorrowDateString('UTC', today)).toBe('2026-09-16');
    });

    it('handles end of month rollover', () => {
      const endOfJan = new Date(Date.UTC(2026, 0, 31, 12, 0, 0));
      expect(getTomorrowDateString('UTC', endOfJan)).toBe('2026-02-01');
    });

    it('handles end of year rollover', () => {
      const newYearsEve = new Date(Date.UTC(2026, 11, 31, 12, 0, 0));
      expect(getTomorrowDateString('UTC', newYearsEve)).toBe('2027-01-01');
    });

    it('handles February leap year vs non-leap year rollover', () => {
      const leapFeb28 = new Date(Date.UTC(2024, 1, 28, 12, 0, 0));
      expect(getTomorrowDateString('UTC', leapFeb28)).toBe('2024-02-29');

      const leapFeb29 = new Date(Date.UTC(2024, 1, 29, 12, 0, 0));
      expect(getTomorrowDateString('UTC', leapFeb29)).toBe('2024-03-01');

      const nonLeapFeb28 = new Date(Date.UTC(2026, 1, 28, 12, 0, 0));
      expect(getTomorrowDateString('UTC', nonLeapFeb28)).toBe('2026-03-01');
    });
  });

  describe('isDateInBreak', () => {
    const breaks: CalendarBreak[] = [
      {
        break_name: 'Mid-term Reading Week',
        start_date: '2026-10-19',
        end_date: '2026-10-25',
        freeze_cycle: true,
      },
      {
        break_name: 'Winter Break',
        start_date: '2026-12-21',
        end_date: '2027-01-03',
        freeze_cycle: true,
      },
    ];

    it('returns matching break when date is inside boundary', () => {
      const result = isDateInBreak('2026-10-21', breaks);
      expect(result).not.toBeNull();
      expect(result?.break_name).toBe('Mid-term Reading Week');
    });

    it('returns matching break on boundary start and end dates', () => {
      expect(isDateInBreak('2026-10-19', breaks)?.break_name).toBe('Mid-term Reading Week');
      expect(isDateInBreak('2026-10-25', breaks)?.break_name).toBe('Mid-term Reading Week');
    });

    it('returns null when date is outside any break', () => {
      expect(isDateInBreak('2026-10-18', breaks)).toBeNull();
      expect(isDateInBreak('2026-10-26', breaks)).toBeNull();
      expect(isDateInBreak('2026-11-01', breaks)).toBeNull();
    });

    it('returns null when break array is empty', () => {
      expect(isDateInBreak('2026-10-21', [])).toBeNull();
    });
  });

  describe('calculateWeekParity (Normal & Parity Freeze with Breaks)', () => {
    const anchorMonday = '2026-08-24'; // Week 1 (Week A)

    it('returns weekly if cycleMode is standard_weekly', () => {
      expect(calculateWeekParity('2026-08-24', anchorMonday, 'standard_weekly')).toBe('weekly');
      expect(calculateWeekParity('2026-08-31', anchorMonday, 'standard_weekly')).toBe('weekly');
    });

    it('returns weekly if anchorDate is null or undefined', () => {
      expect(calculateWeekParity('2026-08-24', null)).toBe('weekly');
      expect(calculateWeekParity('2026-08-24', undefined)).toBe('weekly');
    });

    it('evaluates normal alternating weeks without breaks', () => {
      // Week 1 (Week A): Aug 24 - Aug 30
      expect(calculateWeekParity('2026-08-24', anchorMonday)).toBe('biweekly_week_a');
      expect(calculateWeekParity('2026-08-28', anchorMonday)).toBe('biweekly_week_a');

      // Week 2 (Week B): Aug 31 - Sep 06
      expect(calculateWeekParity('2026-08-31', anchorMonday)).toBe('biweekly_week_b');

      // Week 3 (Week A): Sep 07 - Sep 13
      expect(calculateWeekParity('2026-09-07', anchorMonday)).toBe('biweekly_week_a');
    });

    it('freezes parity when an intervening week is a frozen break', () => {
      // Scenario:
      // Week 1: Mon Aug 24 (Week A)
      // Week 2: Mon Aug 31 (Frozen Break: Reading Week)
      // Week 3: Mon Sep 07 (Should resume as Week B, NOT Week A!)
      // Week 4: Mon Sep 14 (Should be Week A)
      const breaks: CalendarBreak[] = [
        {
          break_name: 'Reading Week',
          start_date: '2026-08-31',
          end_date: '2026-09-06',
          freeze_cycle: true,
        },
      ];

      // Week 1 is Week A
      expect(calculateWeekParity('2026-08-24', anchorMonday, 'alternating_ab', breaks)).toBe('biweekly_week_a');

      // Week 3 (Sep 07) resumes as Week B because Week 2 was frozen!
      expect(calculateWeekParity('2026-09-07', anchorMonday, 'alternating_ab', breaks)).toBe('biweekly_week_b');

      // Week 4 (Sep 14) is Week A
      expect(calculateWeekParity('2026-09-14', anchorMonday, 'alternating_ab', breaks)).toBe('biweekly_week_a');

      // Week 5 (Sep 21) is Week B
      expect(calculateWeekParity('2026-09-21', anchorMonday, 'alternating_ab', breaks)).toBe('biweekly_week_b');
    });

    it('does NOT freeze parity when break has freeze_cycle = false (Continuous Calendar Mode)', () => {
      const continuousBreaks: CalendarBreak[] = [
        {
          break_name: 'Bank Holiday Break',
          start_date: '2026-08-31',
          end_date: '2026-09-06',
          freeze_cycle: false, // Cycle continues cycling naturally
        },
      ];

      // Week 1: Week A
      expect(calculateWeekParity('2026-08-24', anchorMonday, 'alternating_ab', continuousBreaks)).toBe('biweekly_week_a');
      // Week 3 (Sep 07): In continuous mode, it toggles as Week A (Week 1=A, Week 2=B, Week 3=A)
      expect(calculateWeekParity('2026-09-07', anchorMonday, 'alternating_ab', continuousBreaks)).toBe('biweekly_week_a');
    });

    it('handles multi-week breaks with cycle freeze', () => {
      // 2-week Winter Break (Dec 21 - Jan 03)
      const multiBreaks: CalendarBreak[] = [
        {
          break_name: 'Winter Break',
          start_date: '2026-12-21',
          end_date: '2027-01-03',
          freeze_cycle: true,
        },
      ];

      // Mon Dec 14 is Week A
      // Dec 21: Break Week 1 (frozen)
      // Dec 28: Break Week 2 (frozen)
      // Mon Jan 04: Resumes as Week B!
      const dec14 = '2026-12-14';
      const parityDec14 = calculateWeekParity(dec14, anchorMonday, 'alternating_ab', multiBreaks);
      const jan04 = '2027-01-04';
      const parityJan04 = calculateWeekParity(jan04, anchorMonday, 'alternating_ab', multiBreaks);

      // Since exactly 2 weeks were frozen, parityJan04 should be the opposite of parityDec14 (i.e. next instructional week)
      expect(parityJan04).not.toBe(parityDec14);
    });

    it('handles negative date ranges (dates before anchor date)', () => {
      expect(calculateWeekParity('2026-08-17', anchorMonday)).toBe('biweekly_week_b');
      expect(calculateWeekParity('2026-08-10', anchorMonday)).toBe('biweekly_week_a');
    });

    it('is immune to Daylight Saving Time boundaries and leap years', () => {
      const dstAnchor = '2024-03-04'; // Week A
      expect(calculateWeekParity('2024-03-04', dstAnchor)).toBe('biweekly_week_a');
      expect(calculateWeekParity('2024-03-11', dstAnchor)).toBe('biweekly_week_b');
      expect(calculateWeekParity('2024-03-18', dstAnchor)).toBe('biweekly_week_a');
    });
  });

  describe('getInstructionalWeekNumber', () => {
    const semesterStart = '2026-08-24'; // Week 1

    it('returns null if semesterStartDate is missing or target is before start', () => {
      expect(getInstructionalWeekNumber('2026-08-24', null)).toBeNull();
      expect(getInstructionalWeekNumber('2026-08-17', semesterStart)).toBeNull();
    });

    it('returns 1 for any day in the first week', () => {
      expect(getInstructionalWeekNumber('2026-08-24', semesterStart)).toBe(1);
      expect(getInstructionalWeekNumber('2026-08-28', semesterStart)).toBe(1);
      expect(getInstructionalWeekNumber('2026-08-30', semesterStart)).toBe(1);
    });

    it('increments sequentially without breaks', () => {
      expect(getInstructionalWeekNumber('2026-08-31', semesterStart)).toBe(2);
      expect(getInstructionalWeekNumber('2026-09-07', semesterStart)).toBe(3);
      expect(getInstructionalWeekNumber('2026-09-14', semesterStart)).toBe(4);
    });

    it('pauses instructional week counter during frozen breaks', () => {
      const breaks: CalendarBreak[] = [
        {
          break_name: 'Mid-term Reading Week',
          start_date: '2026-08-31',
          end_date: '2026-09-06',
          freeze_cycle: true,
        },
      ];

      // Week of Aug 24 is Week 1
      expect(getInstructionalWeekNumber('2026-08-24', semesterStart, breaks)).toBe(1);

      // Week of Sep 07 (week after the break) becomes Week 2 (NOT Week 3!)
      expect(getInstructionalWeekNumber('2026-09-07', semesterStart, breaks)).toBe(2);

      // Week of Sep 14 is Week 3
      expect(getInstructionalWeekNumber('2026-09-14', semesterStart, breaks)).toBe(3);
    });
  });

  describe('formatAcademicWeekLabel', () => {
    it('returns break name directly when in break', () => {
      const label = formatAcademicWeekLabel({
        parity: 'biweekly_week_a',
        inBreak: true,
        breakName: 'Fall Reading Week',
      });
      expect(label).toBe('Fall Reading Week');
    });

    it('formats week_ab convention', () => {
      expect(
        formatAcademicWeekLabel({
          parity: 'biweekly_week_a',
          weekNumber: 4,
          namingConvention: 'week_ab',
        })
      ).toBe('Week 4 • Week A');

      expect(
        formatAcademicWeekLabel({
          parity: 'biweekly_week_b',
          weekNumber: 5,
          namingConvention: 'week_ab',
        })
      ).toBe('Week 5 • Week B');

      expect(
        formatAcademicWeekLabel({
          parity: 'biweekly_week_a',
          namingConvention: 'week_ab',
        })
      ).toBe('Week A');
    });

    it('formats odd_even convention', () => {
      expect(
        formatAcademicWeekLabel({
          parity: 'biweekly_week_a',
          weekNumber: 7,
          namingConvention: 'odd_even',
        })
      ).toBe('Week 7 • Odd Week');

      expect(
        formatAcademicWeekLabel({
          parity: 'biweekly_week_b',
          weekNumber: 8,
          namingConvention: 'odd_even',
        })
      ).toBe('Week 8 • Even Week');
    });

    it('formats cycle_12 convention', () => {
      expect(
        formatAcademicWeekLabel({
          parity: 'biweekly_week_a',
          weekNumber: 3,
          namingConvention: 'cycle_12',
        })
      ).toBe('Week 3 • Cycle 1');

      expect(
        formatAcademicWeekLabel({
          parity: 'biweekly_week_b',
          weekNumber: 4,
          namingConvention: 'cycle_12',
        })
      ).toBe('Week 4 • Cycle 2');
    });

    it('formats weekly schedule without parity tag', () => {
      expect(
        formatAcademicWeekLabel({
          parity: 'weekly',
          weekNumber: 2,
        })
      ).toBe('Week 2');

      expect(
        formatAcademicWeekLabel({
          parity: 'weekly',
        })
      ).toBe('Weekly Schedule');
    });
  });

  describe('getMillisecondsUntilMidnight', () => {
    it('returns positive milliseconds bounded by day length', () => {
      const ms = getMillisecondsUntilMidnight('UTC');
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(86400000 + 2000);
    });

    it('accurately computes remaining ms for known fixed time', () => {
      const nearMidnight = new Date(Date.UTC(2026, 8, 20, 23, 59, 0, 0));
      const ms = getMillisecondsUntilMidnight('UTC', nearMidnight);
      expect(ms).toBe(61000);
    });
  });

  describe('getDayOfWeekFromDateString', () => {
    it('correctly maps days of week (1=Mon ... 7=Sun)', () => {
      expect(getDayOfWeekFromDateString('2026-09-21')).toBe(1); // Monday
      expect(getDayOfWeekFromDateString('2026-09-22')).toBe(2); // Tuesday
      expect(getDayOfWeekFromDateString('2026-09-23')).toBe(3); // Wednesday
      expect(getDayOfWeekFromDateString('2026-09-24')).toBe(4); // Thursday
      expect(getDayOfWeekFromDateString('2026-09-25')).toBe(5); // Friday
      expect(getDayOfWeekFromDateString('2026-09-26')).toBe(6); // Saturday
      expect(getDayOfWeekFromDateString('2026-09-27')).toBe(7); // Sunday
    });
  });
});
