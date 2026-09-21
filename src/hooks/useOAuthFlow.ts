import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useOAuth } from '@clerk/expo';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export type OAuthStrategy = 'oauth_google' | 'oauth_apple';

/**
 * Pre-warms the browser engine on Android and iOS to eliminate OAuth launch delay.
 */
export function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      void WebBrowser.warmUpAsync();
      return () => {
        void WebBrowser.coolDownAsync();
      };
    }
  }, []);
}

/**
 * Reusable hook managing OAuth authentication flows (Google and Apple) via Clerk.
 */
export function useOAuthFlow(strategy: OAuthStrategy) {
  const { startOAuthFlow } = useOAuth({ strategy });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startFlow = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const redirectUrl = Linking.createURL('/', { scheme: 'classsync' });
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        return { success: true };
      } else {
        return { success: false, reason: 'uncompleted_session' };
      }
    } catch (err: any) {
      // Gracefully handle user dismissing the OAuth modal
      const isCancelled =
        err?.errors?.[0]?.code === 'session_exists' ||
        err?.message?.includes('cancel') ||
        err?.message?.includes('dismissed');

      if (!isCancelled) {
        const message =
          err?.errors?.[0]?.longMessage ||
          err?.message ||
          'Authentication failed. Please try again.';
        setError(message);
        console.error(`[OAuth Flow Error - ${strategy}]:`, err);
      }
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [startOAuthFlow, strategy]);

  return {
    startFlow,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}
