import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { Calendar, Users, Hash, Layers } from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import { EmptyState } from '@/components/EmptyState';

export default function AgendaScreen() {
  const { sections, activeSection, isLoading, isFetching, refetch } = useWorkspaces();
  const { setActiveSectionId } = useAppStore();

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
        <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-xs font-bold uppercase tracking-wider text-brand-600 mb-0.5">
                {activeSection?.institution_tag || 'Active Cohort'}
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

          {/* Multi-Section Workspace Switcher Pills */}
          {sections.length > 1 && (
            <View className="mt-3 pt-2.5 border-t border-gray-100">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Enrolled Sections
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {sections.map((sec) => {
                  const isSelected = sec.id === activeSection?.id;
                  return (
                    <Pressable
                      key={sec.id}
                      onPress={() => setActiveSectionId(sec.id)}
                      className={`mr-2 px-3 py-1.5 rounded-xl border flex-row items-center ${
                        isSelected
                          ? 'bg-brand-600 border-brand-600 shadow-sm shadow-brand-600/20'
                          : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                      }`}
                    >
                      <Layers
                        size={12}
                        color={isSelected ? '#ffffff' : '#6b7280'}
                        className="mr-1.5"
                      />
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {sec.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
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
