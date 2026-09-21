// ============================================================================
// ClassSync Push Notification Deep Link Routing Hook
// File: src/lib/notifications/useNotificationRouting.ts
// Description: Listens for notification response events and routes the user
//              to the appropriate screen (Agenda or Task) via Expo Router.
// ============================================================================

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

/**
 * Detects whether the app is executing inside Expo Go.
 * In Expo SDK 53+, push notifications were removed from Expo Go on Android.
 */
export const isExpoGo =
  Constants?.appOwnership === 'expo' ||
  (Constants as any)?.executionEnvironment === 'storeClient';

/**
 * Platform & environment safe loader for expo-notifications.
 * Returns null immediately on Web or inside Expo Go to prevent native module crashes.
 */
function getNotificationsModule() {
  if (Platform.OS === 'web' || isExpoGo) {
    return null;
  }
  try {
    return require('expo-notifications');
  } catch (err) {
    console.warn('⚠️ [NotificationRouting] expo-notifications unavailable in this runtime:', err);
    return null;
  }
}

/**
 * Hook that listens for user interaction with push notifications
 * and navigates to the target deep link (e.g. Agenda or specific Task).
 *
 * CRITICAL GUARDS:
 * 1. Bypassed on web.
 * 2. Bypassed in Expo Go (where native push notifications are not supported).
 */
export function useNotificationRouting() {
  const router = useRouter();
  const isHandledInitialRef = useRef(false);

  useEffect(() => {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      return;
    }

    // 1. Process cold-start / initial notification response (app launched via notification)
    if (!isHandledInitialRef.current) {
      isHandledInitialRef.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((response: any) => {
          if (response?.notification) {
            handleNotificationResponse(response);
          }
        })
        .catch((err: any) => {
          console.warn('⚠️ [NotificationRouting] Could not retrieve initial notification response:', err);
        });
    }

    // 2. Listen for notification tap events while app is running in background or foreground
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      handleNotificationResponse(response);
    });

    return () => {
      subscription?.remove?.();
    };

    function handleNotificationResponse(response: any) {
      try {
        const data = response?.notification?.request?.content?.data;
        console.log('🔔 [NotificationRouting] Notification tapped. Payload:', data);

        if (!data) return;

        // Direct URL routing (stripping route groups like (tabs))
        let targetUrl = data.url;
        if (typeof targetUrl === 'string' && targetUrl.trim().length > 0) {
          targetUrl = targetUrl.replace(/^\/\(tabs\)/, '') || '/';
          console.log(`🔗 [NotificationRouting] Deep-linking to url: ${targetUrl}`);
          router.push(targetUrl as any);
          return;
        }

        // Fallback contextual routing based on payload metadata
        if (data.overrideId || data.eventCategory === 'schedule_override') {
          console.log('🔗 [NotificationRouting] Routing to Agenda: /');
          router.push('/');
        } else if (data.taskId || data.eventCategory === 'academic_task') {
          console.log('🔗 [NotificationRouting] Routing to Tasks: /tasks');
          router.push('/tasks');
        }
      } catch (err) {
        console.error('❌ [NotificationRouting] Error handling notification interaction:', err);
      }
    }
  }, [router]);
}
