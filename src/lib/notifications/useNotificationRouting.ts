// ============================================================================
// ClassSync Push Notification Deep Link Routing Hook
// File: src/lib/notifications/useNotificationRouting.ts
// Description: Listens for notification response events and routes the user
//              to the appropriate screen (Agenda or Task) via Expo Router.
// ============================================================================

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

/**
 * Hook that listens for user interaction with push notifications
 * and navigates to the target deep link (e.g. Agenda or specific Task).
 *
 * CRITICAL WEB GUARD: Skips native listener registration on web to prevent
 * bundler/runtime crashes on Expo Web.
 */
export function useNotificationRouting() {
  const router = useRouter();
  const isHandledInitialRef = useRef(false);

  useEffect(() => {
    // CRITICAL WEB GUARD: return early on web
    if (Platform.OS === 'web') {
      return;
    }

    // 1. Process cold-start / initial notification response (app launched via notification)
    if (!isHandledInitialRef.current) {
      isHandledInitialRef.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response?.notification) {
            handleNotificationResponse(response);
          }
        })
        .catch((err) => {
          console.warn('⚠️ [NotificationRouting] Could not retrieve initial notification response:', err);
        });
    }

    // 2. Listen for notification tap events while app is running in background or foreground
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    return () => {
      subscription.remove();
    };

    function handleNotificationResponse(response: Notifications.NotificationResponse) {
      try {
        const data = response?.notification?.request?.content?.data;
        console.log('🔔 [NotificationRouting] Notification tapped. Payload:', data);

        if (!data) return;

        // Direct URL routing
        const targetUrl = data.url;
        if (typeof targetUrl === 'string' && targetUrl.trim().length > 0) {
          console.log(`🔗 [NotificationRouting] Deep-linking to url: ${targetUrl}`);
          router.push(targetUrl as any);
          return;
        }

        // Fallback contextual routing based on payload metadata
        if (data.overrideId || data.eventCategory === 'schedule_override') {
          console.log('🔗 [NotificationRouting] Routing to Agenda: /(tabs)');
          router.push('/(tabs)');
        } else if (data.taskId || data.eventCategory === 'academic_task') {
          console.log('🔗 [NotificationRouting] Routing to Tasks: /(tabs)/tasks');
          router.push('/(tabs)/tasks');
        }
      } catch (err) {
        console.error('❌ [NotificationRouting] Error handling notification interaction:', err);
      }
    }
  }, [router]);
}
