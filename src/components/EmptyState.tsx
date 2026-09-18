import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { GraduationCap, LogIn, PlusCircle } from 'lucide-react-native';

export interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  onJoinPress?: () => void;
  onCreatePress?: () => void;
}

/**
 * Reusable Empty State component displayed when a student has no active section/cohort.
 * Features an illustrated hero badge and distinct calls-to-action to Join or Create a Section.
 */
export function EmptyState({
  title = 'No Enrolled Section',
  subtitle = "You are not enrolled in any class section yet. Join an existing cohort with your Class Rep's 6-character code, or create a new section.",
  onJoinPress,
  onCreatePress,
}: EmptyStateProps) {
  const router = useRouter();

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
        {/* Join Section (Primary) */}
        <Pressable
          onPress={handleJoin}
          className="w-full bg-brand-600 py-3.5 px-5 rounded-2xl flex-row items-center justify-center shadow-sm shadow-brand-600/30 active:scale-[0.98] active:bg-brand-700"
        >
          <LogIn size={20} color="#ffffff" strokeWidth={2.2} />
          <Text className="text-white text-base font-semibold ml-2.5">
            Join a Section
          </Text>
        </Pressable>

        {/* Create Section (Secondary Outline) */}
        <Pressable
          onPress={handleCreate}
          className="w-full bg-white border border-gray-200 py-3.5 px-5 rounded-2xl flex-row items-center justify-center active:scale-[0.98] active:bg-gray-50"
        >
          <PlusCircle size={20} color="#4f46e5" strokeWidth={2.2} />
          <Text className="text-brand-600 text-base font-semibold ml-2.5">
            Create a Section
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
