import {
  compileDailySchedule,
  type ScheduleOverrideRow,
} from './scheduleCompiler';
import type { BaseScheduleRow, CourseRow } from '@/store/useAppStore';

describe('compileDailySchedule', () => {
  const mockCourse1: CourseRow = {
    id: 'course-1',
    name: 'Web Engineering',
    code: 'CS-301',
    section_id: 'sec-1',
    color_hex: '#2563eb',
    is_archived: false,
    guest_invite_token: 'tok-1',
    join_code: 'WEB101',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    is_active: true,
  };

  const mockCourse2: CourseRow = {
    id: 'course-2',
    name: 'Database Systems',
    code: 'CS-302',
    section_id: 'sec-1',
    color_hex: '#059669',
    is_archived: false,
    guest_invite_token: 'tok-2',
    join_code: 'DBS102',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    is_active: true,
  };

  const baseMondayLecture: BaseScheduleRow = {
    id: 'base-1',
    course_id: 'course-1',
    course: mockCourse1,
    day_of_week: 1, // Monday
    start_time: '09:00:00',
    end_time: '10:30:00',
    room: 'Room 301',
    instructor: 'Dr. Alan Turing',
    session_type: 'lecture',
    frequency: 'weekly',
    color_override: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  const baseMondayPrayer: BaseScheduleRow = {
    id: 'base-2',
    course_id: 'course-1',
    course: null,
    day_of_week: 1, // Monday
    start_time: '13:00:00',
    end_time: '13:30:00',
    room: 'Campus Mosque',
    instructor: null,
    session_type: 'prayer',
    frequency: 'weekly',
    color_override: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  const baseMondayWeekALab: BaseScheduleRow = {
    id: 'base-3',
    course_id: 'course-2',
    course: mockCourse2,
    day_of_week: 1, // Monday
    start_time: '11:00:00',
    end_time: '13:00:00',
    room: 'Software Lab 2',
    instructor: 'Eng. Ada Lovelace',
    session_type: 'lab',
    frequency: 'biweekly_week_a',
    color_override: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  const baseMondayWeekBLab: BaseScheduleRow = {
    id: 'base-4',
    course_id: 'course-2',
    course: mockCourse2,
    day_of_week: 1, // Monday
    start_time: '11:00:00',
    end_time: '13:00:00',
    room: 'Hardware Lab 1',
    instructor: 'Eng. Grace Hopper',
    session_type: 'lab',
    frequency: 'biweekly_week_b',
    color_override: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  const baseTuesdayClass: BaseScheduleRow = {
    id: 'base-5',
    course_id: 'course-1',
    course: mockCourse1,
    day_of_week: 2, // Tuesday
    start_time: '09:00:00',
    end_time: '10:30:00',
    room: 'Room 302',
    instructor: 'Dr. Alan Turing',
    session_type: 'lecture',
    frequency: 'weekly',
    color_override: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  const allBaseSchedules = [
    baseMondayLecture,
    baseMondayPrayer,
    baseMondayWeekALab,
    baseMondayWeekBLab,
    baseTuesdayClass,
  ];

  describe('Standard Recurring Compilation', () => {
    it('returns empty array when targetDate is empty or no schedules exist', () => {
      expect(compileDailySchedule({ targetDate: '', baseSchedules: [] })).toEqual([]);
      expect(
        compileDailySchedule({ targetDate: '2026-09-21', baseSchedules: [] })
      ).toEqual([]);
    });

    it('compiles and sorts blocks chronologically for a matching weekday', () => {
      // 2026-09-21 is a Monday (day 1)
      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: allBaseSchedules,
        targetParity: 'biweekly_week_a',
      });

      expect(compiled.length).toBe(3); // Lecture (09:00), Lab Week A (11:00), Prayer (13:00)
      expect(compiled[0].id).toBe('base-1');
      expect(compiled[0].start_time).toBe('09:00:00');
      expect(compiled[1].id).toBe('base-3');
      expect(compiled[1].start_time).toBe('11:00:00');
      expect(compiled[2].id).toBe('base-2');
      expect(compiled[2].start_time).toBe('13:00:00');

      // Tuesday class should NOT appear
      expect(compiled.some((c) => c.id === 'base-5')).toBe(false);
    });

    it('calculates duration correctly for base classes', () => {
      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: [baseMondayLecture],
        targetParity: 'weekly',
      });

      expect(compiled[0].duration_minutes).toBe(90);
      expect(compiled[0].status).toBe('scheduled');
      expect(compiled[0].is_cancelled).toBe(false);
      expect(compiled[0].is_delayed).toBe(false);
    });
  });

  describe('Bi-Weekly Parity Resolution', () => {
    it('includes Week A lab and excludes Week B lab when targetParity is biweekly_week_a', () => {
      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: allBaseSchedules,
        targetParity: 'biweekly_week_a',
      });

      const ids = compiled.map((c) => c.id);
      expect(ids).toContain('base-3');
      expect(ids).not.toContain('base-4');
    });

    it('includes Week B lab and excludes Week A lab when targetParity is biweekly_week_b', () => {
      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: allBaseSchedules,
        targetParity: 'biweekly_week_b',
      });

      const ids = compiled.map((c) => c.id);
      expect(ids).toContain('base-4');
      expect(ids).not.toContain('base-3');
    });

    it('auto-resolves parity using anchorDate when targetParity is not passed', () => {
      // Anchor Monday 2026-09-07 is Week A
      // Target Monday 2026-09-14 is Week B (1 week later)
      const compiledWeekB = compileDailySchedule({
        targetDate: '2026-09-14',
        baseSchedules: allBaseSchedules,
        anchorDate: '2026-09-07',
        cycleMode: 'alternating_ab',
      });

      const ids = compiledWeekB.map((c) => c.id);
      expect(ids).toContain('base-4'); // Week B
      expect(ids).not.toContain('base-3'); // Week A
    });
  });

  describe('Exception Overrides: status === "cancelled"', () => {
    it('marks class as cancelled when override status is "cancelled"', () => {
      const cancelOverride: ScheduleOverrideRow = {
        id: 'ov-cancel',
        base_schedule_id: 'base-1',
        section_id: 'sec-1',
        course_id: 'course-1',
        override_date: '2026-09-21',
        status: 'cancelled',
        delay_minutes: 0,
        new_room: null,
        custom_note: 'Professor attending conference',
        is_makeup: false,
        makeup_start_time: null,
        makeup_end_time: null,
        created_by: 'cr-user',
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      };

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: [baseMondayLecture],
        overrides: [cancelOverride],
      });

      expect(compiled.length).toBe(1);
      expect(compiled[0].status).toBe('cancelled');
      expect(compiled[0].is_cancelled).toBe(true);
      expect(compiled[0].custom_note).toBe('Professor attending conference');
      expect(compiled[0].has_override).toBe(true);
    });

    it('omits cancelled class if includeCancelled is false', () => {
      const cancelOverride: ScheduleOverrideRow = {
        id: 'ov-cancel',
        base_schedule_id: 'base-1',
        section_id: 'sec-1',
        course_id: 'course-1',
        override_date: '2026-09-21',
        status: 'cancelled',
        delay_minutes: 0,
        new_room: null,
        custom_note: null,
        is_makeup: false,
        makeup_start_time: null,
        makeup_end_time: null,
        created_by: 'cr-user',
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      };

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: [baseMondayLecture],
        overrides: [cancelOverride],
        includeCancelled: false,
      });

      expect(compiled.length).toBe(0);
    });
  });

  describe('Exception Overrides: Delays and Timing', () => {
    it('correctly shifts start and end times by delay_minutes and preserves duration', () => {
      const delayOverride: ScheduleOverrideRow = {
        id: 'ov-delay',
        base_schedule_id: 'base-1',
        section_id: 'sec-1',
        course_id: 'course-1',
        override_date: '2026-09-21',
        status: 'delayed',
        delay_minutes: 20,
        new_room: null,
        custom_note: 'Traffic delay',
        is_makeup: false,
        makeup_start_time: null,
        makeup_end_time: null,
        created_by: 'cr-user',
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      };

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: [baseMondayLecture],
        overrides: [delayOverride],
      });

      expect(compiled.length).toBe(1);
      const item = compiled[0];
      expect(item.status).toBe('delayed');
      expect(item.is_delayed).toBe(true);
      expect(item.delay_minutes).toBe(20);
      expect(item.original_start_time).toBe('09:00:00');
      expect(item.original_end_time).toBe('10:30:00');
      expect(item.start_time).toBe('09:20:00');
      expect(item.end_time).toBe('10:50:00');
      expect(item.duration_minutes).toBe(90);
    });

    it('handles delays on time strings without seconds ("HH:mm")', () => {
      const blockNoSeconds: BaseScheduleRow = {
        ...baseMondayLecture,
        id: 'base-nosec',
        start_time: '10:15',
        end_time: '11:45',
      };

      const delayOverride: ScheduleOverrideRow = {
        id: 'ov-delay-nosec',
        base_schedule_id: 'base-nosec',
        section_id: 'sec-1',
        course_id: 'course-1',
        override_date: '2026-09-21',
        status: 'delayed',
        delay_minutes: 15,
        new_room: null,
        custom_note: null,
        is_makeup: false,
        makeup_start_time: null,
        makeup_end_time: null,
        created_by: null,
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      };

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: [blockNoSeconds],
        overrides: [delayOverride],
      });

      expect(compiled[0].start_time).toBe('10:30');
      expect(compiled[0].end_time).toBe('12:00');
    });
  });

  describe('Exception Overrides: Room Moves', () => {
    it('overrides room when new_room is specified and sets status to room_moved', () => {
      const roomOverride: ScheduleOverrideRow = {
        id: 'ov-room',
        base_schedule_id: 'base-1',
        section_id: 'sec-1',
        course_id: 'course-1',
        override_date: '2026-09-21',
        status: 'room_moved',
        delay_minutes: 0,
        new_room: 'Main Auditorium',
        custom_note: 'Joint seminar session',
        is_makeup: false,
        makeup_start_time: null,
        makeup_end_time: null,
        created_by: 'cr-user',
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      };

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: [baseMondayLecture],
        overrides: [roomOverride],
      });

      const item = compiled[0];
      expect(item.status).toBe('room_moved');
      expect(item.is_room_moved).toBe(true);
      expect(item.room).toBe('Main Auditorium');
      expect(item.original_room).toBe('Room 301');
    });
  });

  describe('Ad-Hoc Makeup Classes', () => {
    it('injects makeup session on an otherwise empty day (e.g. Saturday)', () => {
      // 2026-09-26 is a Saturday (day 6) where baseSchedules has 0 classes
      const weekendMakeup: ScheduleOverrideRow = {
        id: 'makeup-1',
        base_schedule_id: null,
        section_id: 'sec-1',
        course_id: 'course-1',
        course: mockCourse1,
        override_date: '2026-09-26',
        status: 'scheduled',
        delay_minutes: 0,
        new_room: 'Lab 5',
        custom_note: 'Extra makeup lab for midterms',
        is_makeup: true,
        makeup_start_time: '14:00:00',
        makeup_end_time: '16:00:00',
        created_by: 'cr-user',
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      };

      const compiled = compileDailySchedule({
        targetDate: '2026-09-26',
        baseSchedules: allBaseSchedules,
        overrides: [weekendMakeup],
      });

      expect(compiled.length).toBe(1);
      const item = compiled[0];
      expect(item.id).toBe('makeup-1');
      expect(item.is_makeup).toBe(true);
      expect(item.base_schedule_id).toBeNull();
      expect(item.start_time).toBe('14:00:00');
      expect(item.end_time).toBe('16:00:00');
      expect(item.duration_minutes).toBe(120);
      expect(item.room).toBe('Lab 5');
      expect(item.custom_note).toBe('Extra makeup lab for midterms');
    });

    it('merges makeup session chronologically alongside recurring classes', () => {
      const mondayMakeup: ScheduleOverrideRow = {
        id: 'makeup-monday',
        base_schedule_id: null,
        section_id: 'sec-1',
        course_id: 'course-1',
        course: mockCourse1,
        override_date: '2026-09-21',
        status: 'scheduled',
        delay_minutes: 0,
        new_room: 'Room 100',
        custom_note: 'Pre-exam Q&A',
        is_makeup: true,
        makeup_start_time: '10:00:00',
        makeup_end_time: '10:45:00',
        created_by: 'cr-user',
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      };

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: [baseMondayLecture], // 09:00 - 10:30
        overrides: [mondayMakeup], // 10:00 - 10:45
      });

      expect(compiled.length).toBe(2);
      expect(compiled[0].id).toBe('base-1');
      expect(compiled[1].id).toBe('makeup-monday');
    });
  });

  describe('Bundle & Toggle Course Muting Filter (is_active === false)', () => {
    it('filters out classes when the course is marked inactive (is_active === false)', () => {
      const activeCourses: CourseRow[] = [
        { ...mockCourse1, is_active: false }, // Web Engineering inactive / muted
        { ...mockCourse2, is_active: true }, // Database Systems active
      ];

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: allBaseSchedules,
        activeCourses,
        targetParity: 'biweekly_week_a',
      });

      // Web Engineering lecture (base-1) must be filtered out
      expect(compiled.some((c) => c.id === 'base-1')).toBe(false);
      // Database Systems lab (base-3) must be present
      expect(compiled.some((c) => c.id === 'base-3')).toBe(true);
      // General prayer session (base-2) remains visible
      expect(compiled.some((c) => c.id === 'base-2')).toBe(true);
    });

    it('filters out classes when the course is marked muted (is_muted === true)', () => {
      const activeCourses: CourseRow[] = [
        { ...mockCourse1, is_active: true, is_muted: true },
        { ...mockCourse2, is_active: true },
      ];

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: allBaseSchedules,
        activeCourses,
        targetParity: 'biweekly_week_a',
      });

      expect(compiled.some((c) => c.id === 'base-1')).toBe(false);
    });

    it('retains cohort-wide general sessions (break, prayer) even when courses are inactive', () => {
      const activeCourses: CourseRow[] = [
        { ...mockCourse1, is_active: false },
        { ...mockCourse2, is_active: false },
      ];

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: allBaseSchedules,
        activeCourses,
        targetParity: 'biweekly_week_a',
      });

      // Only the prayer break remains
      expect(compiled.length).toBe(1);
      expect(compiled[0].session_type).toBe('prayer');
    });

    it('filters out ad-hoc makeup classes if the makeup course is inactive', () => {
      const activeCourses: CourseRow[] = [
        { ...mockCourse1, is_active: false },
      ];

      const inactiveMakeup: ScheduleOverrideRow = {
        id: 'makeup-inactive',
        base_schedule_id: null,
        section_id: 'sec-1',
        course_id: 'course-1',
        course: mockCourse1,
        override_date: '2026-09-26',
        status: 'scheduled',
        delay_minutes: 0,
        new_room: 'Lab 1',
        custom_note: null,
        is_makeup: true,
        makeup_start_time: '10:00:00',
        makeup_end_time: '11:00:00',
        created_by: null,
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      };

      const compiled = compileDailySchedule({
        targetDate: '2026-09-26',
        baseSchedules: [],
        overrides: [inactiveMakeup],
        activeCourses,
      });

      expect(compiled.length).toBe(0);
    });
  });

  describe('Edge Cases and Overrides Ignored for Other Dates', () => {
    it('ignores overrides assigned to different dates', () => {
      const differentDateOverride: ScheduleOverrideRow = {
        id: 'ov-diff-date',
        base_schedule_id: 'base-1',
        section_id: 'sec-1',
        course_id: 'course-1',
        override_date: '2026-09-28', // Different Monday
        status: 'cancelled',
        delay_minutes: 0,
        new_room: null,
        custom_note: null,
        is_makeup: false,
        makeup_start_time: null,
        makeup_end_time: null,
        created_by: null,
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      };

      const compiled = compileDailySchedule({
        targetDate: '2026-09-21',
        baseSchedules: [baseMondayLecture],
        overrides: [differentDateOverride],
      });

      expect(compiled.length).toBe(1);
      expect(compiled[0].status).toBe('scheduled');
      expect(compiled[0].is_cancelled).toBe(false);
    });
  });
});
