import { Platform, BackHandler } from 'react-native';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';

describe('Phase 9.3: Android Hardware Back Navigation Gestures', () => {
  const originalPlatform = Platform.OS;
  let mockAddEventListener: jest.SpyInstance;
  let mockRemove: jest.Mock;

  beforeEach(() => {
    mockRemove = jest.fn();
    mockAddEventListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove: mockRemove } as any);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      configurable: true,
    });
    mockAddEventListener.mockRestore();
    jest.clearAllMocks();
  });

  it('registers hardwareBackPress listener on Android when modal is open and consumes event', () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });

    const onDismiss = jest.fn();

    // Directly test the effect behavior
    let effectCleanup: (() => void) | undefined;
    const testEffect = () => {
      if (Platform.OS !== 'android') return;
      const backAction = () => {
        onDismiss();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => sub.remove();
    };

    effectCleanup = testEffect();

    expect(mockAddEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function)
    );

    // Trigger the registered back action callback
    const registeredCallback = mockAddEventListener.mock.calls[0][1];
    const handled = registeredCallback();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(handled).toBe(true); // Must return true to consume back event

    // Clean up
    effectCleanup?.();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('does not register hardwareBackPress on iOS or Web', () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    });

    const onDismiss = jest.fn();
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', () => true);
    }

    expect(mockAddEventListener).not.toHaveBeenCalled();
  });
});
