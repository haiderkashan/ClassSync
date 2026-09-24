import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { GraduationCap, LogIn, PlusCircle, QrCode } from 'lucide-react-native';

export interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  onJoinPress?: () => void;
  onCreatePress?: () => void;
  onScanPress?: () => void;
}

/**
 * Reusable Empty State component displayed when a student has no active section/cohort.
 * Features an illustrated hero badge and distinct calls-to-action to Scan QR, Join with Code, or Create a Section.
 */
export function EmptyState({
  title = 'No Enrolled Section',
  subtitle = "You are not enrolled in any class section yet. Scan your cohort's presenter QR, enter a 6-character code, or create a new section.",
  onJoinPress,
  onCreatePress,
  onScanPress,
}: EmptyStateProps) {
  const router = useRouter();

  const handleScan = () => {
    if (onScanPress) {
      onScanPress();
    } else {
      router.push('/cohort/scan-qr');
    }
  };

  const handleJoin = () => {
    if (onJoinPress) {
      onJoinPress();
    } else {
      router.push('/join-section');
    }
  };

  const handleCreate = () => {
    if (onCreatePress) {
      onCreatePress();
    } else {
      router.push('/create-section');
    }
  };

  return (
    <View className="flex-1 items-center justify-center px-6 py-8">
      {/* Visual Hero Badge */}
      <View className="w-24 h-24 rounded-3xl bg-brand-50 border border-brand-100 items-center justify-center mb-6 shadow-sm shadow-brand-500/10">
        <View className="w-16 h-16 rounded-2xl bg-brand-600 items-center justify-center shadow-md shadow-brand-600/30">
          <GraduationCap size={34} color="#ffffff" strokeWidth={2.2} />
        </View>
      </View>

      {/* Message Text */}
      <Text className="text-2xl font-extrabold text-gray-900 text-center tracking-tight mb-2">
        {title}
      </Text>
      <Text className="text-sm text-gray-500 text-center leading-relaxed max-w-xs mb-8">
        {subtitle}
      </Text>

      {/* Action Buttons */}
      <View className="w-full max-w-xs space-y-3">
        {/* Scan Presenter QR (Primary Quick Onboard) */}
        <Pressable
          onPress={handleScan}
          className="w-full bg-indigo-600 py-3.5 px-5 rounded-2xl flex-row items-center justify-center shadow-sm shadow-indigo-600/30 active:scale-[0.98] active:bg-indigo-700"
        >
          <QrCode size={20} color="#ffffff" strokeWidth={2.2} />
          <Text className="text-white text-base font-semibold ml-2.5">
            Scan Cohort QR
          </Text>
        </Pressable>

        {/* Join Section with Code */}
        <Pressable
          onPress={handleJoin}
          className="w-full bg-white border border-neutral-200/90 py-3.5 px-5 rounded-2xl flex-row items-center justify-center shadow-2xs active:scale-[0.98] active:bg-neutral-50"
        >
          <LogIn size={20} color="#18181b" strokeWidth={2.2} />
          <Text className="text-neutral-900 text-base font-semibold ml-2.5">
            Join with Code
          </Text>
        </Pressable>

        {/* Create Section (Tertiary Action) */}
        <Pressable
          onPress={handleCreate}
          className="w-full bg-transparent py-2.5 px-5 rounded-2xl flex-row items-center justify-center active:bg-neutral-100"
        >
          <PlusCircle size={18} color="#4f46e5" strokeWidth={2.2} />
          <Text className="text-indigo-600 text-sm font-semibold ml-2">
            Create a New Section
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
