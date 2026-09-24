import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useAppStore } from '@/store/useAppStore';
import { parseJoinCodeFromUrl } from '@/lib/scanner/deepLinkUtils';

/**
 * Universal Deep-Link Hook for cohort onboarding:
 * 1. Captures deep links (classsync://join?code=XYZ or https://classsync.app/join?code=XYZ).
 * 2. Persists join code to Zustand (survives OAuth redirects via partialize persistence).
 * 3. CRITICAL: Strictly defers routing until SQLite/Zustand hydration is complete (isHydrated === true).
 */
export function useDeepLinkJoin() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const isHydrated = useAppStore((state) => state.isHydrated);
  const pendingJoinCode = useAppStore((state) => state.pendingJoinCode);
  const setPendingJoinCode = useAppStore((state) => state.setPendingJoinCode);

  const initialUrlCheckedRef = useRef(false);
  const lastRoutedCodeRef = useRef<string | null>(null);

  // 1. Process incoming URL and store join code in Zustand
  const processUrl = (url: string | null) => {
    if (!url) return;
    const extractedCode = parseJoinCodeFromUrl(url);
    if (extractedCode) {
      console.log(`🔗 [DeepLink] Successfully parsed join code: ${extractedCode}`);
      setPendingJoinCode(extractedCode);
    }
  };

  // 2. Listen for deep links (cold-boot initial URL and foreground events)
  useEffect(() => {
    if (!initialUrlCheckedRef.current) {
      initialUrlCheckedRef.current = true;
      Linking.getInitialURL()
        .then((url) => {
          if (url) {
            console.log('🔗 [DeepLink] Cold-boot initial URL received:', url);
            processUrl(url);
          }
        })
        .catch((err) => {
          console.warn('⚠️ [DeepLink] Error fetching initial URL:', err);
        });
    }

    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔗 [DeepLink] Runtime URL event received:', event.url);
      processUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 3. Hydration-Aware Router: Defer navigation until BOTH auth & storage hydration complete
  useEffect(() => {
    if (!isAuthLoaded || !isHydrated) {
      // Guard: Defers routing while storage/auth is hydrating
      return;
    }

    if (!isSignedIn) {
      // If user is unauthenticated, leave pendingJoinCode in Zustand store.
      // After OAuth completes and the user signs in, this effect will re-evaluate.
      return;
    }

    if (pendingJoinCode && pendingJoinCode !== lastRoutedCodeRef.current) {
      console.log(`🚀 [DeepLink] Routing to /join-section with pending code: ${pendingJoinCode}`);
      lastRoutedCodeRef.current = pendingJoinCode;

      // Small tick to ensure router hierarchy is completely ready
      setTimeout(() => {
        router.push({
          pathname: '/join-section',
          params: { code: pendingJoinCode },
        });
      }, 50);
    }
  }, [isAuthLoaded, isHydrated, isSignedIn, pendingJoinCode, router]);

  return {
    pendingJoinCode,
    clearPendingJoinCode: () => setPendingJoinCode(null),
  };
}
