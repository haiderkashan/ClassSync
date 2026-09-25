import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tables } from '@/types/database.types';

export type SectionRow = Tables<'sections'> & {
  role?: 'genesis_cr' | 'co_admin' | 'member' | 'guest' | string;
};

export type CourseRow = Tables<'courses'> & {
  is_active?: boolean;
  is_muted?: boolean;
  is_guest?: boolean;
  enrollment_id?: string;
};

export type BaseScheduleRow = Tables<'base_schedule'> & {
  course?: Tables<'courses'> | null;
};

export type ScheduleOverrideRow = Tables<'schedule_overrides'> & {
  course?: Tables<'courses'> | null;
};

export type AcademicTaskRow = Tables<'academic_tasks'> & {
  course?: Tables<'courses'> | null;
  is_completed?: boolean;
};

export type TaskCompletionRow = Tables<'user_task_completions'>;

export type AttendanceLogRow = Tables<'attendance_logs'> & {
  course?: Tables<'courses'> | null;
  schedule_block?: Tables<'base_schedule'> | null;
  override?: Tables<'schedule_overrides'> | null;
};

export type WeekParity = 'weekly' | 'biweekly_week_a' | 'biweekly_week_b';

export interface UserNotificationSettings {
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  bypass_for_urgent: boolean;
  timezone: string;
}

export interface AppState {
  isHydrated: boolean;
  activeSectionId: string | null;
  activeSections: SectionRow[];
  activeCourses: CourseRow[];
  baseSchedules: BaseScheduleRow[];
  overrides: ScheduleOverrideRow[];
  currentParity: WeekParity;

  // Phase 5 Task & Attendance State Slices
  tasks: AcademicTaskRow[];
  taskCompletions: string[]; // Set of task IDs completed by the user
  attendanceLogs: AttendanceLogRow[];

  // Phase 6 Push Notification & Quiet Hours State
  pushToken: string | null;
  notificationSettings: UserNotificationSettings | null;

  // Phase 8.3 Deep Link & OAuth Persistence
  pendingJoinCode: string | null;
  setPendingJoinCode: (code: string | null) => void;

  setHydrated: (isHydrated: boolean) => void;
  setActiveSectionId: (id: string | null) => void;
  setActiveSections: (sections: SectionRow[]) => void;
  setActiveCourses: (courses: CourseRow[]) => void;
  setBaseSchedules: (schedules: BaseScheduleRow[]) => void;
  setOverrides: (overrides: ScheduleOverrideRow[]) => void;
  setCurrentParity: (parity: WeekParity) => void;
  upsertLocalScheduleBlock: (block: BaseScheduleRow) => void;
  removeLocalScheduleBlock: (blockId: string) => void;
  upsertLocalOverride: (override: ScheduleOverrideRow) => void;
  removeLocalOverride: (overrideId: string) => void;

  // Phase 5 Actions
  setTasks: (tasks: AcademicTaskRow[]) => void;
  upsertLocalTask: (task: AcademicTaskRow) => void;
  removeLocalTask: (taskId: string) => void;
  setTaskCompletions: (completionTaskIds: string[]) => void;
  toggleLocalTaskCompletion: (taskId: string) => void;
  setAttendanceLogs: (logs: AttendanceLogRow[]) => void;
  upsertLocalAttendanceLog: (log: AttendanceLogRow) => void;
  removeLocalAttendanceLog: (logId: string) => void;

  // Phase 6 Actions
  setPushToken: (token: string | null) => void;
  setNotificationSettings: (settings: UserNotificationSettings | null) => void;

  reset: () => void;
}

/**
 * Global application store for fast client state management and offline-first
 * workspace, course, timetable, tasks, and attendance caching backed by AsyncStorage persistence.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isHydrated: false,
      activeSectionId: null,
      activeSections: [],
      activeCourses: [],
      baseSchedules: [],
      overrides: [],
      currentParity: 'weekly',

      // Phase 5 Initial State
      tasks: [],
      taskCompletions: [],
      attendanceLogs: [],

      // Phase 6 Push Notification & Settings Initial State
      pushToken: null,
      notificationSettings: null,

      // Phase 8.3 Deep Link & OAuth Persistence Initial State
      pendingJoinCode: null,

      setHydrated: (isHydrated) => set({ isHydrated }),
      setActiveSectionId: (activeSectionId) => set({ activeSectionId }),
      setActiveSections: (activeSections) => set({ activeSections }),
      setActiveCourses: (activeCourses) => set({ activeCourses }),
      setBaseSchedules: (baseSchedules) => set({ baseSchedules }),
      setOverrides: (overrides) => set({ overrides }),
      setCurrentParity: (currentParity) => set({ currentParity }),
      upsertLocalScheduleBlock: (block) =>
        set((state) => {
          const index = state.baseSchedules.findIndex((b) => b.id === block.id);
          if (index >= 0) {
            const updated = [...state.baseSchedules];
            updated[index] = { ...updated[index], ...block };
            return { baseSchedules: updated };
          }
          return { baseSchedules: [...state.baseSchedules, block] };
        }),
      removeLocalScheduleBlock: (blockId) =>
        set((state) => ({
          baseSchedules: state.baseSchedules.filter((b) => b.id !== blockId),
        })),
      upsertLocalOverride: (override) =>
        set((state) => {
          const index = state.overrides.findIndex((o) => o.id === override.id);
          if (index >= 0) {
            const updated = [...state.overrides];
            updated[index] = { ...updated[index], ...override };
            return { overrides: updated };
          }
          return { overrides: [...state.overrides, override] };
        }),
      removeLocalOverride: (overrideId) =>
        set((state) => ({
          overrides: state.overrides.filter((o) => o.id !== overrideId),
        })),

      // Phase 5 Task & Attendance Store Handlers
      setTasks: (tasks) => set({ tasks }),
      upsertLocalTask: (task) =>
        set((state) => {
          const index = state.tasks.findIndex((t) => t.id === task.id);
          if (index >= 0) {
            const updated = [...state.tasks];
            updated[index] = { ...updated[index], ...task };
            return { tasks: updated };
          }
          return { tasks: [task, ...state.tasks] };
        }),
      removeLocalTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId),
          taskCompletions: state.taskCompletions.filter((id) => id !== taskId),
        })),
      setTaskCompletions: (taskCompletions) => set({ taskCompletions }),
      toggleLocalTaskCompletion: (taskId) =>
        set((state) => {
          const exists = state.taskCompletions.includes(taskId);
          const nextCompletions = exists
            ? state.taskCompletions.filter((id) => id !== taskId)
            : [...state.taskCompletions, taskId];

          const nextTasks = state.tasks.map((task) =>
            task.id === taskId ? { ...task, is_completed: !exists } : task
          );

          return {
            taskCompletions: nextCompletions,
            tasks: nextTasks,
          };
        }),
      setAttendanceLogs: (attendanceLogs) => set({ attendanceLogs }),
      upsertLocalAttendanceLog: (log) =>
        set((state) => {
          const index = state.attendanceLogs.findIndex((l) => l.id === log.id);
          if (index >= 0) {
            const updated = [...state.attendanceLogs];
            updated[index] = { ...updated[index], ...log };
            return { attendanceLogs: updated };
          }
          return { attendanceLogs: [log, ...state.attendanceLogs] };
        }),
      removeLocalAttendanceLog: (logId) =>
        set((state) => ({
          attendanceLogs: state.attendanceLogs.filter((l) => l.id !== logId),
        })),

      // Phase 6 Push Notification & Settings Handlers
      setPushToken: (pushToken) => set({ pushToken }),
      setNotificationSettings: (notificationSettings) => set({ notificationSettings }),

      // Phase 8.3 Deep Link & OAuth Persistence Handlers
      setPendingJoinCode: (pendingJoinCode) => set({ pendingJoinCode }),

      reset: () =>
        set({
          isHydrated: false,
          activeSectionId: null,
          activeSections: [],
          activeCourses: [],
          baseSchedules: [],
          overrides: [],
          currentParity: 'weekly',
          tasks: [],
          taskCompletions: [],
          attendanceLogs: [],
          pushToken: null,
          notificationSettings: null,
          pendingJoinCode: null,
        }),
    }),
    {
      name: 'classsync-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeSectionId: state.activeSectionId,
        activeSections: state.activeSections,
        activeCourses: state.activeCourses,
        baseSchedules: state.baseSchedules,
        overrides: state.overrides,
        currentParity: state.currentParity,
        tasks: state.tasks,
        taskCompletions: state.taskCompletions,
        attendanceLogs: state.attendanceLogs,
        pushToken: state.pushToken,
        notificationSettings: state.notificationSettings,
        pendingJoinCode: state.pendingJoinCode,
      }),
      onRehydrateStorage: () => {
        console.log('💾 [Zustand] Hydrating offline session and notification cache from AsyncStorage...');
        return (state, error) => {
          if (error) {
            console.error('❌ [Zustand] Failed to rehydrate offline storage:', error);
          } else {
            console.log(
              `💾 [Zustand] Offline session hydration completed: ${state?.activeSections.length ?? 0} section(s), ${state?.activeCourses.length ?? 0} course(s), ${state?.baseSchedules.length ?? 0} schedule(s), activeSectionId=${state?.activeSectionId ?? 'none'}, pushToken=${state?.pushToken ? 'configured' : 'none'}`
            );
            state?.setHydrated(true);
          }
        };
      },
    }
  )
);
