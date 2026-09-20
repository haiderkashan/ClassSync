// ============================================================================
// ClassSync Task Categorization & Deadline Utilities
// File: src/lib/tasks/taskUtils.ts
// Description: Implements task grouping by deadline using a strict rolling 7-day
//              window for "Due Soon" (avoiding arbitrary end-of-week boundaries).
//              Provides relative deadline formatting, sorting, and type metadata.
// ============================================================================

import { Database } from '../../types/database.types';

export type AcademicTask = Database['public']['Tables']['academic_tasks']['Row'];
export type UserTaskCompletion = Database['public']['Tables']['user_task_completions']['Row'];

export type TaskType = 'assignment' | 'quiz' | 'project' | 'presentation' | 'administrative';

export interface GroupedTasks {
  /** Incomplete tasks whose due_datetime is strictly in the past (< now) */
  overdue: AcademicTask[];
  /** Incomplete tasks due within the rolling 7-day window (now <= due_datetime <= now + 7 days) */
  dueSoon: AcademicTask[];
  /** Incomplete tasks due beyond the rolling 7-day window (> now + 7 days) */
  upcoming: AcademicTask[];
  /** Tasks marked completed by the current user */
  completed: AcademicTask[];
  /** Total count of all tasks across categories */
  totalCount: number;
  /** Count of pending (incomplete) tasks */
  pendingCount: number;
}

export interface TaskTypeMetadata {
  type: TaskType;
  label: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

export const TASK_TYPE_METADATA: Record<TaskType, TaskTypeMetadata> = {
  assignment: {
    type: 'assignment',
    label: 'Assignment',
    icon: 'document-text-outline',
    badgeBg: '#EFF6FF',
    badgeText: '#2563EB',
    borderColor: '#93C5FD',
  },
  quiz: {
    type: 'quiz',
    label: 'Quiz / Exam',
    icon: 'help-circle-outline',
    badgeBg: '#FEF2F2',
    badgeText: '#DC2626',
    borderColor: '#FCA5A5',
  },
  project: {
    type: 'project',
    label: 'Project',
    icon: 'folder-outline',
    badgeBg: '#FAF5FF',
    badgeText: '#7C3AED',
    borderColor: '#D8B4FE',
  },
  presentation: {
    type: 'presentation',
    label: 'Presentation',
    icon: 'easel-outline',
    badgeBg: '#FFFBEB',
    badgeText: '#D97706',
    borderColor: '#FCD34D',
  },
  administrative: {
    type: 'administrative',
    label: 'Announcement',
    icon: 'megaphone-outline',
    badgeBg: '#F0FDF4',
    badgeText: '#16A34A',
    borderColor: '#86EFAC',
  },
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checks if a task is marked completed in a Set, array, or completion map.
 */
export function isTaskCompleted(
  taskId: string,
  completions: Set<string> | string[] | Record<string, string | boolean> | UserTaskCompletion[]
): boolean {
  if (completions instanceof Set) {
    return completions.has(taskId);
  }
  if (Array.isArray(completions)) {
    if (completions.length === 0) return false;
    if (typeof completions[0] === 'string') {
      return (completions as string[]).includes(taskId);
    }
    return (completions as UserTaskCompletion[]).some((c) => c.task_id === taskId);
  }
  if (typeof completions === 'object' && completions !== null) {
    return Boolean(completions[taskId]);
  }
  return false;
}

export interface GroupTasksOptions {
  /** Optional reference time for unit testing / predictable calculation. Defaults to new Date(). */
  now?: Date;
  /** Optional custom rolling window in milliseconds. Defaults to 7 days (7 * 24 * 60 * 60 * 1000 ms). */
  rollingWindowMs?: number;
}

/**
 * Groups academic tasks into Overdue, Due Soon (rolling 7 days), Upcoming (> 7 days), and Completed.
 *
 * CRITICAL DIRECTIVE:
 * Uses a rolling 7-day window (now <= due_datetime <= now + 7 days) rather than arbitrary "End of Week"
 * to avoid abrupt day-of-week context switches for students.
 */
export function groupTasksByDeadline(
  tasks: AcademicTask[],
  completions: Set<string> | string[] | Record<string, string | boolean> | UserTaskCompletion[],
  options?: GroupTasksOptions
): GroupedTasks {
  const now = options?.now ? new Date(options.now).getTime() : Date.now();
  const rollingWindowMs = options?.rollingWindowMs ?? SEVEN_DAYS_MS;
  const windowEnd = now + rollingWindowMs;

  const overdue: AcademicTask[] = [];
  const dueSoon: AcademicTask[] = [];
  const upcoming: AcademicTask[] = [];
  const completed: AcademicTask[] = [];

  for (const task of tasks) {
    if (isTaskCompleted(task.id, completions)) {
      completed.push(task);
      continue;
    }

    const dueTime = new Date(task.due_datetime).getTime();

    if (dueTime < now) {
      overdue.push(task);
    } else if (dueTime <= windowEnd) {
      dueSoon.push(task);
    } else {
      upcoming.push(task);
    }
  }

  // Sort tasks within each group
  // Overdue: ascending by due_datetime (oldest overdue first)
  overdue.sort((a, b) => new Date(a.due_datetime).getTime() - new Date(b.due_datetime).getTime());

  // Due Soon: ascending by due_datetime (most urgent first)
  dueSoon.sort((a, b) => new Date(a.due_datetime).getTime() - new Date(b.due_datetime).getTime());

  // Upcoming: ascending by due_datetime (closest upcoming first)
  upcoming.sort((a, b) => new Date(a.due_datetime).getTime() - new Date(b.due_datetime).getTime());

  // Completed: descending by due_datetime (most recently due first)
  completed.sort((a, b) => new Date(b.due_datetime).getTime() - new Date(a.due_datetime).getTime());

  return {
    overdue,
    dueSoon,
    upcoming,
    completed,
    totalCount: tasks.length,
    pendingCount: overdue.length + dueSoon.length + upcoming.length,
  };
}

/**
 * Formats a task due date into a student-friendly relative deadline string.
 * Examples:
 * - "Overdue by 2 hours"
 * - "Overdue by 1 day"
 * - "Due today at 11:59 PM"
 * - "Due tomorrow at 10:00 AM"
 * - "Due in 3 days (Wed)"
 * - "Due Oct 15 at 2:00 PM"
 */
export function formatDeadlineRelative(
  dueDatetime: string | Date,
  referenceNow?: Date
): { text: string; isUrgent: boolean; isOverdue: boolean } {
  const dueDate = new Date(dueDatetime);
  const now = referenceNow ? new Date(referenceNow) : new Date();

  const diffMs = dueDate.getTime() - now.getTime();
  const isOverdue = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);

  const minutes = Math.floor(absDiffMs / (1000 * 60));
  const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

  const timeStr = dueDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isOverdue) {
    if (minutes < 60) {
      return {
        text: `Overdue by ${Math.max(1, minutes)} min`,
        isUrgent: true,
        isOverdue: true,
      };
    }
    if (hours < 24) {
      return {
        text: `Overdue by ${hours} ${hours === 1 ? 'hour' : 'hours'}`,
        isUrgent: true,
        isOverdue: true,
      };
    }
    return {
      text: `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`,
      isUrgent: true,
      isOverdue: true,
    };
  }

  // Same calendar day
  const isToday =
    dueDate.getFullYear() === now.getFullYear() &&
    dueDate.getMonth() === now.getMonth() &&
    dueDate.getDate() === now.getDate();

  if (isToday) {
    return {
      text: `Due today at ${timeStr}`,
      isUrgent: true,
      isOverdue: false,
    };
  }

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    dueDate.getFullYear() === tomorrow.getFullYear() &&
    dueDate.getMonth() === tomorrow.getMonth() &&
    dueDate.getDate() === tomorrow.getDate();

  if (isTomorrow) {
    return {
      text: `Due tomorrow at ${timeStr}`,
      isUrgent: true,
      isOverdue: false,
    };
  }

  // Within 7 days
  if (days < 7) {
    const weekday = dueDate.toLocaleDateString([], { weekday: 'short' });
    return {
      text: `Due in ${days} days (${weekday})`,
      isUrgent: days <= 2,
      isOverdue: false,
    };
  }

  // Further out
  const monthDay = dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return {
    text: `Due ${monthDay} at ${timeStr}`,
    isUrgent: false,
    isOverdue: false,
  };
}

/**
 * Returns metadata (label, icon, styling colors) for a given task type.
 */
export function getTaskTypeMetadata(taskType: string): TaskTypeMetadata {
  const normalized = taskType.toLowerCase() as TaskType;
  return TASK_TYPE_METADATA[normalized] ?? {
    type: 'assignment',
    label: taskType,
    icon: 'bookmark-outline',
    badgeBg: '#F3F4F6',
    badgeText: '#4B5563',
    borderColor: '#D1D5DB',
  };
}

export interface TaskFilterOptions {
  courseId?: string | null;
  taskType?: TaskType | 'all';
  isPersonal?: boolean | null;
  searchQuery?: string;
}

/**
 * Filters a list of academic tasks by course, task type, personal/cohort, and text search.
 */
export function filterTasks(tasks: AcademicTask[], filters: TaskFilterOptions): AcademicTask[] {
  return tasks.filter((task) => {
    // Course filter
    if (filters.courseId !== undefined && filters.courseId !== null) {
      if (task.course_id !== filters.courseId) return false;
    }

    // Task type filter
    if (filters.taskType && filters.taskType !== 'all') {
      if (task.task_type.toLowerCase() !== filters.taskType.toLowerCase()) return false;
    }

    // Personal vs cohort filter
    if (filters.isPersonal !== undefined && filters.isPersonal !== null) {
      if (task.is_personal !== filters.isPersonal) return false;
    }

    // Search query filter
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const query = filters.searchQuery.trim().toLowerCase();
      const titleMatch = task.title.toLowerCase().includes(query);
      const descMatch = task.description ? task.description.toLowerCase().includes(query) : false;
      if (!titleMatch && !descMatch) return false;
    }

    return true;
  });
}
