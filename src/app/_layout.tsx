import '../../global.css';
import { env } from '@/lib/env';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { Calendar } from 'lucide-react-native';
import { AppProviders } from '@/providers';
import { useNotificationRouting } from '@/lib/notifications/useNotificationRouting';

// Complete any pending auth session from browser redirect
WebBrowser.maybeCompleteAuthSession();

// Boot-time environment validation check
console.log(`[ClassSync] Booting in ${env.EXPO_PUBLIC_APP_ENV} mode`);

function NavigationGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Listen for push notification responses and route to target deep links
  useNotificationRouting();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    console.log(
      `🔄 [AuthGuard] State changed: isLoaded=${isLoaded}, isSignedIn=${isSignedIn}, activeGroup=/${segments[0] || ''}`
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
  }, [isLoaded, isSignedIn, segments, router]);

  // Render branded splash while Clerk restores session from SecureStore
  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <View className="w-20 h-20 rounded-3xl bg-brand-600 items-center justify-center mb-6 shadow-xl shadow-brand-600/30">
          <Calendar size={40} color="#ffffff" strokeWidth={2.2} />
        </View>
        <Text className="text-2xl font-bold text-gray-900 mb-4">ClassSync</Text>
        <ActivityIndicator size="small" color="#4f46e5" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
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
    </>
  );
}

/**
 * Root Layout assembling SafeAreaProvider, AppProviders, and NavigationGuard.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <NavigationGuard />
      </AppProviders>
    </SafeAreaProvider>
  );
}
