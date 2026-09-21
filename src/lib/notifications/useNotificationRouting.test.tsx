import React from 'react';
import { Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useNotificationRouting } from './useNotificationRouting';

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('useNotificationRouting hook', () => {
  const originalPlatform = Platform.OS;
  let mockPush: jest.Mock;
  let mockSubscription: { remove: jest.Mock };
  let listenerCallback: ((response: any) => void) | null = null;

  function TestComponent() {
    useNotificationRouting();
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    mockSubscription = { remove: jest.fn() };
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
      listenerCallback = cb;
      return mockSubscription;
    });
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      configurable: true,
    });
  });

  it('CRITICAL WEB GUARD: skips registering notification listeners on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'web',
      configurable: true,
    });

    await act(async () => {
      TestRenderer.create(<TestComponent />);
    });

    expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
    expect(Notifications.getLastNotificationResponseAsync).not.toHaveBeenCalled();
  });

  it('registers listener and routes to explicit data.url on notification tap', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });

    await act(async () => {
      TestRenderer.create(<TestComponent />);
    });

    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);

    // Simulate user tapping a notification
    act(() => {
      if (listenerCallback) {
        listenerCallback({
          notification: {
            request: {
              content: {
                data: { url: '/(tabs)/tasks' },
              },
            },
          },
        });
      }
    });

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/tasks');
  });

  it('routes to Agenda when overrideId is in payload', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });

    await act(async () => {
      TestRenderer.create(<TestComponent />);
    });

    act(() => {
      if (listenerCallback) {
        listenerCallback({
          notification: {
            request: {
              content: {
                data: { overrideId: 'override-uuid-123' },
              },
            },
          },
        });
      }
    });

    expect(mockPush).toHaveBeenCalledWith('/(tabs)');
  });

  it('removes listener on unmount', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<TestComponent />);
    });

    await act(async () => {
      renderer.unmount();
    });

    expect(mockSubscription.remove).toHaveBeenCalled();
  });
});
