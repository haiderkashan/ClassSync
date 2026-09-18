import React from 'react';
import { Stack } from 'expo-router';

/**
 * Unauthenticated Auth layout managing onboarding and sign-in routes.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
    </Stack>
  );
}
