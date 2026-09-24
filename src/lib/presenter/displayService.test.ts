import { Platform } from 'react-native';
import * as Brightness from 'expo-brightness';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  maximizeBrightness,
  lockPortraitOrientation,
  activatePresentationKeepAwake,
  setupPresenterDisplayMode,
  PRESENTER_KEEP_AWAKE_TAG,
} from './displayService';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn(),
  setBrightnessAsync: jest.fn(),
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('expo-screen-orientation', () => ({
  OrientationLock: {
    PORTRAIT_UP: 1,
  },
  lockAsync: jest.fn(),
  unlockAsync: jest.fn(),
}));

describe('DisplayService - Presenter Display Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('Native Platform Controls (iOS / Android)', () => {
    describe('maximizeBrightness', () => {
      it('reads current brightness, maximizes to 1.0, and restores on cleanup', async () => {
        (Brightness.getBrightnessAsync as jest.Mock).mockResolvedValueOnce(0.42);
        (Brightness.setBrightnessAsync as jest.Mock).mockResolvedValue(undefined);

        const cleanup = await maximizeBrightness();

        expect(Brightness.getBrightnessAsync).toHaveBeenCalledTimes(1);
        expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(1.0);

        await cleanup();

        expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(0.42);
      });

      it('handles hardware brightness failure gracefully without throwing', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        (Brightness.getBrightnessAsync as jest.Mock).mockRejectedValueOnce(
          new Error('Simulator brightness unsupported')
        );

        const cleanup = await maximizeBrightness();
        expect(cleanup).toBeInstanceOf(Function);
        await expect(cleanup()).resolves.not.toThrow();

        warnSpy.mockRestore();
      });
    });

    describe('lockPortraitOrientation', () => {
      it('locks orientation to PORTRAIT_UP and unlocks on cleanup', async () => {
        (ScreenOrientation.lockAsync as jest.Mock).mockResolvedValueOnce(undefined);
        (ScreenOrientation.unlockAsync as jest.Mock).mockResolvedValueOnce(undefined);

        const cleanup = await lockPortraitOrientation();

        expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );

        await cleanup();

        expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);
      });

      it('handles orientation lock failure gracefully', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        (ScreenOrientation.lockAsync as jest.Mock).mockRejectedValueOnce(
          new Error('Orientation lock failed')
        );

        const cleanup = await lockPortraitOrientation();
        await expect(cleanup()).resolves.not.toThrow();

        warnSpy.mockRestore();
      });
    });

    describe('activatePresentationKeepAwake', () => {
      it('activates keep awake with tag and deactivates on cleanup', async () => {
        (activateKeepAwakeAsync as jest.Mock).mockResolvedValueOnce(undefined);
        (deactivateKeepAwake as jest.Mock).mockReturnValue(undefined);

        const cleanup = await activatePresentationKeepAwake();

        expect(activateKeepAwakeAsync).toHaveBeenCalledWith(PRESENTER_KEEP_AWAKE_TAG);

        await cleanup();

        expect(deactivateKeepAwake).toHaveBeenCalledWith(PRESENTER_KEEP_AWAKE_TAG);
      });

      it('handles keep-awake failure gracefully', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        (activateKeepAwakeAsync as jest.Mock).mockRejectedValueOnce(
          new Error('Keep awake unsupported')
        );

        const cleanup = await activatePresentationKeepAwake();
        await expect(cleanup()).resolves.not.toThrow();

        warnSpy.mockRestore();
      });
    });

    describe('setupPresenterDisplayMode', () => {
      it('orchestrates all display locks and executes composite cleanup', async () => {
        (Brightness.getBrightnessAsync as jest.Mock).mockResolvedValueOnce(0.65);
        (Brightness.setBrightnessAsync as jest.Mock).mockResolvedValue(undefined);
        (ScreenOrientation.lockAsync as jest.Mock).mockResolvedValueOnce(undefined);
        (ScreenOrientation.unlockAsync as jest.Mock).mockResolvedValueOnce(undefined);
        (activateKeepAwakeAsync as jest.Mock).mockResolvedValueOnce(undefined);
        (deactivateKeepAwake as jest.Mock).mockReturnValue(undefined);

        const cleanup = await setupPresenterDisplayMode();

        expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(1.0);
        expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
        expect(activateKeepAwakeAsync).toHaveBeenCalledWith(PRESENTER_KEEP_AWAKE_TAG);

        await cleanup();

        expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(0.65);
        expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);
        expect(deactivateKeepAwake).toHaveBeenCalledWith(PRESENTER_KEEP_AWAKE_TAG);
      });
    });
  });

  describe('Web Platform Bypass (Platform.OS === "web")', () => {
    beforeEach(() => {
      (Platform as any).OS = 'web';
    });

    it('maximizeBrightness safely no-ops on web without calling native brightness APIs', async () => {
      const cleanup = await maximizeBrightness();
      expect(Brightness.getBrightnessAsync).not.toHaveBeenCalled();
      expect(Brightness.setBrightnessAsync).not.toHaveBeenCalled();

      await cleanup();
      expect(Brightness.setBrightnessAsync).not.toHaveBeenCalled();
    });

    it('lockPortraitOrientation safely no-ops on web without calling native screen orientation', async () => {
      const cleanup = await lockPortraitOrientation();
      expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();

      await cleanup();
      expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
    });

    it('activatePresentationKeepAwake safely no-ops on web without calling native keep-awake', async () => {
      const cleanup = await activatePresentationKeepAwake();
      expect(activateKeepAwakeAsync).not.toHaveBeenCalled();

      await cleanup();
      expect(deactivateKeepAwake).not.toHaveBeenCalled();
    });

    it('setupPresenterDisplayMode safely no-ops on web and returns clean no-op cleanup', async () => {
      const cleanup = await setupPresenterDisplayMode();

      expect(Brightness.getBrightnessAsync).not.toHaveBeenCalled();
      expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
      expect(activateKeepAwakeAsync).not.toHaveBeenCalled();

      await expect(cleanup()).resolves.not.toThrow();
    });
  });
});
