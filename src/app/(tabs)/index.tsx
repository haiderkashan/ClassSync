import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { Calendar } from 'lucide-react-native';

export default function AgendaScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 justify-center items-center px-6">
        <View className="w-14 h-14 rounded-2xl bg-brand-100 items-center justify-center mb-4">
          <Calendar size={28} color="#4f46e5" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-1">
          Today's Timetable
        </Text>
        <Text className="text-sm text-gray-500 text-center">
          Schedule agenda and live status updates will be displayed here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
