import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/expo';
import { useSupabase } from '@/hooks/useSupabase';
import { useAppStore } from '@/store/useAppStore';
import { replayOfflineMutations } from '@/services/mutationReplayWorker';
import { syncEntityDeltas } from '@/services/deltaSyncService';
import { getPendingMutationCount } from '@/lib/db/mutationQueue';

export interface UseOfflineSyncOptions {
  enabled?: boolean;
  debounceMs?: number;
  foregroundThrottleMs?: number;
}

export interface UseOfflineSyncResult {
  isOnline: boolean | null;
  isSyncing: boolean;
  pendingCount: number;
  triggerSync: (reason?: string) => Promise<void>;
  refreshPendingCount: () => void;
}

/**
 * Coordination hook for background offline sync and mutation replay.
 * 
 * 1. Listens for offline-to-online network transitions (with debounce against Wi-Fi flapping).
 * 2. Listens for AppState foreground activations (throttled to avoid sync thrashing).
 * 3. Coordinates sequential execution: Replay Worker (Push) -> Delta Sync (Pull) -> UI Cache Invalidation.
 */
export function useOfflineSync(
  options: UseOfflineSyncOptions = {}
): UseOfflineSyncResult {
  const {
    enabled = true,
    debounceMs = 1000,
    foregroundThrottleMs = 15000,
  } = options;

  const { user } = useUser();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { activeSectionId, activeCourses } = useAppStore();

  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const wasOfflineRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastForegroundSyncRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);

  const refreshPendingCount = useCallback(() => {
    try {
      const count = getPendingMutationCount();
      setPendingCount(count);
    } catch {
      // Graceful fallback
    }
  }, []);

  const runFullSyncCycle = useCallback(
    async (reason = 'manual_trigger') => {
      if (isSyncingRef.current) {
        console.log(`⚡ [useOfflineSync] Sync cycle already running. Skipping (${reason}).`);
        return;
      }

      // Battery Safeguard: Verify device has active network connection
      const netState = await NetInfo.fetch();
      if (netState.isConnected === false) {
        console.log(`⏸️ [useOfflineSync] Device is offline. Aborting sync cycle (${reason}).`);
        setIsOnline(false);
        return;
      }

      setIsOnline(true);
      isSyncingRef.current = true;
      setIsSyncing(true);

      try {
        console.log(`🔄 [useOfflineSync] Starting full sync cycle. Trigger reason: ${reason}`);

        // Step 1: Replay offline mutation queue to remote Supabase database
        const replayResult = await replayOfflineMutations(supabase);
        refreshPendingCount();

        // Step 2: High-water mark delta synchronization
        const courseIds = (activeCourses || [])
          .filter((c) => c.is_active !== false)
          .map((c) => c.id);

        const syncResult = await syncEntityDeltas({
          supabase,
          userId: user?.id,
          sectionId: activeSectionId,
          courseIds,
        });

        console.log('✅ [useOfflineSync] Sync cycle completed:', {
          reason,
          replay: replayResult,
          deltaSync: syncResult,
        });

        // Step 3: Invalidate relevant React Query caches to refresh active screens
        queryClient.invalidateQueries({ queryKey: ['base_schedule'] });
        queryClient.invalidateQueries({ queryKey: ['schedule_overrides'] });
        queryClient.invalidateQueries({ queryKey: ['academic_tasks'] });
        queryClient.invalidateQueries({ queryKey: ['attendance_logs'] });
      } catch (err) {
        console.warn('⚠️ [useOfflineSync] Error during sync cycle:', err);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
        refreshPendingCount();
      }
    },
    [supabase, user?.id, activeSectionId, activeCourses, queryClient, refreshPendingCount]
  );

  // Initial check on mount
  useEffect(() => {
    if (!enabled) return;

    refreshPendingCount();

    NetInfo.fetch().then((state) => {
      const online = state.isConnected ?? true;
      setIsOnline(online);
      wasOfflineRef.current = !online;
      if (online) {
        runFullSyncCycle('initial_mount');
      }
    });
  }, [enabled, refreshPendingCount, runFullSyncCycle]);

  // 1. NetInfo Reconnection Listener (with Debounce against Wi-Fi flapping)
  useEffect(() => {
    if (!enabled) return;

    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);

      if (!online) {
        wasOfflineRef.current = true;
        console.log('📶 [useOfflineSync] Connection lost. Device is offline.');
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
      } else if (online && wasOfflineRef.current) {
        console.log('📶 [useOfflineSync] Connection restored. Debouncing sync to prevent Wi-Fi flapping...');
        wasOfflineRef.current = false;

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          runFullSyncCycle('network_reconnected');
          debounceTimerRef.current = null;
        }, debounceMs);
      }
    });

    return () => {
      unsubscribeNetInfo();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, debounceMs, runFullSyncCycle]);

  // 2. AppState Foreground Listener (with Throttle)
  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const now = Date.now();
        const elapsed = now - lastForegroundSyncRef.current;

        if (elapsed > foregroundThrottleMs) {
          lastForegroundSyncRef.current = now;
          console.log('📱 [useOfflineSync] App transitioned to active foreground. Triggering sync...');
          runFullSyncCycle('app_foreground');
        } else {
          console.log(
            `📱 [useOfflineSync] App foregrounded, but throttled (${Math.round(
              (foregroundThrottleMs - elapsed) / 1000
            )}s remaining).`
          );
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, foregroundThrottleMs, runFullSyncCycle]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    triggerSync: runFullSyncCycle,
    refreshPendingCount,
  };
}
