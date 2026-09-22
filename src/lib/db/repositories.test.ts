import {
  normalizeIsoDate,
  normalizeDateString,
  getLocalBaseSchedules,
  upsertLocalBaseSchedules,
  deleteLocalBaseSchedule,
  clearLocalBaseSchedules,
  getLocalScheduleOverrides,
  upsertLocalScheduleOverrides,
  deleteLocalScheduleOverride,
  clearLocalScheduleOverrides,
} from './scheduleRepository';
import {
  getLocalTasks,
  upsertLocalTasks,
  deleteLocalTask,
  clearLocalTasks,
  getLocalTaskCompletions,
  toggleLocalTaskCompletion,
  setLocalTaskCompletions,
  getLocalAttendanceLogs,
  upsertLocalAttendanceLogs,
  deleteLocalAttendanceLog,
  clearLocalAttendanceLogs,
} from './taskAttendanceRepository';
import type {
  BaseScheduleRow,
  ScheduleOverrideRow,
  AcademicTaskRow,
  AttendanceLogRow,
} from '@/store/useAppStore';

describe('Local SQLite Repositories & Serialization', () => {
  describe('Date & Timestamp Normalization Utilities', () => {
    it('should normalize valid date strings and Date instances to strict ISO strings', () => {
      const fixedDate = new Date('2026-09-22T10:30:00.000Z');
      expect(normalizeIsoDate(fixedDate)).toBe('2026-09-22T10:30:00.000Z');
      expect(normalizeIsoDate('2026-09-22T10:30:00.000Z')).toBe('2026-09-22T10:30:00.000Z');
    });

    it('should fallback to current ISO string when given null, undefined, or invalid date values', () => {
      const fallbackNull = normalizeIsoDate(null);
      const fallbackInvalid = normalizeIsoDate('invalid-date-string');

      expect(typeof fallbackNull).toBe('string');
      expect(new Date(fallbackNull).getTime()).not.toBeNaN();
      expect(new Date(fallbackInvalid).getTime()).not.toBeNaN();
    });

    it('should normalize arbitrary date inputs to clean YYYY-MM-DD calendar strings', () => {
      expect(normalizeDateString('2026-09-22T14:45:00.000Z')).toBe('2026-09-22');
      expect(normalizeDateString('2026-09-22')).toBe('2026-09-22');
      expect(normalizeDateString(new Date('2026-10-15T00:00:00.000Z'))).toBe('2026-10-15');
      expect(typeof normalizeDateString(null)).toBe('string');
      expect(normalizeDateString(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Schedule Repository Operations', () => {
    const mockCourse = {
      id: 'course-uuid-1',
      section_id: 'section-uuid-1',
      name: 'Software Architecture',
      code: 'CS-401',
      color_hex: '#3B82F6',
      join_code: 'ARC401',
      guest_invite_token: 'tok-123',
      is_archived: false,
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    };

    const mockBaseBlock: BaseScheduleRow = {
      id: 'block-uuid-1',
      course_id: 'course-uuid-1',
      day_of_week: 1, // Monday
      start_time: '09:00:00',
      end_time: '10:30:00',
      room: 'Room 302',
      session_type: 'lecture',
      frequency: 'weekly',
      instructor: 'Dr. Turing',
      color_override: null,
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
      course: mockCourse,
    };

    const mockOverride: ScheduleOverrideRow = {
      id: 'override-uuid-1',
      base_schedule_id: 'block-uuid-1',
      course_id: 'course-uuid-1',
      section_id: 'section-uuid-1',
      override_date: '2026-09-22',
      status: 'delayed',
      delay_minutes: 20,
      new_room: 'Hall B',
      custom_note: 'Traffic delay',
      is_makeup: false,
      makeup_start_time: null,
      makeup_end_time: null,
      created_by: 'user-cr-1',
      created_at: '2026-09-22T08:00:00.000Z',
      updated_at: '2026-09-22T08:00:00.000Z',
      course: mockCourse,
    };

    it('should safely execute getLocalBaseSchedules without errors and return an array', () => {
      const results = getLocalBaseSchedules({ dayOfWeek: 1, courseIds: ['course-uuid-1'] });
      expect(Array.isArray(results)).toBe(true);
    });

    it('should safely execute bulk upsertLocalBaseSchedules inside a transaction without error', () => {
      expect(() => upsertLocalBaseSchedules([mockBaseBlock])).not.toThrow();
      expect(() => upsertLocalBaseSchedules([])).not.toThrow();
    });

    it('should safely execute deleteLocalBaseSchedule and clearLocalBaseSchedules without error', () => {
      expect(() => deleteLocalBaseSchedule('block-uuid-1')).not.toThrow();
      expect(() => clearLocalBaseSchedules(['course-uuid-1'])).not.toThrow();
      expect(() => clearLocalBaseSchedules()).not.toThrow();
    });

    it('should safely execute getLocalScheduleOverrides with date filters', () => {
      const results = getLocalScheduleOverrides({
        courseIds: ['course-uuid-1'],
        startDate: '2026-09-20',
        endDate: '2026-09-25',
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('should safely execute bulk upsertLocalScheduleOverrides with transactional batching', () => {
      expect(() => upsertLocalScheduleOverrides([mockOverride])).not.toThrow();
      expect(() => upsertLocalScheduleOverrides([])).not.toThrow();
    });

    it('should safely execute deleteLocalScheduleOverride and clearLocalScheduleOverrides', () => {
      expect(() => deleteLocalScheduleOverride('override-uuid-1')).not.toThrow();
      expect(() => clearLocalScheduleOverrides(['course-uuid-1'])).not.toThrow();
      expect(() => clearLocalScheduleOverrides()).not.toThrow();
    });
  });

  describe('Task & Attendance Repository Operations', () => {
    const mockTask: AcademicTaskRow = {
      id: 'task-uuid-1',
      section_id: 'section-uuid-1',
      course_id: 'course-uuid-1',
      title: 'Distributed Systems Project Phase 1',
      description: 'Implement Paxos consensus',
      task_type: 'project',
      due_datetime: '2026-09-30T23:59:00.000Z',
      is_personal: false,
      created_by: 'user-cr-1',
      created_at: '2026-09-20T10:00:00.000Z',
      updated_at: '2026-09-20T10:00:00.000Z',
      is_completed: false,
    };

    const mockAttendance: AttendanceLogRow = {
      id: 'att-uuid-1',
      course_id: 'course-uuid-1',
      user_id: 'user-student-1',
      schedule_block_id: 'block-uuid-1',
      override_id: null,
      attendance_date: '2026-09-22',
      status: 'present',
      notes: null,
      created_at: '2026-09-22T09:05:00.000Z',
      updated_at: '2026-09-22T09:05:00.000Z',
    };

    it('should safely execute getLocalTasks with user completion joined without error', () => {
      const tasks = getLocalTasks({
        sectionId: 'section-uuid-1',
        courseIds: ['course-uuid-1'],
        userId: 'user-student-1',
      });
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('should safely execute upsertLocalTasks inside a transaction without error', () => {
      expect(() => upsertLocalTasks([mockTask])).not.toThrow();
      expect(() => upsertLocalTasks([])).not.toThrow();
    });

    it('should safely execute deleteLocalTask and clearLocalTasks', () => {
      expect(() => deleteLocalTask('task-uuid-1')).not.toThrow();
      expect(() => clearLocalTasks('section-uuid-1')).not.toThrow();
      expect(() => clearLocalTasks()).not.toThrow();
    });

    it('should safely execute task completion operations (get, toggle, batch set)', () => {
      expect(Array.isArray(getLocalTaskCompletions('user-student-1'))).toBe(true);
      expect(typeof toggleLocalTaskCompletion('task-uuid-1', 'user-student-1')).toBe('boolean');
      expect(() =>
        setLocalTaskCompletions('user-student-1', ['task-uuid-1', 'task-uuid-2'])
      ).not.toThrow();
    });

    it('should safely execute getLocalAttendanceLogs with date and course filters', () => {
      const logs = getLocalAttendanceLogs({
        userId: 'user-student-1',
        courseId: 'course-uuid-1',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });
      expect(Array.isArray(logs)).toBe(true);
    });

    it('should safely execute upsertLocalAttendanceLogs in a transaction without error', () => {
      expect(() => upsertLocalAttendanceLogs([mockAttendance])).not.toThrow();
      expect(() => upsertLocalAttendanceLogs([])).not.toThrow();
    });

    it('should safely execute deleteLocalAttendanceLog and clearLocalAttendanceLogs', () => {
      expect(() => deleteLocalAttendanceLog('att-uuid-1')).not.toThrow();
      expect(() => clearLocalAttendanceLogs('user-student-1')).not.toThrow();
      expect(() => clearLocalAttendanceLogs()).not.toThrow();
    });
  });
});
