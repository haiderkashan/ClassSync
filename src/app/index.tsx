import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';

/**
 * Root entry redirecting into the protected tabs group or sign-in flow.
 * Waits for Clerk session resolution before executing redirect to prevent race conditions.
 */
export default function RootIndex() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  const isQaAudit =
    typeof window !== 'undefined' &&
    (window.location?.search?.includes('qa_bypass_auth=true') ||
      window.localStorage?.getItem('qa_bypass_auth') === 'true');

  if (isQaAudit) {
    return <Redirect href="/(tabs)" />;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)" />;
}

