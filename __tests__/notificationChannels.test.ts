import { Platform } from 'react-native';
import {
  NOTIFICATION_CHANNELS,
  ANDROID_CHANNEL_DEFINITIONS,
  setupAndroidNotificationChannels,
} from '@/services/notificationChannelService';

describe('Phase 9.3: Android Notification Channels & Google Play Compliance', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      configurable: true,
    });
    jest.clearAllMocks();
  });

  describe('1. Channel Configuration Schema', () => {
    it('defines mandatory channels for academic operations', () => {
      expect(NOTIFICATION_CHANNELS.URGENT_ALERTS).toBe('urgent-class-alerts');
      expect(NOTIFICATION_CHANNELS.ACADEMIC_DEADLINES).toBe('academic-deadlines');
      expect(NOTIFICATION_CHANNELS.COHORT_ANNOUNCEMENTS).toBe('cohort-announcements');
    });

    it('assigns high/max importance to urgent class alerts with vibration', () => {
      const urgentDef = ANDROID_CHANNEL_DEFINITIONS[NOTIFICATION_CHANNELS.URGENT_ALERTS];
      expect(urgentDef.importance).toBe(5); // MAX
      expect(urgentDef.enableVibrate).toBe(true);
      expect(urgentDef.vibrationPattern).toEqual([0, 250, 250, 250]);
      expect(urgentDef.showBadge).toBe(true);
    });

    it('assigns high importance to academic deadlines', () => {
      const deadlineDef = ANDROID_CHANNEL_DEFINITIONS[NOTIFICATION_CHANNELS.ACADEMIC_DEADLINES];
      expect(deadlineDef.importance).toBe(4); // HIGH
      expect(deadlineDef.enableVibrate).toBe(true);
      expect(deadlineDef.showBadge).toBe(true);
    });
  });

  describe('2. Platform Channel Registration Lifecycle', () => {
    it('bypasses channel creation safely on iOS and Web platforms', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });

      const mockNotifications = {
        setNotificationChannelAsync: jest.fn(),
      };

      const result = await setupAndroidNotificationChannels(mockNotifications);
      expect(result).toBe(false);
      expect(mockNotifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });

    it('registers all 3 channels when executing on native Android runtime', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });

      const mockNotifications = {
        setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
      };

      const result = await setupAndroidNotificationChannels(mockNotifications);
      expect(result).toBe(true);
      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledTimes(3);

      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'urgent-class-alerts',
        expect.objectContaining({
          name: 'Urgent Class Alerts',
          importance: 5,
        })
      );

      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'academic-deadlines',
        expect.objectContaining({
          name: 'Academic Deadlines & Tasks',
          importance: 4,
        })
      );

      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'cohort-announcements',
        expect.objectContaining({
          name: 'Cohort Announcements',
          importance: 3,
        })
      );
    });
  });
});
