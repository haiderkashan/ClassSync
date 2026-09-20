// ============================================================================
// ClassSync Task Categorization & Deadline Utilities Unit Tests
// File: src/lib/tasks/taskUtils.test.ts
// ============================================================================

import {
  groupTasksByDeadline,
  formatDeadlineRelative,
  filterTasks,
  getTaskTypeMetadata,
  isTaskCompleted,
  AcademicTask,
} from './taskUtils';

describe('taskUtils Engine', () => {
  const referenceNow = new Date('2026-09-20T12:00:00.000Z');

  const makeTask = (
    id: string,
    title: string,
    dueOffsetMs: number,
    options?: Partial<AcademicTask>
  ): AcademicTask => ({
    id,
    title,
    description: options?.description ?? null,
    course_id: options?.course_id ?? 'course_1',
    section_id: options?.section_id ?? 'section_1',
    task_type: options?.task_type ?? 'assignment',
    due_datetime: new Date(referenceNow.getTime() + dueOffsetMs).toISOString(),
    is_personal: options?.is_personal ?? false,
    created_by: options?.created_by ?? 'user_1',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  });

  describe('isTaskCompleted', () => {
    test('handles Set<string>', () => {
      const set = new Set(['task_1', 'task_2']);
      expect(isTaskCompleted('task_1', set)).toBe(true);
      expect(isTaskCompleted('task_3', set)).toBe(false);
    });

    test('handles string[]', () => {
      const arr = ['task_1', 'task_2'];
      expect(isTaskCompleted('task_2', arr)).toBe(true);
      expect(isTaskCompleted('task_4', arr)).toBe(false);
    });

    test('handles Record<string, boolean>', () => {
      const record = { task_1: true, task_2: false };
      expect(isTaskCompleted('task_1', record)).toBe(true);
      expect(isTaskCompleted('task_2', record)).toBe(false);
      expect(isTaskCompleted('task_3', record)).toBe(false);
    });

    test('handles UserTaskCompletion[]', () => {
      const completions = [
        { id: 'c1', task_id: 'task_1', user_id: 'u1', completed_at: '' },
      ];
      expect(isTaskCompleted('task_1', completions)).toBe(true);
      expect(isTaskCompleted('task_2', completions)).toBe(false);
    });
  });

  describe('groupTasksByDeadline with Rolling 7-Day Window', () => {
    const ONE_HOUR = 60 * 60 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;
    const SEVEN_DAYS = 7 * ONE_DAY;

    test('correctly categorizes tasks based on rolling 7-day boundary', () => {
      const taskOverdueOld = makeTask('t_overdue_old', 'Assignment 1', -3 * ONE_DAY);
      const taskOverdueRecent = makeTask('t_overdue_recent', 'Quiz 1', -1000); // 1 sec ago
      const taskDueNow = makeTask('t_due_now', 'Presentation', 0); // exactly now
      const taskDueTomorrow = makeTask('t_due_tomorrow', 'Project Draft', 1 * ONE_DAY);
      const taskDueIn6Days = makeTask('t_due_6d', 'Lab Report', 6 * ONE_DAY);
      const taskDueExact7Days = makeTask('t_due_7d', 'Midterm Prep', SEVEN_DAYS); // exactly 7 days
      const taskDuePast7Days = makeTask('t_due_past_7d', 'Final Project', SEVEN_DAYS + 1000); // 7 days + 1 sec
      const taskDueFarFuture = makeTask('t_due_far', 'Term Paper', 14 * ONE_DAY);
      const taskCompleted = makeTask('t_completed', 'Done Quiz', -1 * ONE_DAY);

      const allTasks = [
        taskOverdueOld,
        taskOverdueRecent,
        taskDueNow,
        taskDueTomorrow,
        taskDueIn6Days,
        taskDueExact7Days,
        taskDuePast7Days,
        taskDueFarFuture,
        taskCompleted,
      ];

      const completions = new Set(['t_completed']);

      const grouped = groupTasksByDeadline(allTasks, completions, { now: referenceNow });

      // Completed check
      expect(grouped.completed.map((t) => t.id)).toEqual(['t_completed']);

      // Overdue check: < now and not completed
      expect(grouped.overdue.map((t) => t.id)).toEqual(['t_overdue_old', 't_overdue_recent']);

      // Due Soon check: now <= due_datetime <= now + 7 days
      expect(grouped.dueSoon.map((t) => t.id)).toEqual([
        't_due_now',
        't_due_tomorrow',
        't_due_6d',
        't_due_7d',
      ]);

      // Upcoming check: > now + 7 days
      expect(grouped.upcoming.map((t) => t.id)).toEqual([
        't_due_past_7d',
        't_due_far',
      ]);

      // Total and pending counts
      expect(grouped.totalCount).toBe(9);
      expect(grouped.pendingCount).toBe(8);
    });

    test('sorts tasks within each category chronologically', () => {
      const taskA = makeTask('t_a', 'A', 5 * 24 * 60 * 60 * 1000);
      const taskB = makeTask('t_b', 'B', 1 * 24 * 60 * 60 * 1000);
      const taskC = makeTask('t_c', 'C', 3 * 24 * 60 * 60 * 1000);

      const grouped = groupTasksByDeadline([taskA, taskB, taskC], new Set(), { now: referenceNow });

      // In Due Soon, taskB (1 day) should come before taskC (3 days), which comes before taskA (5 days)
      expect(grouped.dueSoon.map((t) => t.id)).toEqual(['t_b', 't_c', 't_a']);
    });
  });

  describe('formatDeadlineRelative', () => {
    test('formats overdue tasks accurately', () => {
      // 30 minutes overdue
      const overdue30m = new Date(referenceNow.getTime() - 30 * 60 * 1000).toISOString();
      const res30m = formatDeadlineRelative(overdue30m, referenceNow);
      expect(res30m.isOverdue).toBe(true);
      expect(res30m.text).toBe('Overdue by 30 min');

      // 4 hours overdue
      const overdue4h = new Date(referenceNow.getTime() - 4 * 60 * 60 * 1000).toISOString();
      const res4h = formatDeadlineRelative(overdue4h, referenceNow);
      expect(res4h.isOverdue).toBe(true);
      expect(res4h.text).toBe('Overdue by 4 hours');

      // 2 days overdue
      const overdue2d = new Date(referenceNow.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const res2d = formatDeadlineRelative(overdue2d, referenceNow);
      expect(res2d.isOverdue).toBe(true);
      expect(res2d.text).toBe('Overdue by 2 days');
    });

    test('formats today and tomorrow deadlines', () => {
      // Later today (3 hours after referenceNow)
      const laterToday = new Date(referenceNow.getTime() + 3 * 60 * 60 * 1000);
      const resToday = formatDeadlineRelative(laterToday, referenceNow);
      expect(resToday.isOverdue).toBe(false);
      expect(resToday.text).toContain('Due today');

      // Tomorrow (26 hours after referenceNow)
      const tomorrow = new Date(referenceNow.getTime() + 26 * 60 * 60 * 1000);
      const resTomorrow = formatDeadlineRelative(tomorrow, referenceNow);
      expect(resTomorrow.isOverdue).toBe(false);
      expect(resTomorrow.text).toContain('Due tomorrow');
    });

    test('formats upcoming deadlines within 7 days', () => {
      const in4Days = new Date(referenceNow.getTime() + 4 * 24 * 60 * 60 * 1000);
      const resIn4Days = formatDeadlineRelative(in4Days, referenceNow);
      expect(resIn4Days.isOverdue).toBe(false);
      expect(resIn4Days.text).toContain('Due in 4 days');
    });
  });

  describe('filterTasks', () => {
    const tasks: AcademicTask[] = [
      makeTask('1', 'Web Assignment 1', 1000, { course_id: 'cs101', task_type: 'assignment', is_personal: false }),
      makeTask('2', 'Web Quiz 1', 2000, { course_id: 'cs101', task_type: 'quiz', is_personal: false }),
      makeTask('3', 'Database Lab', 3000, { course_id: 'cs202', task_type: 'project', is_personal: false }),
      makeTask('4', 'Personal Review Session', 4000, { course_id: null, task_type: 'administrative', is_personal: true }),
    ];

    test('filters by courseId', () => {
      const filtered = filterTasks(tasks, { courseId: 'cs101' });
      expect(filtered.map((t) => t.id)).toEqual(['1', '2']);
    });

    test('filters by taskType', () => {
      const filtered = filterTasks(tasks, { taskType: 'quiz' });
      expect(filtered.map((t) => t.id)).toEqual(['2']);
    });

    test('filters by personal vs cohort', () => {
      const personalOnly = filterTasks(tasks, { isPersonal: true });
      expect(personalOnly.map((t) => t.id)).toEqual(['4']);

      const cohortOnly = filterTasks(tasks, { isPersonal: false });
      expect(cohortOnly.map((t) => t.id)).toEqual(['1', '2', '3']);
    });

    test('filters by searchQuery matching title or description', () => {
      const searched = filterTasks(tasks, { searchQuery: 'database' });
      expect(searched.map((t) => t.id)).toEqual(['3']);
    });
  });

  describe('getTaskTypeMetadata', () => {
    test('returns defined metadata for known task types', () => {
      expect(getTaskTypeMetadata('assignment').label).toBe('Assignment');
      expect(getTaskTypeMetadata('quiz').label).toBe('Quiz / Exam');
      expect(getTaskTypeMetadata('project').label).toBe('Project');
      expect(getTaskTypeMetadata('presentation').label).toBe('Presentation');
      expect(getTaskTypeMetadata('administrative').label).toBe('Announcement');
    });

    test('returns safe fallback for unknown task type', () => {
      const meta = getTaskTypeMetadata('unknown_type');
      expect(meta.label).toBe('unknown_type');
      expect(meta.icon).toBe('bookmark-outline');
    });
  });
});
