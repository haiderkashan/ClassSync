import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export interface PushRegistrationResult {
  token: string;
  expoPushToken: string;
  deviceName: string | null;
  platform: 'ios' | 'android';
  timezone: string;
}

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
    console.warn('⚠️ [TokenService] expo-notifications unavailable in this runtime:', err);
    return null;
  }
}

/**
 * Configure foreground notification behavior on native platforms outside Expo Go.
 */
const initialNotifications = getNotificationsModule();
if (initialNotifications) {
  try {
    initialNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('⚠️ [TokenService] Failed to set notification handler:', err);
  }
}

/**
 * Platform-safe push notification registration service.
 *
 * CRITICAL GUARDS: Immediately returns null if Platform.OS === 'web' or inside Expo Go
 * before executing any native notification or device API calls.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult | null> {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    if (isExpoGo) {
      console.log('ℹ️ [TokenService] Push notifications are not supported in Expo Go (SDK 53+). Please use an EAS development build.');
    }
    return null;
  }

  try {
    // 1. Android Notification Channels configuration
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#188BF6',
      });

      await Notifications.setNotificationChannelAsync('urgent', {
        name: 'Urgent Schedule Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EF4444',
      });
    }

    // 2. Permissions check & prompt
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ [TokenService] Notification permission not granted:', finalStatus);
      return null;
    }

    // 3. Physical device verification check
    if (!Device.isDevice) {
      console.warn('⚠️ [TokenService] Running on simulator/emulator; remote push tokens may not be delivered.');
    }

    // 4. Resolve EAS Project ID
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    // 5. Fetch Expo Push Token
    const pushTokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = pushTokenData?.data;
    if (!token) {
      console.warn('⚠️ [TokenService] Expo push token returned empty.');
      return null;
    }

    // 6. Extract Device metadata
    const deviceName = Device.deviceName ?? Device.modelName ?? `${Device.brand ?? ''} Device`.trim();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    return {
      token,
      expoPushToken: token,
      deviceName: deviceName || null,
      platform: Platform.OS as 'ios' | 'android',
      timezone,
    };
  } catch (error) {
    console.error('❌ [TokenService] Error registering for push notifications:', error);
    return null;
  }
}
