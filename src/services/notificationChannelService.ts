import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const NOTIFICATION_CHANNELS = {
  URGENT_ALERTS: 'urgent-class-alerts',
  ACADEMIC_DEADLINES: 'academic-deadlines',
  COHORT_ANNOUNCEMENTS: 'cohort-announcements',
} as const;

export type NotificationChannelId =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

export interface ChannelConfig {
  id: NotificationChannelId;
  name: string;
  description: string;
  importance: number; // Expo AndroidImportance enum (4 = HIGH, 5 = MAX, 3 = DEFAULT)
  vibrationPattern?: number[];
  enableLights?: boolean;
  lightColor?: string;
  enableVibrate?: boolean;
  showBadge?: boolean;
}

export const ANDROID_CHANNEL_DEFINITIONS: Record<NotificationChannelId, ChannelConfig> = {
  [NOTIFICATION_CHANNELS.URGENT_ALERTS]: {
    id: NOTIFICATION_CHANNELS.URGENT_ALERTS,
    name: 'Urgent Class Alerts',
    description: 'Instant notifications for class cancellations, room relocations, and schedule emergencies.',
    importance: 5, // AndroidImportance.MAX (heads-up notification)
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
    lightColor: '#EF4444',
    enableVibrate: true,
    showBadge: true,
  },
  [NOTIFICATION_CHANNELS.ACADEMIC_DEADLINES]: {
    id: NOTIFICATION_CHANNELS.ACADEMIC_DEADLINES,
    name: 'Academic Deadlines & Tasks',
    description: 'Reminders and countdown alerts for upcoming assignments, quizzes, and project milestones.',
    importance: 4, // AndroidImportance.HIGH
    vibrationPattern: [0, 250],
    enableLights: true,
    lightColor: '#F59E0B',
    enableVibrate: true,
    showBadge: true,
  },
  [NOTIFICATION_CHANNELS.COHORT_ANNOUNCEMENTS]: {
    id: NOTIFICATION_CHANNELS.COHORT_ANNOUNCEMENTS,
    name: 'Cohort Announcements',
    description: 'Broadcasts and general announcements from your course representatives.',
    importance: 3, // AndroidImportance.DEFAULT
    vibrationPattern: [0, 150],
    enableLights: false,
    enableVibrate: true,
    showBadge: true,
  },
};

/**
 * Registers all Android notification channels required for Google Play Store (API 26+) compliance.
 * Safely guards against running on Web or Expo Go.
 */
export async function setupAndroidNotificationChannels(
  notificationsModule?: any
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  // Detect Expo Go
  const isExpoGo =
    Constants?.appOwnership === 'expo' ||
    (Constants as any)?.executionEnvironment === 'storeClient';

  if (isExpoGo) {
    return false;
  }

  try {
    const Notifications = notificationsModule || require('expo-notifications');
    if (!Notifications || !Notifications.setNotificationChannelAsync) {
      return false;
    }

    for (const channelId of Object.values(NOTIFICATION_CHANNELS)) {
      const def = ANDROID_CHANNEL_DEFINITIONS[channelId];
      await Notifications.setNotificationChannelAsync(channelId, {
        name: def.name,
        description: def.description,
        importance: def.importance,
        vibrationPattern: def.vibrationPattern,
        enableLights: def.enableLights,
        lightColor: def.lightColor,
        enableVibrate: def.enableVibrate,
        showBadge: def.showBadge,
      });
    }

    return true;
  } catch (err) {
    console.warn('⚠️ [NotificationChannels] Failed to configure Android channels:', err);
    return false;
  }
}
