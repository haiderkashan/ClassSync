import { Platform } from 'react-native';
import * as Brightness from 'expo-brightness';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';

export const PRESENTER_KEEP_AWAKE_TAG = 'presenter_hud_keep_awake';

export interface PresenterDisplayCleanup {
  (): Promise<void>;
}

/**
 * Activates high-brightness mode strictly at the app/activity level.
 * Avoids Android system-level WRITE_SETTINGS permission crashes.
 * On web, this is a safe no-op.
 *
 * @returns Cleanup function to restore previous brightness level
 */
export async function maximizeBrightness(): Promise<() => Promise<void>> {
  if (Platform.OS === 'web') {
    return async () => {};
  }

  let originalBrightness: number | null = null;
  try {
    originalBrightness = await Brightness.getBrightnessAsync();
    await Brightness.setBrightnessAsync(1.0);
  } catch (error) {
    console.warn('⚠️ [DisplayService] Failed to adjust app brightness:', error);
  }

  return async () => {
    if (Platform.OS === 'web' || originalBrightness === null) return;
    try {
      await Brightness.setBrightnessAsync(originalBrightness);
    } catch (error) {
      console.warn('⚠️ [DisplayService] Failed to restore app brightness:', error);
    }
  };
}

/**
 * Locks device screen orientation to PORTRAIT_UP.
 * On web, this is a safe no-op.
 *
 * @returns Cleanup function to unlock screen orientation
 */
export async function lockPortraitOrientation(): Promise<() => Promise<void>> {
  if (Platform.OS === 'web') {
    return async () => {};
  }

  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch (error) {
    console.warn('⚠️ [DisplayService] Failed to lock screen orientation:', error);
  }

  return async () => {
    if (Platform.OS === 'web') return;
    try {
      await ScreenOrientation.unlockAsync();
    } catch (error) {
      console.warn('⚠️ [DisplayService] Failed to unlock screen orientation:', error);
    }
  };
}

/**
 * Prevents screen from dimming/sleeping during presentations.
 * On web, this safely falls back or no-ops.
 *
 * @returns Cleanup function to release keep-awake lock
 */
export async function activatePresentationKeepAwake(): Promise<() => Promise<void>> {
  if (Platform.OS === 'web') {
    return async () => {};
  }

  try {
    await activateKeepAwakeAsync(PRESENTER_KEEP_AWAKE_TAG);
  } catch (error) {
    console.warn('⚠️ [DisplayService] Failed to activate keep-awake:', error);
  }

  return async () => {
    if (Platform.OS === 'web') return;
    try {
      await deactivateKeepAwake(PRESENTER_KEEP_AWAKE_TAG);
    } catch (error) {
      console.warn('⚠️ [DisplayService] Failed to deactivate keep-awake:', error);
    }
  };
}

/**
 * Composite manager that enables maximum brightness, keep-awake, and portrait lock.
 * Safe for all platforms with strict web guards and error handling.
 *
 * @returns Unified cleanup function to restore all display settings
 */
export async function setupPresenterDisplayMode(): Promise<PresenterDisplayCleanup> {
  if (Platform.OS === 'web') {
    return async () => {};
  }

  const [restoreBrightness, unlockOrientation, deactivateAwake] = await Promise.all([
    maximizeBrightness(),
    lockPortraitOrientation(),
    activatePresentationKeepAwake(),
  ]);

  return async () => {
    await Promise.allSettled([
      restoreBrightness(),
      unlockOrientation(),
      deactivateAwake(),
    ]);
  };
}
