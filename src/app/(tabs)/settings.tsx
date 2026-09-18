import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { User } from 'lucide-react-native';

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 justify-center items-center px-6">
        <View className="w-14 h-14 rounded-2xl bg-purple-100 items-center justify-center mb-4">
          <User size={28} color="#8b5cf6" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-1">
          Student Profile & Settings
        </Text>
        <Text className="text-sm text-gray-500 text-center">
          Manage cohort enrollment, notification preferences, and account.
        </Text>
      </View>
    </SafeAreaView>
  );
}
