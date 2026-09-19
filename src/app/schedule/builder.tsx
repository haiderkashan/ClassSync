import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Globe,
  Plus,
  Sparkles,
  Layers,
  School,
  Copy,
} from 'lucide-react-native';
import { useBaseSchedule } from '@/hooks/useBaseSchedule';
import { ScheduleBlockCard } from '@/components/ScheduleBlockCard';
import { FreePeriodSpacer } from '@/components/FreePeriodSpacer';
import { CloneDayModal } from '@/components/CloneDayModal';
import {
  getDayName,
  calculateDurationMinutes,
} from '@/lib/schedule/timeUtils';
import type { BaseScheduleRow } from '@/store/useAppStore';

const DAYS_OF_WEEK = [
  { id: 1, short: 'Mon', full: 'Monday' },
  { id: 2, short: 'Tue', full: 'Tuesday' },
  { id: 3, short: 'Wed', full: 'Wednesday' },
  { id: 4, short: 'Thu', full: 'Thursday' },
  { id: 5, short: 'Fri', full: 'Friday' },
  { id: 6, short: 'Sat', full: 'Saturday' },
  { id: 7, short: 'Sun', full: 'Sunday' },
];

export default function ScheduleBuilderScreen() {
  const router = useRouter();
  const {
    schedules,
    isLoading,
    isFetching,
    refetch,
    getBlocksForDay,
    activeSection,
    isSectionAdmin,
  } = useBaseSchedule();

  // Selected Day state (defaults to Monday = 1)
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [isCloneModalVisible, setIsCloneModalVisible] = useState<boolean>(false);

  // Filtered blocks for selected day
  const dayBlocks = useMemo(() => {
    return getBlocksForDay(selectedDay);
  }, [getBlocksForDay, selectedDay]);

  // Compute block count for each day to display in the selector badge
  const dayCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    (schedules || []).forEach((b) => {
      if (b.day_of_week >= 1 && b.day_of_week <= 7) {
        counts[b.day_of_week] = (counts[b.day_of_week] || 0) + 1;
      }
    });
    return counts;
  }, [schedules]);

  const activeSectionName = activeSection?.name || 'Cohort Timetable';
  const timezone = activeSection?.timezone || 'UTC';

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Header */}
      <View className="bg-white border-b border-gray-200 px-4 pt-3 pb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-3 flex-1 mr-2">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={20} color="#1f2937" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-gray-900 tracking-tight" numberOfLines={1}>
                {activeSectionName}
              </Text>
              <View className="flex-row items-center space-x-1 mt-0.5">
                <Globe size={11} color="#6b7280" />
                <Text className="text-xs text-gray-500 font-medium">
                  {timezone} • Recurring Base Schedule
                </Text>
              </View>
            </View>
          </View>

          {/* Clone Day CTA */}
          {isSectionAdmin && (
            <Pressable
              onPress={() => setIsCloneModalVisible(true)}
              className="flex-row items-center space-x-1.5 bg-brand-50 border border-brand-200 px-3 py-2 rounded-xl active:bg-brand-100 shadow-xs"
              accessibilityLabel="Clone Day"
            >
              <Copy size={14} color="#4f46e5" strokeWidth={2.5} />
              <Text className="text-xs font-bold text-brand-700">Clone</Text>
            </Pressable>
          )}
        </View>

        {/* Horizontal Day Selector Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4 -mx-4 px-4 flex-row"
        >
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = selectedDay === day.id;
            const count = dayCounts[day.id] || 0;

            return (
              <Pressable
                key={day.id}
                onPress={() => setSelectedDay(day.id)}
                className={`mr-2.5 px-4 py-2.5 rounded-2xl flex-row items-center space-x-2 border transition-all ${
                  isSelected
                    ? 'bg-brand-600 border-brand-700 shadow-sm shadow-brand-500/20'
                    : 'bg-white border-gray-200 active:bg-gray-100'
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    isSelected ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {day.short}
                </Text>

                {count > 0 && (
                  <View
                    className={`px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-brand-500' : 'bg-gray-100'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-extrabold ${
                        isSelected ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content: Chronological Day Timeline */}
      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#4f46e5" />
        }
      >
        {isLoading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text className="text-sm font-medium text-gray-500 mt-3">
              Loading timetable...
            </Text>
          </View>
        ) : dayBlocks.length === 0 ? (
          /* Empty State for Selected Day */
          <View className="items-center justify-center py-16 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm mt-4">
            <View className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 items-center justify-center mb-4">
              <Calendar size={28} color="#4f46e5" />
            </View>
            <Text className="text-lg font-bold text-gray-900 text-center mb-1">
              No Classes on {getDayName(selectedDay)}
            </Text>
            <Text className="text-sm text-gray-500 text-center leading-relaxed max-w-xs">
              This day currently has no recurring timetable blocks scheduled for your cohort.
            </Text>
            {isSectionAdmin && (
              <Pressable
                onPress={() => {
                  router.push(`/schedule/edit-block?day=${selectedDay}`);
                }}
                className="mt-6 flex-row items-center space-x-2 bg-brand-50 px-4 py-2.5 rounded-xl border border-brand-200 active:bg-brand-100"
              >
                <Plus size={16} color="#4f46e5" strokeWidth={2.5} />
                <Text className="text-brand-700 font-bold text-xs">
                  Add First Class for {getDayName(selectedDay)}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          /* Chronological List of Cards with Free Period Spacers */
          <View>
            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {getDayName(selectedDay)} Schedule ({dayBlocks.length} session{dayBlocks.length === 1 ? '' : 's'})
              </Text>
            </View>

            {dayBlocks.map((block: BaseScheduleRow, index: number) => {
              const prevBlock = index > 0 ? dayBlocks[index - 1] : null;
              let freePeriodDuration = 0;

              if (prevBlock) {
                freePeriodDuration = calculateDurationMinutes(prevBlock.end_time, block.start_time);
              }

              return (
                <React.Fragment key={block.id}>
                  {/* Render Free Period Spacer if gap is 10 minutes or more */}
                  {freePeriodDuration >= 10 && prevBlock && (
                    <FreePeriodSpacer
                      durationMinutes={freePeriodDuration}
                      startTime={prevBlock.end_time}
                      endTime={block.start_time}
                    />
                  )}

                  {/* Class Block Card */}
                  <ScheduleBlockCard
                    block={block}
                    onPress={(b) => {
                      router.push(`/schedule/edit-block?day=${selectedDay}&id=${b.id}`);
                    }}
                  />
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button (FAB) for adding new schedule block */}
      {isSectionAdmin && (
        <View className="absolute bottom-6 right-6">
          <Pressable
            onPress={() => {
              router.push(`/schedule/edit-block?day=${selectedDay}`);
            }}
            className="flex-row items-center space-x-2 bg-brand-600 px-5 py-3.5 rounded-full shadow-lg shadow-brand-600/40 active:scale-95 active:bg-brand-700 transition-transform"
            accessibilityLabel="Add Class Block"
          >
            <Plus size={20} color="#ffffff" strokeWidth={2.5} />
            <Text className="text-white font-bold text-sm tracking-wide">
              Add Class
            </Text>
          </Pressable>
        </View>
      )}

      {/* Day Cloner Modal */}
      <CloneDayModal
        visible={isCloneModalVisible}
        onClose={() => setIsCloneModalVisible(false)}
        initialSourceDay={selectedDay}
        onSuccess={(targetDay) => {
          setSelectedDay(targetDay);
        }}
      />
    </SafeAreaView>
  );
}
