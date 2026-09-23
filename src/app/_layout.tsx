import '../../global.css';
import { env } from '@/lib/env';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { Calendar, AlertTriangle } from 'lucide-react-native';
import { AppProviders } from '@/providers';
import { useNotificationRouting } from '@/lib/notifications/useNotificationRouting';
import { hydrateAppStoreFromLocalDb } from '@/lib/db/hydrateAppStore';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

// Prevent native splash screen from auto-hiding before auth session is resolved
SplashScreen.preventAutoHideAsync().catch(() => {});

// Complete any pending auth session from browser redirect
WebBrowser.maybeCompleteAuthSession();

// Boot-time environment validation check
console.log(`[ClassSync] Booting in ${env.EXPO_PUBLIC_APP_ENV} mode`);

/**
 * Root ErrorBoundary catching uncaught rendering errors across the component tree.
 * Immediately dismisses native splash screen so the user is never trapped on a frozen screen,
 * and renders a recovery UI with retry capability.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    // Ensure splash screen is hidden on error so the error UI is visible
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View className="flex-1 bg-white items-center justify-center p-6">
      <View className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-100 items-center justify-center mb-4">
        <AlertTriangle size={32} color="#e11d48" />
      </View>
      <Text className="text-xl font-black text-neutral-900 mb-2 text-center">
        Something went wrong
      </Text>
      <Text className="text-xs font-medium text-neutral-500 text-center mb-6 max-w-xs">
        {error?.message || 'An unexpected rendering error occurred.'}
      </Text>
      <Pressable
        onPress={retry}
        className="bg-neutral-900 px-6 py-3 rounded-full active:bg-neutral-800 shadow-sm"
      >
        <Text className="text-xs font-bold text-white tracking-wide">
          Try Again
        </Text>
      </Pressable>
    </View>
  );
}

function OfflineSyncCoordinator() {
  useOfflineSync();
  useRealtimeSync();
  return null;
}

function NavigationGuard({ isDbHydrated }: { isDbHydrated: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Listen for push notification responses and route to target deep links (safely no-ops in Expo Go)
  useNotificationRouting();

  useEffect(() => {
    // Only dismiss splash screen once BOTH Clerk auth session AND SQLite hydration are finished
    if (!isLoaded || !isDbHydrated) return;

    // Dismiss native splash screen
    SplashScreen.hideAsync().catch(() => {});

    const inAuthGroup = segments[0] === '(auth)';
    console.log(
      `🔄 [AuthGuard] State changed: isLoaded=${isLoaded}, isDbHydrated=${isDbHydrated}, isSignedIn=${isSignedIn}, activeGroup=/${segments[0] || ''}`
    );

    if (!isSignedIn && !inAuthGroup) {
      // Redirect unauthenticated users to the sign-in flow
      console.log('🚀 [AuthGuard] Redirecting unauthenticated user -> /(auth)/sign-in');
      router.replace('/(auth)/sign-in');
    } else if (isSignedIn && inAuthGroup) {
      // Redirect authenticated users to the main protected tabs
      console.log('🚀 [AuthGuard] Redirecting authenticated user -> /(tabs)');
      router.replace('/(tabs)');
    }
  }, [isLoaded, isDbHydrated, isSignedIn, segments, router]);

  return null;
}

/**
 * Branded Splash Overlay shown while Clerk is rehydrating the session token and local SQLite is hydrating.
 * Rendered as an absolute overlay so the underlying Stack navigator remains mounted.
 */
function SplashOverlay({ isDbHydrated }: { isDbHydrated: boolean }) {
  const { isLoaded } = useAuth();
  if (isLoaded && isDbHydrated) return null;

  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center bg-white z-50">
      <View className="w-20 h-20 rounded-3xl bg-brand-600 items-center justify-center mb-6 shadow-xl shadow-brand-600/30">
        <Calendar size={40} color="#ffffff" strokeWidth={2.2} />
      </View>
      <Text className="text-2xl font-bold text-gray-900 mb-4">ClassSync</Text>
      <ActivityIndicator size="small" color="#4f46e5" />
    </View>
  );
}

/**
 * Root Layout assembling SafeAreaProvider, AppProviders, NavigationGuard, and Stack.
 */
export default function RootLayout() {
  const [isDbHydrated, setIsDbHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Hydrate Zustand L1 store from SQLite L2 disk immediately on cold boot
    hydrateAppStoreFromLocalDb().finally(() => {
      if (isMounted) {
        setIsDbHydrated(true);
      }
    });

    // Safety guard: guarantee native splash screen is dismissed within 3s even if network/db hangs
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AppProviders>
        <StatusBar style="auto" />
        <NavigationGuard isDbHydrated={isDbHydrated} />
        <OfflineSyncCoordinator />
        <SplashOverlay isDbHydrated={isDbHydrated} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="join-section"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="create-section"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="add-course"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="section-members"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="schedule/builder"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="schedule/edit-block"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="schedule/broadcast-exception"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="tasks/create-task"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="attendance/course-metrics"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
        </Stack>
      </AppProviders>
    </SafeAreaProvider>
  );
}
