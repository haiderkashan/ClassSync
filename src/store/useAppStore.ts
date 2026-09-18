import { create } from 'zustand';
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
 * Global application store for fast in-memory client state management and workspace/course caching.
 */
export const useAppStore = create<AppState>((set) => ({
  isHydrated: true,
  activeSectionId: null,
  activeSections: [],
  activeCourses: [],
  setHydrated: (isHydrated) => set({ isHydrated }),
  setActiveSectionId: (activeSectionId) => set({ activeSectionId }),
  setActiveSections: (activeSections) => set({ activeSections }),
  setActiveCourses: (activeCourses) => set({ activeCourses }),
  reset: () =>
    set({
      isHydrated: false,
      activeSectionId: null,
      activeSections: [],
      activeCourses: [],
    }),
}));
