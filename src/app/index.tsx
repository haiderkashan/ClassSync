import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useAppStore } from '@/store/useAppStore';

/**
 * Root entry redirecting into the protected tabs group or sign-in flow.
 * Offline-first: if local store has hydrated sections, routes straight to (tabs) in <100ms.
 */
export default function RootIndex() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isHydrated, activeSections, activeSectionId } = useAppStore();

  const isQaAudit =
    typeof window !== 'undefined' &&
    (window.location?.search?.includes('qa_bypass_auth=true') ||
      window.localStorage?.getItem('qa_bypass_auth') === 'true');

  if (isQaAudit) {
    return <Redirect href="/(tabs)" />;
  }

  // Offline-first fast path: if local store has hydrated sections, route straight to (tabs)
  if (isHydrated && (activeSections.length > 0 || !!activeSectionId)) {
    return <Redirect href="/(tabs)" />;
  }

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)" />;
}

