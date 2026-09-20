import {
  getLocalDateString,
  getTomorrowDateString,
  calculateWeekParity,
  getMillisecondsUntilMidnight,
  getDayOfWeekFromDateString,
} from './calendarUtils';

describe('calendarUtils', () => {
  describe('getLocalDateString', () => {
    it('formats a date to YYYY-MM-DD in UTC', () => {
      const d = new Date(Date.UTC(2026, 8, 20, 14, 30, 0));
      expect(getLocalDateString(d, 'UTC')).toBe('2026-09-20');
    });

    it('formats local date across different timezones', () => {
      // 2026-09-20 02:00 UTC is still 2026-09-19 in New York (UTC-4)
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
      // 2024 is a leap year: Feb 28 -> Feb 29
      const leapFeb28 = new Date(Date.UTC(2024, 1, 28, 12, 0, 0));
      expect(getTomorrowDateString('UTC', leapFeb28)).toBe('2024-02-29');

      const leapFeb29 = new Date(Date.UTC(2024, 1, 29, 12, 0, 0));
      expect(getTomorrowDateString('UTC', leapFeb29)).toBe('2024-03-01');

      // 2026 is non-leap year: Feb 28 -> Mar 01
      const nonLeapFeb28 = new Date(Date.UTC(2026, 1, 28, 12, 0, 0));
      expect(getTomorrowDateString('UTC', nonLeapFeb28)).toBe('2026-03-01');
    });
  });

  describe('calculateWeekParity', () => {
    const anchorMonday = '2026-08-24'; // Monday of Week A

    it('returns weekly if cycleMode is standard_weekly', () => {
      expect(calculateWeekParity('2026-08-24', anchorMonday, 'standard_weekly')).toBe('weekly');
      expect(calculateWeekParity('2026-08-31', anchorMonday, 'standard_weekly')).toBe('weekly');
    });

    it('returns weekly if anchorDate is null or undefined', () => {
      expect(calculateWeekParity('2026-08-24', null)).toBe('weekly');
      expect(calculateWeekParity('2026-08-24', undefined)).toBe('weekly');
    });

    it('evaluates entire anchor week (Mon to Sun) as Week A', () => {
      expect(calculateWeekParity('2026-08-24', anchorMonday)).toBe('biweekly_week_a'); // Monday
      expect(calculateWeekParity('2026-08-26', anchorMonday)).toBe('biweekly_week_a'); // Wednesday
      expect(calculateWeekParity('2026-08-28', anchorMonday)).toBe('biweekly_week_a'); // Friday
      expect(calculateWeekParity('2026-08-30', anchorMonday)).toBe('biweekly_week_a'); // Sunday
    });

    it('evaluates subsequent weeks alternating between Week B and Week A', () => {
      // Week 1 (Week B): 2026-08-31 to 2026-09-06
      expect(calculateWeekParity('2026-08-31', anchorMonday)).toBe('biweekly_week_b');
      expect(calculateWeekParity('2026-09-04', anchorMonday)).toBe('biweekly_week_b');
      expect(calculateWeekParity('2026-09-06', anchorMonday)).toBe('biweekly_week_b');

      // Week 2 (Week A): 2026-09-07 to 2026-09-13
      expect(calculateWeekParity('2026-09-07', anchorMonday)).toBe('biweekly_week_a');
      expect(calculateWeekParity('2026-09-11', anchorMonday)).toBe('biweekly_week_a');

      // Week 3 (Week B): 2026-09-14 to 2026-09-20
      expect(calculateWeekParity('2026-09-14', anchorMonday)).toBe('biweekly_week_b');
      expect(calculateWeekParity('2026-09-20', anchorMonday)).toBe('biweekly_week_b');

      // Week 4 (Week A): 2026-09-21
      expect(calculateWeekParity('2026-09-21', anchorMonday)).toBe('biweekly_week_a');
    });

    it('normalizes anchor date correctly if anchor is not on a Monday', () => {
      // Suppose Genesis CR clicked Wednesday Aug 26 as the anchor date
      const wednesdayAnchor = '2026-08-26';
      // Monday of that same week should still be Week A
      expect(calculateWeekParity('2026-08-24', wednesdayAnchor)).toBe('biweekly_week_a');
      expect(calculateWeekParity('2026-08-30', wednesdayAnchor)).toBe('biweekly_week_a');
      // Next week is Week B
      expect(calculateWeekParity('2026-08-31', wednesdayAnchor)).toBe('biweekly_week_b');
    });

    it('handles negative date ranges (dates before anchor date)', () => {
      // 1 week before anchor: Week B
      expect(calculateWeekParity('2026-08-17', anchorMonday)).toBe('biweekly_week_b');
      expect(calculateWeekParity('2026-08-21', anchorMonday)).toBe('biweekly_week_b');

      // 2 weeks before anchor: Week A
      expect(calculateWeekParity('2026-08-10', anchorMonday)).toBe('biweekly_week_a');

      // 3 weeks before anchor: Week B
      expect(calculateWeekParity('2026-08-03', anchorMonday)).toBe('biweekly_week_b');
    });

    it('handles leap year week transitions seamlessly', () => {
      const leapAnchor = '2024-02-26'; // Monday in leap year
      expect(calculateWeekParity('2024-02-26', leapAnchor)).toBe('biweekly_week_a');
      expect(calculateWeekParity('2024-02-29', leapAnchor)).toBe('biweekly_week_a'); // Leap Day
      expect(calculateWeekParity('2024-03-03', leapAnchor)).toBe('biweekly_week_a'); // Sunday
      // Next week across leap boundary is Week B
      expect(calculateWeekParity('2024-03-04', leapAnchor)).toBe('biweekly_week_b');
      expect(calculateWeekParity('2024-03-11', leapAnchor)).toBe('biweekly_week_a');
    });

    it('is immune to Daylight Saving Time boundaries', () => {
      // US DST Spring Forward was March 10, 2024
      const dstAnchor = '2024-03-04'; // Week A
      expect(calculateWeekParity('2024-03-04', dstAnchor)).toBe('biweekly_week_a');
      // Across DST change (March 11) is Week B
      expect(calculateWeekParity('2024-03-11', dstAnchor)).toBe('biweekly_week_b');
      expect(calculateWeekParity('2024-03-18', dstAnchor)).toBe('biweekly_week_a');
    });
  });

  describe('getMillisecondsUntilMidnight', () => {
    it('returns positive milliseconds bounded by day length', () => {
      const ms = getMillisecondsUntilMidnight('UTC');
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(86400000 + 2000);
    });

    it('accurately computes remaining ms for known fixed time', () => {
      // 23:59:00 UTC => 60 seconds remaining + 1000ms buffer = ~61,000ms
      const nearMidnight = new Date(Date.UTC(2026, 8, 20, 23, 59, 0, 0));
      const ms = getMillisecondsUntilMidnight('UTC', nearMidnight);
      expect(ms).toBe(61000);
    });

    it('accurately computes remaining ms for noon', () => {
      // 12:00:00 UTC => 12 hours remaining = 12 * 3600 * 1000 + 1000ms buffer = 43,201,000ms
      const noon = new Date(Date.UTC(2026, 8, 20, 12, 0, 0, 0));
      const ms = getMillisecondsUntilMidnight('UTC', noon);
      expect(ms).toBe(43201000);
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
