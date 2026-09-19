import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import {
  Calendar,
  Users,
  Hash,
  Layers,
  Coffee,
  Clock,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import { useBaseSchedule } from '@/hooks/useBaseSchedule';
import { EmptyState } from '@/components/EmptyState';
import { ScheduleBlockCard } from '@/components/ScheduleBlockCard';
import { FreePeriodSpacer } from '@/components/FreePeriodSpacer';
import {
  getDayName,
  calculateDurationMinutes,
} from '@/lib/schedule/timeUtils';
import type { BaseScheduleRow } from '@/store/useAppStore';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

export default function AgendaScreen() {
  const { sections, activeSection, isLoading, isFetching, refetch } = useWorkspaces();
  const { setActiveSectionId } = useAppStore();
  const {
    getBlocksForDay,
    isFetching: isScheduleFetching,
    refetch: refetchSchedule,
  } = useBaseSchedule();

  // Resolve current device day of the week (1=Mon ... 7=Sun)
  const todayDayOfWeek = useMemo(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  }, []);

  const [selectedDay, setSelectedDay] = useState<number>(todayDayOfWeek);
  const dayBlocks = getBlocksForDay(selectedDay);
  const isToday = selectedDay === todayDayOfWeek;

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchSchedule()]);
  };

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
            refreshing={isFetching || isScheduleFetching}
            onRefresh={handleRefresh}
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

          {/* Horizontal Day Switcher */}
          <View className="mt-3.5 pt-3 border-t border-gray-100">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 flex-row">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDay === day.id;
                const isDeviceToday = todayDayOfWeek === day.id;

                return (
                  <Pressable
                    key={day.id}
                    onPress={() => setSelectedDay(day.id)}
                    className={`mx-1 px-3.5 py-2 rounded-xl flex-row items-center space-x-1.5 border transition-all ${
                      isSelected
                        ? 'bg-brand-600 border-brand-700 shadow-sm shadow-brand-500/20'
                        : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {day.short}
                    </Text>
                    {isDeviceToday && (
                      <View
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-brand-600'
                        }`}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Day Agenda Header Bar */}
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-base font-extrabold text-gray-900 tracking-tight">
              {isToday ? "Today's Agenda" : `${getDayName(selectedDay)}'s Agenda`}
            </Text>
            <Text className="text-xs text-gray-500 font-medium">
              {dayBlocks.length} session{dayBlocks.length === 1 ? '' : 's'} scheduled
            </Text>
          </View>
          {isToday && (
            <View className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex-row items-center space-x-1">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <Text className="text-[11px] font-bold text-emerald-700">Today</Text>
            </View>
          )}
        </View>

        {/* Chronological Schedule Blocks or Empty State */}
        {dayBlocks.length === 0 ? (
          <View className="flex-1 justify-center items-center px-6 py-14">
            <View className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 items-center justify-center mb-3.5">
              <Coffee size={28} color="#d97706" strokeWidth={2} />
            </View>
            <Text className="text-lg font-bold text-gray-900 mb-1 text-center">
              No Classes Scheduled
            </Text>
            <Text className="text-xs text-gray-500 text-center max-w-xs leading-relaxed">
              {isToday
                ? 'Enjoy your free day! There are no recurring classes scheduled for today.'
                : `There are no recurring classes scheduled on ${getDayName(selectedDay)}.`}
            </Text>
          </View>
        ) : (
          <View className="px-5 pt-2 pb-8">
            {dayBlocks.map((block: BaseScheduleRow, index: number) => {
              const prevBlock = index > 0 ? dayBlocks[index - 1] : null;
              let freePeriodDuration = 0;

              if (prevBlock) {
                freePeriodDuration = calculateDurationMinutes(
                  prevBlock.end_time,
                  block.start_time
                );
              }

              return (
                <React.Fragment key={block.id}>
                  {/* Free period spacer between non-contiguous classes */}
                  {freePeriodDuration >= 10 && prevBlock && (
                    <FreePeriodSpacer
                      durationMinutes={freePeriodDuration}
                      startTime={prevBlock.end_time}
                      endTime={block.start_time}
                    />
                  )}

                  {/* Student-facing Read-Only Schedule Block Card */}
                  <ScheduleBlockCard
                    block={block}
                    readOnly={true}
                  />
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
