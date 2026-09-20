import {
  compileDailySchedule,
  type ScheduleOverrideRow,
} from './scheduleCompiler';
import { calculateWeekParity, getLocalDateString } from './calendarUtils';
import type { BaseScheduleRow, CourseRow } from '@/store/useAppStore';

describe('Phase 4 End-to-End System Integration', () => {
  const mockCourse: CourseRow = {
    id: 'c-e2e-1',
    name: 'Distributed Systems',
    code: 'CS-401',
    section_id: 'sec-e2e',
    color_hex: '#2563eb',
    is_archived: false,
    guest_invite_token: 'tok-e2e',
    join_code: 'DIST401',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    is_active: true,
  };

  const baseMondayClass: BaseScheduleRow = {
    id: 'base-e2e-1',
    course_id: 'c-e2e-1',
    course: mockCourse,
    day_of_week: 1, // Monday
    start_time: '10:00:00',
    end_time: '11:30:00',
    room: 'Hall 1',
    instructor: 'Dr. Leslie Lamport',
    session_type: 'lecture',
    frequency: 'weekly',
    color_override: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  it('Step 1: Compiles baseline recurring timetable on matching day', () => {
    const monday = '2026-09-21';
    const compiled = compileDailySchedule({
      targetDate: monday,
      baseSchedules: [baseMondayClass],
      overrides: [],
      activeCourses: [mockCourse],
    });

    expect(compiled.length).toBe(1);
    expect(compiled[0].status).toBe('scheduled');
    expect(compiled[0].start_time).toBe('10:00:00');
    expect(compiled[0].room).toBe('Hall 1');
    expect(compiled[0].is_delayed).toBe(false);
    expect(compiled[0].is_cancelled).toBe(false);
  });

  it('Step 2: Simulates CR broadcasting a delay (+25m) and room relocation', () => {
    const monday = '2026-09-21';
    const liveOverride: ScheduleOverrideRow = {
      id: 'ov-e2e-delay',
      base_schedule_id: 'base-e2e-1',
      section_id: 'sec-e2e',
      course_id: 'c-e2e-1',
      override_date: monday,
      status: 'delayed',
      delay_minutes: 25,
      new_room: 'Lab B',
      custom_note: 'Moved due to projector failure',
      is_makeup: false,
      makeup_start_time: null,
      makeup_end_time: null,
      created_by: 'cr-user',
      created_at: '2026-09-20T00:00:00Z',
      updated_at: '2026-09-20T00:00:00Z',
    };

    const compiled = compileDailySchedule({
      targetDate: monday,
      baseSchedules: [baseMondayClass],
      overrides: [liveOverride],
      activeCourses: [mockCourse],
    });

    expect(compiled.length).toBe(1);
    const item = compiled[0];
    expect(item.status).toBe('delayed');
    expect(item.is_delayed).toBe(true);
    expect(item.is_room_moved).toBe(true);
    expect(item.delay_minutes).toBe(25);
    expect(item.start_time).toBe('10:25:00');
    expect(item.end_time).toBe('11:55:00');
    expect(item.duration_minutes).toBe(90);
    expect(item.room).toBe('Lab B');
    expect(item.original_room).toBe('Hall 1');
    expect(item.custom_note).toBe('Moved due to projector failure');
  });

  it('Step 3: Simulates CR broadcasting a cancellation', () => {
    const monday = '2026-09-21';
    const cancelOverride: ScheduleOverrideRow = {
      id: 'ov-e2e-cancel',
      base_schedule_id: 'base-e2e-1',
      section_id: 'sec-e2e',
      course_id: 'c-e2e-1',
      override_date: monday,
      status: 'cancelled',
      delay_minutes: 0,
      new_room: null,
      custom_note: 'Professor attending symposium',
      is_makeup: false,
      makeup_start_time: null,
      makeup_end_time: null,
      created_by: 'cr-user',
      created_at: '2026-09-20T00:00:00Z',
      updated_at: '2026-09-20T00:00:00Z',
    };

    const compiled = compileDailySchedule({
      targetDate: monday,
      baseSchedules: [baseMondayClass],
      overrides: [cancelOverride],
      activeCourses: [mockCourse],
      includeCancelled: true,
    });

    expect(compiled.length).toBe(1);
    expect(compiled[0].status).toBe('cancelled');
    expect(compiled[0].is_cancelled).toBe(true);
  });

  it('Step 4: Simulates CR scheduling an ad-hoc makeup class on a weekend', () => {
    const saturday = '2026-09-26';
    const makeupSession: ScheduleOverrideRow = {
      id: 'ov-e2e-makeup',
      base_schedule_id: null,
      section_id: 'sec-e2e',
      course_id: 'c-e2e-1',
      override_date: saturday,
      status: 'scheduled',
      delay_minutes: 0,
      new_room: 'Seminar Hall 3',
      custom_note: 'Midterm review session',
      is_makeup: true,
      makeup_start_time: '15:00:00',
      makeup_end_time: '17:00:00',
      created_by: 'cr-user',
      created_at: '2026-09-20T00:00:00Z',
      updated_at: '2026-09-20T00:00:00Z',
    };

    const compiled = compileDailySchedule({
      targetDate: saturday,
      baseSchedules: [baseMondayClass], // Saturday has 0 base blocks
      overrides: [makeupSession],
      activeCourses: [mockCourse],
    });

    expect(compiled.length).toBe(1);
    expect(compiled[0].is_makeup).toBe(true);
    expect(compiled[0].base_schedule_id).toBeNull();
    expect(compiled[0].start_time).toBe('15:00:00');
    expect(compiled[0].end_time).toBe('17:00:00');
    expect(compiled[0].duration_minutes).toBe(120);
    expect(compiled[0].room).toBe('Seminar Hall 3');
  });

  it('Step 5: Simulates reverting an override (reverts cleanly back to baseline)', () => {
    const monday = '2026-09-21';
    // Reverting in our DB deletes the override row; compiler receives empty overrides array
    const compiled = compileDailySchedule({
      targetDate: monday,
      baseSchedules: [baseMondayClass],
      overrides: [],
      activeCourses: [mockCourse],
    });

    expect(compiled.length).toBe(1);
    expect(compiled[0].status).toBe('scheduled');
    expect(compiled[0].has_override).toBe(false);
    expect(compiled[0].start_time).toBe('10:00:00');
    expect(compiled[0].room).toBe('Hall 1');
  });

  it('Step 6: Bundle & Toggle Course Muting exclusion test', () => {
    const monday = '2026-09-21';
    const mutedCourse: CourseRow = {
      ...mockCourse,
      is_active: false,
    };

    const compiled = compileDailySchedule({
      targetDate: monday,
      baseSchedules: [baseMondayClass],
      overrides: [],
      activeCourses: [mutedCourse],
    });

    // Muted course is completely excluded from the student agenda
    expect(compiled.length).toBe(0);
  });
});
