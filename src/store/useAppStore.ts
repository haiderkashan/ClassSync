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

export type WeekParity = 'weekly' | 'biweekly_week_a' | 'biweekly_week_b';

export interface AppState {
  isHydrated: boolean;
  activeSectionId: string | null;
  activeSections: SectionRow[];
  activeCourses: CourseRow[];
  baseSchedules: BaseScheduleRow[];
  overrides: ScheduleOverrideRow[];
  currentParity: WeekParity;
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
  reset: () => void;
}

/**
 * Global application store for fast client state management and offline-first
 * workspace, course, and timetable caching backed by AsyncStorage persistence.
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
      reset: () =>
        set({
          activeSectionId: null,
          activeSections: [],
          activeCourses: [],
          baseSchedules: [],
          overrides: [],
          currentParity: 'weekly',
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
      }),
      onRehydrateStorage: () => {
        console.log('💾 [Zustand] Hydrating offline workspace, course, and timetable cache from AsyncStorage...');
        return (state, error) => {
          if (error) {
            console.error('❌ [Zustand] Failed to rehydrate offline storage:', error);
          } else {
            console.log(
              `💾 [Zustand] Offline workspace hydration completed: ${state?.activeSections.length ?? 0} section(s), ${state?.activeCourses.length ?? 0} course(s), ${state?.baseSchedules.length ?? 0} schedule block(s), ${state?.overrides.length ?? 0} override(s), activeSectionId=${state?.activeSectionId ?? 'none'}`
            );
            state?.setHydrated(true);
          }
        };
      },
    }
  )
);
