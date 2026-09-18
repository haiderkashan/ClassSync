import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Root entry redirecting into the protected tabs group or caught by NavigationGuard.
 */
export default function RootIndex() {
  return <Redirect href="/(tabs)" />;
}
