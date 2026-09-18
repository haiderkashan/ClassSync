import React from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Calendar, Sparkles, Clock, AlertCircle } from 'lucide-react-native';
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

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-between px-6 py-8">
        {/* Hero Section */}
        <View className="items-center mt-6">
          <View className="w-20 h-20 rounded-3xl bg-brand-600 items-center justify-center mb-6 shadow-xl shadow-brand-600/30">
            <Calendar size={40} color="#ffffff" strokeWidth={2.2} />
          </View>

          <Text className="text-3xl font-extrabold text-gray-900 tracking-tight text-center">
            ClassSync
          </Text>
          <Text className="text-base font-semibold text-brand-600 mt-1 text-center">
            The Academic Hub for Modern Cohorts
          </Text>
          <Text className="text-sm text-gray-500 text-center mt-2 px-4 leading-5">
            Centralized timetables, instant class status overrides, and deadline alerts. No noise, zero spam.
          </Text>

          {/* Core Feature Highlights */}
          <View className="w-full mt-8 space-y-3 bg-brand-50/70 p-4 rounded-2xl border border-brand-100">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-brand-100 items-center justify-center mr-3">
                <Clock size={16} color="#4f46e5" />
              </View>
              <Text className="text-xs font-medium text-gray-700 flex-1">
                Sub-second live status updates (Started, Delayed, Cancelled)
              </Text>
            </View>

            <View className="flex-row items-center mt-2.5">
              <View className="w-8 h-8 rounded-full bg-brand-100 items-center justify-center mr-3">
                <Sparkles size={16} color="#4f46e5" />
              </View>
              <Text className="text-xs font-medium text-gray-700 flex-1">
                Deterministic Base Loop & alternating A/B week schedules
              </Text>
            </View>
          </View>
        </View>

        {/* Action & OAuth Buttons Section */}
        <View className="w-full space-y-3">
          {/* Error Banner */}
          {activeError && (
            <View className="flex-row items-center bg-red-50 border border-red-200 p-3 rounded-xl mb-3">
              <AlertCircle size={18} color="#ef4444" />
              <Text className="text-xs text-red-700 font-medium ml-2 flex-1">
                {activeError}
              </Text>
            </View>
          )}

          {/* Google Sign-In Button */}
          <Pressable
            onPress={() => googleAuth.startFlow()}
            disabled={isAnyLoading}
            className="w-full flex-row items-center justify-center py-3.5 px-4 bg-white border border-gray-300 rounded-2xl shadow-sm active:bg-gray-50"
          >
            {googleAuth.isLoading ? (
              <ActivityIndicator size="small" color="#4f46e5" />
            ) : (
              <>
                <GoogleIcon />
                <Text className="text-sm font-semibold text-gray-800 ml-3">
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>

          {/* Apple Sign-In Button (Standard on iOS & supported cross-platform) */}
          <Pressable
            onPress={() => appleAuth.startFlow()}
            disabled={isAnyLoading}
            className="w-full flex-row items-center justify-center py-3.5 px-4 bg-black rounded-2xl shadow-sm active:bg-gray-900 mt-3"
          >
            {appleAuth.isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <AppleIcon color="#ffffff" />
                <Text className="text-sm font-semibold text-white ml-3">
                  Continue with Apple
                </Text>
              </>
            )}
          </Pressable>

          {/* App Store Compliance Disclaimers */}
          <Text className="text-[11px] text-gray-400 text-center leading-4 mt-4 px-2">
            By continuing, you agree to ClassSync's{' '}
            <Text className="text-brand-600 font-medium">Terms of Service</Text> and{' '}
            <Text className="text-brand-600 font-medium">Privacy Policy</Text>.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
