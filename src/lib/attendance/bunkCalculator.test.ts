// ============================================================================
// ClassSync Attendance & Bunk Calculator Unit Tests
// File: src/lib/attendance/bunkCalculator.test.ts
// ============================================================================

import {
  calculateAttendanceMetrics,
  calculateCourseAttendance,
  simulateFutureAttendance,
  AttendanceLog,
} from './bunkCalculator';

describe('bunkCalculator Pure Math Engine', () => {
  describe('calculateAttendanceMetrics', () => {
    test('handles 0 classes held gracefully (initial state)', () => {
      const metrics = calculateAttendanceMetrics(0, 0);
      expect(metrics.totalHeld).toBe(0);
      expect(metrics.attended).toBe(0);
      expect(metrics.percentage).toBe(100);
      expect(metrics.isSafe).toBe(true);
      expect(metrics.skipsAllowed).toBe(0);
      expect(metrics.recoveryNeeded).toBe(0);
      expect(metrics.status).toBe('safe');
    });

    test('exactly at 75% threshold (e.g. 3 out of 4 classes)', () => {
      const metrics = calculateAttendanceMetrics(4, 3, { threshold: 0.75 });
      expect(metrics.percentage).toBe(75.0);
      expect(metrics.isSafe).toBe(true);
      // At boundary, 0 skips allowed because skipping 1 brings it to 3/5 = 60% < 75%
      expect(metrics.skipsAllowed).toBe(0);
      expect(metrics.recoveryNeeded).toBe(0);
      expect(metrics.status).toBe('warning');
    });

    test('exactly at 75% threshold with larger numbers (e.g. 15 out of 20 classes)', () => {
      const metrics = calculateAttendanceMetrics(20, 15, { threshold: 0.75 });
      expect(metrics.percentage).toBe(75.0);
      expect(metrics.isSafe).toBe(true);
      expect(metrics.skipsAllowed).toBe(0);
      expect(metrics.recoveryNeeded).toBe(0);
      expect(metrics.status).toBe('warning');
    });

    test('high attendance with allowable skips (9 out of 10 classes = 90%)', () => {
      // (9 - 0.75 * 10) / 0.75 = (9 - 7.5) / 0.75 = 1.5 / 0.75 = 2
      // If 2 skipped: 9 / 12 = 75% (Safe)
      // If 3 skipped: 9 / 13 = 69.2% (Unsafe)
      const metrics = calculateAttendanceMetrics(10, 9, { threshold: 0.75 });
      expect(metrics.percentage).toBe(90.0);
      expect(metrics.isSafe).toBe(true);
      expect(metrics.skipsAllowed).toBe(2);
      expect(metrics.recoveryNeeded).toBe(0);
      expect(metrics.status).toBe('safe');
    });

    test('perfect attendance with allowable skips (10 out of 10 classes = 100%)', () => {
      // (10 - 0.75 * 10) / 0.75 = 2.5 / 0.75 = 3.333 -> floor is 3
      // If 3 skipped: 10 / 13 = 76.9% >= 75%
      // If 4 skipped: 10 / 14 = 71.4% < 75%
      const metrics = calculateAttendanceMetrics(10, 10, { threshold: 0.75 });
      expect(metrics.percentage).toBe(100.0);
      expect(metrics.isSafe).toBe(true);
      expect(metrics.skipsAllowed).toBe(3);
      expect(metrics.recoveryNeeded).toBe(0);
      expect(metrics.status).toBe('safe');
    });

    test('low attendance requiring recovery (1 out of 4 classes = 25%)', () => {
      // Deficit: 0.75 * 4 - 1 = 3 - 1 = 2
      // Recovery: ceil( 2 / (1 - 0.75) ) = ceil( 2 / 0.25 ) = 8
      // If student attends next 8 classes: (1 + 8) / (4 + 8) = 9 / 12 = 75%
      const metrics = calculateAttendanceMetrics(4, 1, { threshold: 0.75 });
      expect(metrics.percentage).toBe(25.0);
      expect(metrics.isSafe).toBe(false);
      expect(metrics.skipsAllowed).toBe(0);
      expect(metrics.recoveryNeeded).toBe(8);
      expect(metrics.status).toBe('danger');
    });

    test('slightly below threshold (e.g. 7 out of 10 classes = 70%)', () => {
      // Deficit: 0.75 * 10 - 7 = 7.5 - 7 = 0.5
      // Recovery: ceil( 0.5 / 0.25 ) = 2
      // If attends 2: (7 + 2) / (10 + 2) = 9 / 12 = 75%
      const metrics = calculateAttendanceMetrics(10, 7, { threshold: 0.75 });
      expect(metrics.percentage).toBe(70.0);
      expect(metrics.isSafe).toBe(false);
      expect(metrics.skipsAllowed).toBe(0);
      expect(metrics.recoveryNeeded).toBe(2);
      expect(metrics.status).toBe('danger');
    });

    test('custom threshold: 80% (0.80)', () => {
      // 10 held, 8 attended = 80%
      const exactMetrics = calculateAttendanceMetrics(10, 8, { threshold: 0.8 });
      expect(exactMetrics.percentage).toBe(80.0);
      expect(exactMetrics.isSafe).toBe(true);
      expect(exactMetrics.skipsAllowed).toBe(0);
      expect(exactMetrics.recoveryNeeded).toBe(0);

      // 10 held, 10 attended = 100% with threshold 0.8
      // (10 - 8) / 0.8 = 2 / 0.8 = 2.5 -> floor = 2
      // If 2 skipped: 10 / 12 = 83.3% >= 80%
      // If 3 skipped: 10 / 13 = 76.9% < 80%
      const safeMetrics = calculateAttendanceMetrics(10, 10, { threshold: 0.8 });
      expect(safeMetrics.skipsAllowed).toBe(2);
      expect(safeMetrics.recoveryNeeded).toBe(0);

      // 10 held, 6 attended = 60% with threshold 0.8
      // Deficit: 0.8 * 10 - 6 = 8 - 6 = 2
      // Recovery: ceil( 2 / 0.2 ) = 10
      // Check: (6 + 10) / (10 + 10) = 16 / 20 = 80%
      const dangerMetrics = calculateAttendanceMetrics(10, 6, { threshold: 0.8 });
      expect(dangerMetrics.recoveryNeeded).toBe(10);
    });

    test('custom threshold: 85% (0.85)', () => {
      // 20 held, 17 attended = 85%
      const metrics = calculateAttendanceMetrics(20, 17, { threshold: 0.85 });
      expect(metrics.percentage).toBe(85.0);
      expect(metrics.isSafe).toBe(true);
      expect(metrics.skipsAllowed).toBe(0);
      expect(metrics.recoveryNeeded).toBe(0);
    });
  });

  describe('calculateCourseAttendance from AttendanceLog array', () => {
    const mockLogs: AttendanceLog[] = [
      {
        id: '1',
        user_id: 'user_1',
        course_id: 'course_1',
        schedule_block_id: 'block_1',
        override_id: null,
        attendance_date: '2026-09-01',
        status: 'present',
        notes: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        user_id: 'user_1',
        course_id: 'course_1',
        schedule_block_id: 'block_1',
        override_id: null,
        attendance_date: '2026-09-03',
        status: 'present',
        notes: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        user_id: 'user_1',
        course_id: 'course_1',
        schedule_block_id: 'block_1',
        override_id: null,
        attendance_date: '2026-09-08',
        status: 'absent',
        notes: 'Medical',
        created_at: '',
        updated_at: '',
      },
      {
        id: '4',
        user_id: 'user_1',
        course_id: 'course_1',
        schedule_block_id: 'block_1',
        override_id: null,
        attendance_date: '2026-09-10',
        status: 'late',
        notes: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '5',
        user_id: 'user_1',
        course_id: 'course_1',
        schedule_block_id: null,
        override_id: 'override_1',
        attendance_date: '2026-09-15',
        status: 'excused',
        notes: 'University event',
        created_at: '',
        updated_at: '',
      },
    ];

    test('default settings: excused excluded from total, late = 1.0 credit', () => {
      // present=2, absent=1, late=1, excused=1
      // total held = 2 + 1 + 1 = 4 (excused excluded)
      // attended = 2 + 1 = 3
      // percentage = 3 / 4 = 75.0%
      const result = calculateCourseAttendance(mockLogs);
      expect(result.totalHeld).toBe(4);
      expect(result.attended).toBe(3);
      expect(result.presentCount).toBe(2);
      expect(result.absentCount).toBe(1);
      expect(result.lateCount).toBe(1);
      expect(result.excusedCount).toBe(1);
      expect(result.percentage).toBe(75.0);
      expect(result.isSafe).toBe(true);
      expect(result.skipsAllowed).toBe(0);
    });

    test('with partial late credit (0.5 credit for late)', () => {
      // attended = 2 + 0.5 = 2.5
      // total held = 4
      // percentage = 2.5 / 4 = 62.5%
      const result = calculateCourseAttendance(mockLogs, { lateCredit: 0.5 });
      expect(result.totalHeld).toBe(4);
      expect(result.attended).toBe(2.5);
      expect(result.percentage).toBe(62.5);
      expect(result.isSafe).toBe(false);
      expect(result.status).toBe('danger');
    });

    test('with excused counted as attended', () => {
      // total held = 2 + 1 + 1 + 1 = 5
      // attended = 2 + 1 + 1 = 4
      // percentage = 4 / 5 = 80.0%
      const result = calculateCourseAttendance(mockLogs, { countExcusedAsAttended: true });
      expect(result.totalHeld).toBe(5);
      expect(result.attended).toBe(4);
      expect(result.percentage).toBe(80.0);
      expect(result.isSafe).toBe(true);
    });
  });

  describe('simulateFutureAttendance', () => {
    test('projects future percentage when attending classes', () => {
      const current = calculateAttendanceMetrics(10, 7); // 70%
      const simulation = simulateFutureAttendance(current, 2, 0);
      expect(simulation.projectedTotal).toBe(12);
      expect(simulation.projectedAttended).toBe(9);
      expect(simulation.projectedPercentage).toBe(75.0);
    });

    test('projects future percentage when skipping classes', () => {
      const current = calculateAttendanceMetrics(10, 9); // 90%
      const simulation = simulateFutureAttendance(current, 0, 2);
      expect(simulation.projectedTotal).toBe(12);
      expect(simulation.projectedAttended).toBe(9);
      expect(simulation.projectedPercentage).toBe(75.0);
    });
  });
});
