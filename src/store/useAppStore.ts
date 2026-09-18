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

export interface AppState {
  isHydrated: boolean;
  activeSectionId: string | null;
  activeSections: SectionRow[];
  activeCourses: CourseRow[];
  setHydrated: (isHydrated: boolean) => void;
  setActiveSectionId: (id: string | null) => void;
  setActiveSections: (sections: SectionRow[]) => void;
  setActiveCourses: (courses: CourseRow[]) => void;
  reset: () => void;
}

/**
 * Global application store for fast client state management and offline-first
 * workspace/course caching backed by AsyncStorage persistence.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isHydrated: false,
      activeSectionId: null,
      activeSections: [],
      activeCourses: [],
      setHydrated: (isHydrated) => set({ isHydrated }),
      setActiveSectionId: (activeSectionId) => set({ activeSectionId }),
      setActiveSections: (activeSections) => set({ activeSections }),
      setActiveCourses: (activeCourses) => set({ activeCourses }),
      reset: () =>
        set({
          activeSectionId: null,
          activeSections: [],
          activeCourses: [],
        }),
    }),
    {
      name: 'classsync-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeSectionId: state.activeSectionId,
        activeSections: state.activeSections,
        activeCourses: state.activeCourses,
      }),
      onRehydrateStorage: () => {
        console.log('💾 [Zustand] Hydrating offline workspace and course cache from AsyncStorage...');
        return (state, error) => {
          if (error) {
            console.error('❌ [Zustand] Failed to rehydrate offline storage:', error);
          } else {
            console.log(
              `💾 [Zustand] Offline workspace hydration completed: ${state?.activeSections.length ?? 0} section(s), ${state?.activeCourses.length ?? 0} course(s), activeSectionId=${state?.activeSectionId ?? 'none'}`
            );
            state?.setHydrated(true);
          }
        };
      },
    }
  )
);
