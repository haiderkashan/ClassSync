import { create } from 'zustand';

export interface AppState {
  isHydrated: boolean;
  activeSectionId: string | null;
  setHydrated: (isHydrated: boolean) => void;
  setActiveSectionId: (id: string | null) => void;
  reset: () => void;
}

/**
 * Global application store for fast in-memory client state management.
 */
export const useAppStore = create<AppState>((set) => ({
  isHydrated: true,
  activeSectionId: null,
  setHydrated: (isHydrated) => set({ isHydrated }),
  setActiveSectionId: (activeSectionId) => set({ activeSectionId }),
  reset: () => set({ isHydrated: false, activeSectionId: null }),
}));
