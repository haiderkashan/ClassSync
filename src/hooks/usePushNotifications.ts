import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useSupabase } from '@/hooks/useSupabase';
import { registerForPushNotificationsAsync, PushRegistrationResult } from '@/lib/notifications/tokenService';

export interface UsePushNotificationsReturn {
  expoPushToken: string | null;
  isRegistering: boolean;
  registerToken: () => Promise<PushRegistrationResult | null>;
  unregisterToken: (tokenToUnregister?: string) => Promise<boolean>;
}

/**
 * Hook that manages the push notification registration lifecycle tied to the user's auth state.
 *
 * Lifecycle:
 * - On Login (isSignedIn === true && userId): Obtains the Expo Push Token and calls
 *   the atomic `register_push_token` Supabase RPC to register/reassign the token.
 * - On Logout (!isSignedIn): Calls `unregister_push_token` to deactivate the token
 *   and resets local token state.
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const { isSignedIn, userId } = useAuth();
  const supabase = useSupabase();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  const activeTokenRef = useRef<string | null>(null);
  const lastRegisteredUserIdRef = useRef<string | null>(null);

  /**
   * Registers or updates the push notification token in Supabase.
   */
  const registerToken = useCallback(async (): Promise<PushRegistrationResult | null> => {
    if (!isSignedIn || !userId) {
      return null;
    }

    setIsRegistering(true);
    try {
      console.log(`📱 [PushNotifications] Attempting token registration for user: ${userId}`);
      const registrationInfo = await registerForPushNotificationsAsync();

      if (!registrationInfo) {
        console.log('ℹ️ [PushNotifications] Push registration skipped or unavailable on this platform.');
        return null;
      }

      const { data, error } = await supabase.rpc('register_push_token', {
        p_expo_push_token: registrationInfo.token,
        p_platform: registrationInfo.platform,
        p_timezone: registrationInfo.timezone,
        p_device_name: registrationInfo.deviceName ?? undefined,
      });

      if (error) {
        console.error('❌ [PushNotifications] Failed to register token via RPC:', error.message);
        return null;
      }

      activeTokenRef.current = registrationInfo.token;
      lastRegisteredUserIdRef.current = userId;
      setExpoPushToken(registrationInfo.token);
      console.log('✅ [PushNotifications] Token registered successfully in Supabase for user:', userId);
      return registrationInfo;
    } catch (err) {
      console.error('❌ [PushNotifications] Unexpected error during push registration:', err);
      return null;
    } finally {
      setIsRegistering(false);
    }
  }, [isSignedIn, userId, supabase]);

  /**
   * Unregisters / deactivates the push notification token in Supabase.
   */
  const unregisterToken = useCallback(async (tokenToUnregister?: string): Promise<boolean> => {
    const token = tokenToUnregister || activeTokenRef.current || expoPushToken;
    if (!token) {
      return false;
    }

    try {
      console.log('📱 [PushNotifications] Unregistering token from Supabase...');
      const { data, error } = await supabase.rpc('unregister_push_token', {
        p_expo_push_token: token,
      });

      if (error) {
        console.warn('⚠️ [PushNotifications] Failed to unregister token via RPC:', error.message);
      }

      activeTokenRef.current = null;
      // Note: We keep lastRegisteredUserIdRef.current intact while signed in to avoid
      // re-triggering auto-registration in the next render cycle.
      setExpoPushToken(null);
      console.log('✅ [PushNotifications] Token unregistered locally and remotely.');
      return !!data;
    } catch (err) {
      console.warn('⚠️ [PushNotifications] Error during push unregistration:', err);
      activeTokenRef.current = null;
      setExpoPushToken(null);
      return false;
    }
  }, [supabase, expoPushToken]);

  // Auth Lifecycle Listener:
  // Trigger registration upon sign-in, trigger unregistration upon sign-out.
  useEffect(() => {
    if (isSignedIn && userId) {
      if (lastRegisteredUserIdRef.current !== userId) {
        void registerToken();
      }
    } else if (!isSignedIn && lastRegisteredUserIdRef.current) {
      const tokenToCleanup = activeTokenRef.current;
      lastRegisteredUserIdRef.current = null;
      if (tokenToCleanup) {
        void unregisterToken(tokenToCleanup);
      } else {
        setExpoPushToken(null);
      }
    }
  }, [isSignedIn, userId, registerToken, unregisterToken]);

  return {
    expoPushToken,
    isRegistering,
    registerToken,
    unregisterToken,
  };
}
