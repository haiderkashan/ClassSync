import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  getLocalDateString,
  getDayOfWeekFromDateString,
  getMillisecondsUntilMidnight,
} from '@/lib/schedule/calendarUtils';

export interface UseLiveDayWatcherOptions {
  timezone?: string;
  onDayChange?: (newDateString: string, newDayOfWeek: number) => void;
}

export interface UseLiveDayWatcherResult {
  todayDateString: string;
  todayDayOfWeek: number;
  forceRefresh: () => void;
}

/**
 * Custom React Hook that keeps the application's active date and day-of-week
 * strictly synchronized with wall-clock time in the section's IANA timezone.
 *
 * Capabilities:
 * 1. AppState Listening: Automatically re-evaluates the calendar date when the device
 *    wakes up from background/sleep to foreground ('active').
 * 2. Precision Midnight Timer: Computes exact milliseconds remaining until local midnight
 *    (00:00:01 AM) and schedules a zero-cost timer that invalidates timetable caches
 *    and triggers a clean rollover.
 * 3. Cache Invalidation: Invalidates TanStack Query schedule keys on day rollover
 *    so the Student Agenda updates seamlessly without user interaction.
 */
export function useLiveDayWatcher({
  timezone = 'UTC',
  onDayChange,
}: UseLiveDayWatcherOptions = {}): UseLiveDayWatcherResult {
  const queryClient = useQueryClient();

  // Initialize with the current local date in the specified timezone
  const resolveCurrentDate = useCallback(() => {
    const dateStr = getLocalDateString(new Date(), timezone);
    const dayOfWeek = getDayOfWeekFromDateString(dateStr);
    return { dateStr, dayOfWeek };
  }, [timezone]);

  const [currentDateState, setCurrentDateState] = useState(resolveCurrentDate);

  const onDayChangeRef = useRef(onDayChange);
  useEffect(() => {
    onDayChangeRef.current = onDayChange;
  }, [onDayChange]);

  const checkAndRollOverDate = useCallback(() => {
    const { dateStr, dayOfWeek } = resolveCurrentDate();

    setCurrentDateState((prev) => {
      if (prev.dateStr !== dateStr || prev.dayOfWeek !== dayOfWeek) {
        // Trigger cache invalidation for schedules and overrides
        queryClient.invalidateQueries({ queryKey: ['base_schedules'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_overrides'] });

        // Invoke optional callback
        onDayChangeRef.current?.(dateStr, dayOfWeek);

        return { dateStr, dayOfWeek };
      }
      return prev;
    });
  }, [resolveCurrentDate, queryClient]);

  // 1. AppState Lifecycle Listener
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkAndRollOverDate();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [checkAndRollOverDate]);

  // 2. Precision Midnight Rollover Timer
  useEffect(() => {
    const msUntilMidnight = getMillisecondsUntilMidnight(timezone);

    const timerId = setTimeout(() => {
      checkAndRollOverDate();
    }, msUntilMidnight);

    return () => {
      clearTimeout(timerId);
    };
  }, [timezone, currentDateState.dateStr, checkAndRollOverDate]);

  return {
    todayDateString: currentDateState.dateStr,
    todayDayOfWeek: currentDateState.dayOfWeek,
    forceRefresh: checkAndRollOverDate,
  };
}
