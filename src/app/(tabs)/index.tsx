import React from 'react';
import { View, Text, SafeAreaView, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Calendar, Users, Hash } from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { EmptyState } from '@/components/EmptyState';

export default function AgendaScreen() {
  const { sections, activeSection, isLoading, isFetching, refetch } = useWorkspaces();

  if (isLoading && sections.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="text-sm font-medium text-gray-500 mt-3">
          Loading your workspaces...
        </Text>
      </SafeAreaView>
    );
  }

  if (sections.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <EmptyState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => void refetch()}
            tintColor="#4f46e5"
            colors={['#4f46e5']}
          />
        }
      >
        {/* Active Section Header */}
        <View className="px-5 pt-4 pb-4 bg-white border-b border-gray-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-xs font-bold uppercase tracking-wider text-brand-600 mb-0.5">
                {activeSection?.institution_tag || 'Active Section'}
              </Text>
              <Text className="text-xl font-extrabold text-gray-900" numberOfLines={1}>
                {activeSection?.name || 'Class Section'}
              </Text>
            </View>

            {/* Join Code Badge */}
            {activeSection?.join_code && (
              <View className="bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg flex-row items-center">
                <Hash size={12} color="#6b7280" />
                <Text className="text-xs font-mono font-bold text-gray-700 ml-0.5">
                  {activeSection.join_code}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Timetable Content Placeholder */}
        <View className="flex-1 justify-center items-center px-6 py-12">
          <View className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 items-center justify-center mb-4">
            <Calendar size={32} color="#4f46e5" strokeWidth={2.2} />
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-1 text-center">
            Today's Timetable
          </Text>
          <Text className="text-sm text-gray-500 text-center max-w-xs">
            Schedule agenda and live status updates for {activeSection?.name} will appear here.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
