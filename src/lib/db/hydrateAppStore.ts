import { Platform } from 'react-native';
import { isWeb } from './platformDb';
import { initLocalDatabase } from './localDatabase';
import { getLocalBaseSchedules, getLocalScheduleOverrides } from './scheduleRepository';
import {
  getLocalTasks,
  getLocalTaskCompletions,
  getLocalAttendanceLogs,
} from './taskAttendanceRepository';
import { useAppStore } from '@/store/useAppStore';

/**
 * Hydrates the reactive L1 Zustand store directly from the local L2 SQLite database.
 * Blocks the splash screen during app boot so the user never sees a flash of empty state.
 */
export async function hydrateAppStoreFromLocalDb(userId?: string | null): Promise<void> {
  const isWebRuntime = Platform.OS === 'web' || isWeb;
  if (isWebRuntime) {
    return;
  }

  try {
    // 1. Ensure SQLite schema, WAL mode, and indexes are initialized
    initLocalDatabase();

    const store = useAppStore.getState();

    // 2. Read cached timetables and exceptions from L2 disk
    const cachedSchedules = getLocalBaseSchedules();
    const cachedOverrides = getLocalScheduleOverrides();

    // 3. Read cached tasks and completions
    const cachedTasks = getLocalTasks({
      sectionId: store.activeSectionId ?? undefined,
      userId: userId ?? undefined,
    });
    const cachedCompletions = userId ? getLocalTaskCompletions(userId) : [];

    // 4. Read cached attendance logs
    const cachedAttendance = userId ? getLocalAttendanceLogs({ userId }) : [];

    // 5. Hydrate Zustand L1 store in a single synchronous batch
    if (cachedSchedules.length > 0) {
      store.setBaseSchedules(cachedSchedules);
    }
    if (cachedOverrides.length > 0) {
      store.setOverrides(cachedOverrides);
    }
    if (cachedTasks.length > 0) {
      store.setTasks(cachedTasks);
    }
    if (cachedCompletions.length > 0) {
      store.setTaskCompletions(cachedCompletions);
    }
    if (cachedAttendance.length > 0) {
      store.setAttendanceLogs(cachedAttendance);
    }

    console.log('⚡ [Hydration] Hydrated Zustand from local SQLite on boot:', {
      schedules: cachedSchedules.length,
      overrides: cachedOverrides.length,
      tasks: cachedTasks.length,
      completions: cachedCompletions.length,
      attendanceLogs: cachedAttendance.length,
    });
  } catch (err) {
    console.warn('⚠️ [Hydration] Failed to hydrate store from local SQLite:', err);
  }
}
