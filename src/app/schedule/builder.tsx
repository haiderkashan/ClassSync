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
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Header */}
      <View className="bg-white border-b border-neutral-100/90 px-4 pt-3 pb-3 shadow-2xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-3 flex-1 mr-2">
            <Pressable
              onPress={() => router.back()}
              className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={18} color="#18181b" />
            </Pressable>
            <View className="flex-1 ml-2">
              <Text className="text-lg font-black text-neutral-900 tracking-tight" numberOfLines={1}>
                {activeSectionName}
              </Text>
              <View className="flex-row items-center space-x-1 mt-0.5">
                <Globe size={11} color="#a1a1aa" />
                <Text className="text-xs text-neutral-400 font-medium ml-1">
                  {timezone} • Recurring Base Schedule
                </Text>
              </View>
            </View>
          </View>

          {/* Clone Day CTA */}
          {isSectionAdmin && (
            <Pressable
              onPress={() => setIsCloneModalVisible(true)}
              className="flex-row items-center space-x-1.5 bg-neutral-100 border border-neutral-200/60 px-3 py-1.5 rounded-full active:bg-neutral-200 shadow-2xs"
              accessibilityLabel="Clone Day"
            >
              <Copy size={13} color="#18181b" strokeWidth={2} />
              <Text className="text-xs font-bold text-neutral-800 ml-1">Clone</Text>
            </Pressable>
          )}
        </View>

        {/* Horizontal Day Selector Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3 -mx-4 px-4 flex-row py-1"
        >
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = selectedDay === day.id;
            const count = dayCounts[day.id] || 0;

            return (
              <Pressable
                key={day.id}
                onPress={() => setSelectedDay(day.id)}
                className={`mr-2.5 px-3.5 py-2 rounded-2xl flex-row items-center space-x-1.5 border transition-all ${
                  isSelected
                    ? 'bg-neutral-900 border-neutral-900 shadow-sm shadow-neutral-900/20'
                    : 'bg-white border-neutral-150/90 shadow-2xs active:bg-neutral-50'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    isSelected ? 'text-white' : 'text-neutral-700'
                  }`}
                >
                  {day.short}
                </Text>

                {count > 0 && (
                  <View
                    className={`ml-1 px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-neutral-800' : 'bg-neutral-100'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-extrabold ${
                        isSelected ? 'text-white' : 'text-neutral-600'
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
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#18181b" />
        }
      >
        {isLoading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#18181b" />
            <Text className="text-xs font-semibold text-neutral-400 mt-3 tracking-wide">
              Loading timetable...
            </Text>
          </View>
        ) : dayBlocks.length === 0 ? (
          /* Empty State for Selected Day */
          <View className="py-12 px-6 items-center justify-center bg-white border border-neutral-100/90 rounded-3xl shadow-2xs my-4">
            <View className="w-14 h-14 rounded-2xl bg-neutral-100 items-center justify-center mb-3">
              <Calendar size={24} color="#71717a" strokeWidth={1.8} />
            </View>
            <Text className="text-base font-black text-neutral-900 mb-1 text-center tracking-tight">
              No classes on {getDayName(selectedDay)}
            </Text>
            <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs mb-5 leading-relaxed">
              This day is currently unscheduled. Tap the button below to add recurring classes, labs, or prayer breaks.
            </Text>

            {isSectionAdmin && (
              <Pressable
                onPress={() => router.push(`/schedule/edit-block?day=${selectedDay}`)}
                className="flex-row items-center space-x-1.5 bg-neutral-900 px-4 py-2.5 rounded-full active:bg-neutral-800 shadow-2xs"
              >
                <Plus size={14} color="#ffffff" strokeWidth={2.5} />
                <Text className="text-white font-bold text-xs ml-1">
                  Add First Class for {getDayName(selectedDay)}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          /* Chronological List of Cards with Free Period Spacers */
          <View>
            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
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
            className="flex-row items-center space-x-2 bg-neutral-900 px-5 py-3.5 rounded-full shadow-lg shadow-black/25 active:scale-95 active:bg-neutral-800 transition-transform"
            accessibilityLabel="Add Class Block"
          >
            <Plus size={18} color="#ffffff" strokeWidth={2.5} />
            <Text className="text-white font-bold text-sm tracking-wide ml-1">
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
