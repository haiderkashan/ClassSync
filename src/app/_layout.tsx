import '../../global.css';
import { env } from '@/lib/env';
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProviders } from '@/providers';

// Boot-time environment validation check
console.log(`[ClassSync] Booting in ${env.EXPO_PUBLIC_APP_ENV} mode`);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
      </AppProviders>
    </SafeAreaProvider>
  );
}
