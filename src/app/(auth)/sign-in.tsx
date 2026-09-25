import React from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import {
  Zap,
  Users,
  WifiOff,
  AlertCircle,
} from 'lucide-react-native';
import { useWarmUpBrowser, useOAuthFlow } from '@/hooks/useOAuthFlow';

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.87c2.26-2.09 3.675-5.17 3.675-9.14z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.04c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.13C3.26 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.25c-.25-.72-.38-1.49-.38-2.25s.13-1.53.38-2.25V6.62H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.38l4-3.13z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.27 6.62l4 3.13c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </Svg>
  );
}

function AppleIcon({ color = '#ffffff' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 170 170">
      <Path
        fill={color}
        d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.89-11.95-14.54-7.48-11.73-13.06-25.07-16.74-40.03-3.68-14.96-5.52-28.53-5.52-40.71 0-16.71 4.18-30.74 12.55-42.08 8.37-11.34 18.79-17.15 31.26-17.43 4.89 0 10.42 1.23 16.59 3.69 6.17 2.46 10.05 3.75 11.64 3.86 1.48 0 5.43-1.37 11.85-4.11 6.42-2.74 12.01-4.01 16.79-3.81 12.98.63 23.47 5.48 31.47 14.56-11.05 6.72-16.48 16.14-16.29 28.25.19 9.53 3.88 17.51 11.08 23.94 7.2 6.43 15.75 10.22 25.65 11.37-2.34 7.38-5.41 14.88-9.21 22.52zM119.22 33.15c0-7.39 2.67-14.28 8.01-20.67 5.34-6.39 12-10.55 19.98-12.48.2 1.4.3 2.7.3 3.91 0 7.39-2.77 14.48-8.31 21.28-5.54 6.8-12.3 11.02-20.28 12.65-.2-1.57-.3-3.07-.3-4.51z"
      />
    </Svg>
  );
}

export default function SignInScreen() {
  // Pre-warm browser process on Android & iOS
  useWarmUpBrowser();

  const googleAuth = useOAuthFlow('oauth_google');
  const appleAuth = useOAuthFlow('oauth_apple');

  const isAnyLoading = googleAuth.isLoading || appleAuth.isLoading;
  const activeError = googleAuth.error || appleAuth.error;

  const handleOpenTerms = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://classsync.app/terms');
    } catch (e) {
      console.warn('Unable to open Terms URL', e);
    }
  };

  const handleOpenPrivacy = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://classsync.app/privacy');
    } catch (e) {
      console.warn('Unable to open Privacy Policy URL', e);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'bottom', 'left', 'right']}>
      <View className="flex-1 justify-between px-6 py-6 max-w-md mx-auto w-full">
        {/* Brand Hero Section */}
        <View className="items-center pt-3">
          {/* Yellow Brand Icon Mark */}
          <View className="relative mb-4">
            <View className="w-20 h-20 rounded-3xl bg-[#18181B] items-center justify-center shadow-lg shadow-black/10">
              <View className="w-10 h-10 rounded-2xl bg-[#FACC15] items-center justify-center shadow-sm">
                <Zap size={22} color="#18181B" strokeWidth={2.6} fill="#18181B" />
              </View>
            </View>
            {/* Signature yellow accent dot */}
            <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FACC15] border-2 border-[#FAFAF9]" />
          </View>

          {/* App Title */}
          <Text className="text-3xl font-black text-neutral-900 tracking-tight text-center">
            ClassSync
          </Text>

          {/* Yellow Accent Subtitle Pill */}
          <View className="mt-2 flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF08A]/70 border border-[#FACC15]/60">
            <View className="w-2 h-2 rounded-full bg-[#CA8A04]" />
            <Text className="text-xs font-bold text-neutral-900">
              Live Academic Timetables
            </Text>
          </View>

          <Text className="text-sm text-neutral-500 text-center mt-2.5 px-3 leading-relaxed">
            Live academic schedules and cohort updates directly from your class representatives.
          </Text>

          {/* Three Core Benefits (Clean Mobile Cards, Zero Fluff) */}
          <View className="w-full mt-6 space-y-2.5">
            {/* Card 1: Real-Time Overrides */}
            <View className="flex-row items-center p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs">
              <View className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 items-center justify-center mr-3.5 shrink-0">
                <Zap size={18} color="#D97706" strokeWidth={2.4} fill="#FACC15" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-neutral-900">
                  Real-Time Overrides
                </Text>
                <Text className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                  Instant alerts when classes are moved, delayed, or cancelled.
                </Text>
              </View>
            </View>

            {/* Card 2: Cohort Synchronization */}
            <View className="flex-row items-center p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs mt-2.5">
              <View className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 items-center justify-center mr-3.5 shrink-0">
                <Users size={18} color="#18181B" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-neutral-900">
                  Cohort Synchronization
                </Text>
                <Text className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                  Join your section with one code and stay in sync with your course rep.
                </Text>
              </View>
            </View>

            {/* Card 3: Offline Ready */}
            <View className="flex-row items-center p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs mt-2.5">
              <View className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 items-center justify-center mr-3.5 shrink-0">
                <WifiOff size={18} color="#18181B" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-neutral-900">
                  Offline Ready
                </Text>
                <Text className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                  Full access to your schedule even in lecture halls without internet.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action & Strict OAuth Section */}
        <View className="w-full pt-4 space-y-2.5">
          {/* Active Error Notice */}
          {activeError && (
            <View className="flex-row items-center bg-rose-50 border border-rose-200 p-3.5 rounded-2xl mb-2">
              <AlertCircle size={16} color="#E11D48" />
              <Text className="text-xs text-rose-800 font-semibold ml-2.5 flex-1">
                {activeError}
              </Text>
            </View>
          )}

          {/* Button 1: Continue with Google */}
          <Pressable
            onPress={() => googleAuth.startFlow()}
            disabled={isAnyLoading}
            className="w-full h-13 px-5 bg-white border border-neutral-200 rounded-2xl flex-row items-center justify-center gap-3 active:bg-neutral-50 shadow-2xs"
          >
            {googleAuth.isLoading ? (
              <ActivityIndicator size="small" color="#18181B" />
            ) : (
              <>
                <GoogleIcon />
                <Text className="text-sm font-bold text-neutral-900 ml-1">
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>

          {/* Button 2: Continue with Apple */}
          <Pressable
            onPress={() => appleAuth.startFlow()}
            disabled={isAnyLoading}
            className="w-full h-13 px-5 bg-[#18181B] rounded-2xl flex-row items-center justify-center gap-3 active:bg-neutral-800 shadow-sm mt-2.5"
          >
            {appleAuth.isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <AppleIcon color="#FFFFFF" />
                <Text className="text-sm font-bold text-white ml-1 tracking-wide">
                  Continue with Apple
                </Text>
              </>
            )}
          </Pressable>

          {/* Interactive Compliance Disclaimer with Live Clickable Policy Links */}
          <View className="pt-3 pb-1 items-center">
            <Text className="text-[11px] text-neutral-400 text-center leading-relaxed">
              By continuing, you agree to our{' '}
              <Text
                onPress={handleOpenTerms}
                className="text-neutral-800 font-bold underline underline-offset-2"
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                onPress={handleOpenPrivacy}
                className="text-neutral-800 font-bold underline underline-offset-2"
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
