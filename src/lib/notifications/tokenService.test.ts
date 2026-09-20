import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { registerForPushNotificationsAsync } from './tokenService';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'Test Phone',
  modelName: 'Pixel 8',
  brand: 'Google',
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'test-project-123',
      },
    },
  },
}));

describe('tokenService - registerForPushNotificationsAsync', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      configurable: true,
    });
    jest.clearAllMocks();
  });

  it('CRITICAL WEB GUARD: returns null immediately when Platform.OS is web', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'web',
      configurable: true,
    });

    const result = await registerForPushNotificationsAsync();
    expect(result).toBeNull();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns push registration result on native platform when permissions are granted', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });

    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[mock-token-abc-123]',
    });

    const result = await registerForPushNotificationsAsync();

    expect(result).not.toBeNull();
    expect(result?.token).toBe('ExponentPushToken[mock-token-abc-123]');
    expect(result?.expoPushToken).toBe('ExponentPushToken[mock-token-abc-123]');
    expect(result?.platform).toBe('android');
    expect(result?.deviceName).toBe('Test Phone');
    expect(typeof result?.timezone).toBe('string');
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ name: 'Default Notifications' })
    );
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'urgent',
      expect.objectContaining({ name: 'Urgent Schedule Alerts' })
    );
  });

  it('requests permissions if not already granted', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });

    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[mock-token-ios-456]',
    });

    const result = await registerForPushNotificationsAsync();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(result?.token).toBe('ExponentPushToken[mock-token-ios-456]');
    expect(result?.platform).toBe('ios');
  });

  it('returns null if permissions are denied', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });

    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    const result = await registerForPushNotificationsAsync();

    expect(result).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
});
