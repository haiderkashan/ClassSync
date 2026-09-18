import '../../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { env } from '@/lib/env';

// Boot-time environment validation check
console.log(`[ClassSync] Booting in ${env.EXPO_PUBLIC_APP_ENV} mode`);

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
