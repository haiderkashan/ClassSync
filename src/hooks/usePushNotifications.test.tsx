import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { usePushNotifications } from './usePushNotifications';
import { useAuth } from '@clerk/expo';
import { useSupabase } from '@/hooks/useSupabase';
import { registerForPushNotificationsAsync } from '@/lib/notifications/tokenService';

jest.mock('@clerk/expo', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useSupabase', () => ({
  useSupabase: jest.fn(),
}));

jest.mock('@/lib/notifications/tokenService', () => ({
  registerForPushNotificationsAsync: jest.fn(),
}));

describe('usePushNotifications hook', () => {
  let mockRpc: jest.Mock;
  let hookResult: ReturnType<typeof usePushNotifications>;

  function TestHarness() {
    hookResult = usePushNotifications();
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc = jest.fn().mockResolvedValue({ data: true, error: null });
    (useSupabase as jest.Mock).mockReturnValue({ rpc: mockRpc });
  });

  it('does not register token if user is not signed in', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      isSignedIn: false,
      userId: null,
    });

    await act(async () => {
      TestRenderer.create(<TestHarness />);
    });

    expect(registerForPushNotificationsAsync).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(hookResult.expoPushToken).toBeNull();
  });

  it('registers push token via Supabase RPC when user logs in', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      isSignedIn: true,
      userId: 'user_test_123',
    });

    (registerForPushNotificationsAsync as jest.Mock).mockResolvedValue({
      token: 'ExponentPushToken[mock-device-token]',
      expoPushToken: 'ExponentPushToken[mock-device-token]',
      deviceName: 'Pixel 8',
      platform: 'android',
      timezone: 'America/New_York',
    });

    mockRpc.mockResolvedValueOnce({
      data: { id: 'token-uuid-1', expo_push_token: 'ExponentPushToken[mock-device-token]' },
      error: null,
    });

    await act(async () => {
      TestRenderer.create(<TestHarness />);
    });

    expect(registerForPushNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('register_push_token', {
      p_expo_push_token: 'ExponentPushToken[mock-device-token]',
      p_platform: 'android',
      p_timezone: 'America/New_York',
      p_device_name: 'Pixel 8',
    });
    expect(hookResult.expoPushToken).toBe('ExponentPushToken[mock-device-token]');
  });

  it('unregisters push token when user logs out', async () => {
    let authState: { isSignedIn: boolean; userId: string | null } = {
      isSignedIn: true,
      userId: 'user_test_123',
    };

    (useAuth as jest.Mock).mockImplementation(() => authState);
    (registerForPushNotificationsAsync as jest.Mock).mockResolvedValue({
      token: 'ExponentPushToken[mock-logout-token]',
      expoPushToken: 'ExponentPushToken[mock-logout-token]',
      deviceName: 'iPhone 15',
      platform: 'ios',
      timezone: 'UTC',
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<TestHarness />);
    });

    expect(hookResult.expoPushToken).toBe('ExponentPushToken[mock-logout-token]');

    // User logs out
    authState = {
      isSignedIn: false,
      userId: null,
    };

    await act(async () => {
      renderer.update(<TestHarness />);
    });

    expect(mockRpc).toHaveBeenCalledWith('unregister_push_token', {
      p_expo_push_token: 'ExponentPushToken[mock-logout-token]',
    });
    expect(hookResult.expoPushToken).toBeNull();
  });

  it('allows manual invocation of unregisterToken', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      isSignedIn: true,
      userId: 'user_manual_123',
    });

    (registerForPushNotificationsAsync as jest.Mock).mockResolvedValue({
      token: 'ExponentPushToken[manual-token]',
      expoPushToken: 'ExponentPushToken[manual-token]',
      deviceName: 'Galaxy S24',
      platform: 'android',
      timezone: 'UTC',
    });

    await act(async () => {
      TestRenderer.create(<TestHarness />);
    });

    expect(hookResult.expoPushToken).toBe('ExponentPushToken[manual-token]');

    let success: boolean = false;
    await act(async () => {
      success = await hookResult.unregisterToken();
    });

    expect(success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('unregister_push_token', {
      p_expo_push_token: 'ExponentPushToken[manual-token]',
    });
    expect(hookResult.expoPushToken).toBeNull();
  });
});
