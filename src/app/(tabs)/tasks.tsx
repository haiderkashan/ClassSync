import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListTodo, Sparkles } from 'lucide-react-native';

export default function TasksScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'left', 'right']}>
      <View className="flex-1 justify-center items-center px-6">
        <View className="w-16 h-16 rounded-3xl bg-neutral-900 items-center justify-center mb-4 shadow-sm">
          <ListTodo size={28} color="#ffffff" strokeWidth={2} />
        </View>
        <Text className="text-xl font-black text-neutral-900 tracking-tight mb-1 text-center">
          Academic Tasks & Deadlines
        </Text>
        <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs leading-relaxed mb-4">
          Assignments, quizzes, and project milestones will appear here.
        </Text>

        <View className="inline-flex flex-row items-center bg-white border border-neutral-100/90 rounded-full px-4 py-2 shadow-2xs">
          <Sparkles size={14} color="#18181b" />
          <Text className="text-xs font-semibold text-neutral-700 ml-2">
            Coming in Phase 5
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
