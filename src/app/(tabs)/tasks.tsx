import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { ListTodo } from 'lucide-react-native';

export default function TasksScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 justify-center items-center px-6">
        <View className="w-14 h-14 rounded-2xl bg-indigo-100 items-center justify-center mb-4">
          <ListTodo size={28} color="#4f46e5" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-1">
          Academic Tasks & Deadlines
        </Text>
        <Text className="text-sm text-gray-500 text-center">
          Assignments, quizzes, and project milestones will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
