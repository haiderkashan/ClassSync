import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  Edit2,
  GripVertical,
  MapPin,
  Plus,
  PlusCircle,
  Trash2,
  AlertTriangle,
  Coffee,
  Check,
  Layers,
} from 'lucide-react-native';
import { useBaseSchedule } from '@/hooks/useBaseSchedule';
import { CloneDayModal } from '@/components/CloneDayModal';
import {
  getDayName,
  formatTime12Hour,
  calculateDurationMinutes,
  formatDuration,
} from '@/lib/schedule/timeUtils';
import {
  detectScheduleConflicts,
  type ScheduleBlockInterval,
} from '@/lib/schedule/conflictDetector';
import type { BaseScheduleRow, WeekParity } from '@/store/useAppStore';

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
    deleteBlock,
    isDeleting,
    activeSection,
    isSectionAdmin,
  } = useBaseSchedule();

  // Selected Day state (defaults to Monday = 1)
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [isCloneModalVisible, setIsCloneModalVisible] = useState<boolean>(false);
  const [parityFilter, setParityFilter] = useState<WeekParity>('weekly');

  // Filtered blocks for selected day and parity
  const dayBlocks = useMemo(() => {
    return getBlocksForDay(selectedDay, parityFilter);
  }, [getBlocksForDay, selectedDay, parityFilter]);

  // Total calculated hours for the day
  const totalDurationMinutes = useMemo(() => {
    return dayBlocks.reduce((acc, block) => {
      return acc + calculateDurationMinutes(block.start_time, block.end_time);
    }, 0);
  }, [dayBlocks]);

  const totalDurationLabel = useMemo(() => {
    const hours = (totalDurationMinutes / 60).toFixed(1).replace('.0', '');
    return `${hours}h`;
  }, [totalDurationMinutes]);

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

  // Day conflicts detection
  const dayConflicts = useMemo(() => {
    const intervals: ScheduleBlockInterval[] = dayBlocks.map((b) => ({
      id: b.id,
      courseId: b.course_id,
      courseTitle: b.course?.name || b.session_type.toUpperCase(),
      courseCode: b.course?.code || undefined,
      dayOfWeek: b.day_of_week,
      startTime: b.start_time,
      endTime: b.end_time,
      frequency: b.frequency,
      room: b.room,
      sessionType: b.session_type,
    }));

    const detected: Array<{ blockId: string; message: string }> = [];
    for (let i = 0; i < intervals.length; i++) {
      const candidate = intervals[i];
      const others = intervals.filter((_, idx) => idx !== i);
      const res = detectScheduleConflicts(candidate, others);
      if (res.hasConflict) {
        detected.push({
          blockId: candidate.id || '',
          message: res.conflicts.map((c) => c.message).join(' • '),
        });
      }
    }
    return detected;
  }, [dayBlocks]);

  const activeSectionName = activeSection?.name || 'Cohort Timetable';

  const handleDeleteBlock = (blockId: string, courseTitle: string) => {
    Alert.alert(
      'Delete Schedule Block',
      `Are you sure you want to remove "${courseTitle}" from the timetable?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBlock(blockId);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete block.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'bottom', 'left', 'right']}>
      {/* 1. Top App Bar */}
      <View className="bg-white border-b border-neutral-200/70 px-4 pt-2.5 pb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-2.5 flex-1 mr-2">
            <Pressable
              onPress={() => router.back()}
              className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={18} color="#18181B" />
            </Pressable>
            <View className="flex-1 ml-1.5">
              <Text className="text-lg font-black text-neutral-900 tracking-tight" numberOfLines={1}>
                Timetable Builder
              </Text>
              <View className="flex-row items-center space-x-1.5 mt-0.5">
                <View className="w-1.5 h-1.5 rounded-full bg-[#FACC15]" />
                <Text className="text-[11px] font-semibold text-neutral-500 tracking-wide" numberOfLines={1}>
                  {activeSectionName}
                </Text>
              </View>
            </View>
          </View>

          {/* Action CTAs */}
          <View className="flex-row items-center space-x-2">
            {isSectionAdmin && (
              <Pressable
                onPress={() => setIsCloneModalVisible(true)}
                className="flex-row items-center space-x-1 bg-neutral-100 border border-neutral-200/80 px-2.5 py-1.5 rounded-xl active:bg-neutral-200"
                accessibilityLabel="Clone Day"
              >
                <Copy size={13} color="#18181B" strokeWidth={2} />
                <Text className="text-xs font-bold text-neutral-800 ml-1">Clone</Text>
              </Pressable>
            )}

            {isSectionAdmin && (
              <Pressable
                onPress={() => router.push(`/schedule/edit-block?day=${selectedDay}`)}
                className="flex-row items-center space-x-1 bg-[#FACC15] px-3 py-1.5 rounded-xl active:bg-yellow-400 shadow-2xs"
                accessibilityLabel="Add Class"
              >
                <Plus size={14} color="#18181B" strokeWidth={2.5} />
                <Text className="text-xs font-black text-neutral-950 ml-0.5">Add</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* 2. Horizontal Weekday Selector Tabs */}
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
                className={`mr-2 min-w-[54px] py-2 px-2.5 rounded-xl flex-col items-center justify-center border transition-all ${
                  isSelected
                    ? 'bg-[#FACC15] border-[#EAB308] shadow-sm'
                    : 'bg-white border-neutral-200/80 active:bg-neutral-50'
                }`}
              >
                <Text
                  className={`text-[11px] uppercase tracking-wider font-extrabold ${
                    isSelected ? 'text-neutral-950' : 'text-neutral-500'
                  }`}
                >
                  {day.short}
                </Text>
                <Text
                  className={`text-sm font-black mt-0.5 ${
                    isSelected ? 'text-neutral-950' : 'text-neutral-800'
                  }`}
                >
                  {count}
                </Text>
                {isSelected ? (
                  <View className="w-1.5 h-1.5 rounded-full bg-neutral-950 mt-1" />
                ) : (
                  <View className="w-1.5 h-1.5 rounded-full bg-transparent mt-1" />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 3. Recurrence Sub-filters & Statistics Strip */}
        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-neutral-100">
          <View className="flex-row items-center space-x-1.5">
            <Pressable
              onPress={() => setParityFilter('weekly')}
              className={`px-2.5 py-1 rounded-full border ${
                parityFilter === 'weekly'
                  ? 'bg-neutral-900 border-neutral-900'
                  : 'bg-neutral-100 border-neutral-200/70'
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  parityFilter === 'weekly' ? 'text-white' : 'text-neutral-600'
                }`}
              >
                All Weeks
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setParityFilter('biweekly_week_a')}
              className={`px-2.5 py-1 rounded-full border ${
                parityFilter === 'biweekly_week_a'
                  ? 'bg-neutral-900 border-neutral-900'
                  : 'bg-neutral-100 border-neutral-200/70'
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  parityFilter === 'biweekly_week_a' ? 'text-white' : 'text-neutral-600'
                }`}
              >
                Week A
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setParityFilter('biweekly_week_b')}
              className={`px-2.5 py-1 rounded-full border ${
                parityFilter === 'biweekly_week_b'
                  ? 'bg-neutral-900 border-neutral-900'
                  : 'bg-neutral-100 border-neutral-200/70'
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  parityFilter === 'biweekly_week_b' ? 'text-white' : 'text-neutral-600'
                }`}
              >
                Week B
              </Text>
            </Pressable>
          </View>

          <Text className="text-[11px] font-semibold text-neutral-400">
            {dayBlocks.length} Slot{dayBlocks.length === 1 ? '' : 's'} • {totalDurationLabel}
          </Text>
        </View>
      </View>

      {/* 4. Main Scrollable Day Timeline */}
      <ScrollView
        className="flex-1 px-4 pt-3.5"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#18181B" />
        }
      >
        {/* Schedule Conflict / Clash Warning Alert Card */}
        {dayConflicts.length > 0 && (
          <View className="mb-4 rounded-2xl bg-amber-50/90 border border-amber-300/70 p-3.5 relative overflow-hidden shadow-2xs">
            <View className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FACC15]" />
            <View className="flex-row items-start space-x-2.5 pl-1">
              <View className="w-7 h-7 rounded-lg bg-[#FACC15]/20 items-center justify-center mt-0.5">
                <AlertTriangle size={15} color="#854d0e" strokeWidth={2.5} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center space-x-2">
                  <Text className="text-xs font-black text-amber-950 uppercase tracking-tight">
                    Schedule Conflict Detected
                  </Text>
                  <View className="px-1.5 py-0.5 rounded bg-amber-200 border border-amber-300">
                    <Text className="text-[9px] font-black text-amber-900 uppercase">Clash</Text>
                  </View>
                </View>
                <Text className="text-xs text-amber-900 mt-1 leading-relaxed font-medium">
                  {dayConflicts.map((c) => c.message).join(' ')}
                </Text>
                <Text className="text-[10px] text-amber-800 mt-1 font-semibold">
                  Concurrent sessions are permissible for elective courses and lab batches.
                </Text>
              </View>
            </View>
          </View>
        )}

        {isLoading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#18181B" />
            <Text className="text-xs font-semibold text-neutral-400 mt-3 tracking-wide">
              Loading timetable...
            </Text>
          </View>
        ) : dayBlocks.length === 0 ? (
          /* Empty State for Selected Day */
          <View className="py-12 px-6 items-center justify-center bg-white border border-neutral-200/80 rounded-3xl shadow-2xs my-3">
            <View className="w-14 h-14 rounded-2xl bg-neutral-100 items-center justify-center mb-3">
              <Calendar size={24} color="#71717A" strokeWidth={1.8} />
            </View>
            <Text className="text-base font-black text-neutral-900 mb-1 text-center tracking-tight">
              No classes on {getDayName(selectedDay)}
            </Text>
            <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs mb-5 leading-relaxed">
              This day is currently unscheduled. Tap the button below to add recurring classes, practical labs, or breaks.
            </Text>

            {isSectionAdmin && (
              <Pressable
                onPress={() => router.push(`/schedule/edit-block?day=${selectedDay}`)}
                className="flex-row items-center space-x-1.5 bg-[#FACC15] px-4 py-2.5 rounded-full active:bg-yellow-400 shadow-sm"
              >
                <Plus size={15} color="#18181B" strokeWidth={2.5} />
                <Text className="text-neutral-950 font-black text-xs ml-1">
                  Add First Class for {getDayName(selectedDay)}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          /* Chronological List of Cards with Free Period Spacers */
          <View>
            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">
                {getDayName(selectedDay)} Timeline ({dayBlocks.length} session{dayBlocks.length === 1 ? '' : 's'})
              </Text>
              <Text className="text-[11px] font-semibold text-neutral-400">
                Sorted chronologically
              </Text>
            </View>

            {dayBlocks.map((block: BaseScheduleRow, index: number) => {
              const prevBlock = index > 0 ? dayBlocks[index - 1] : null;
              let freePeriodDuration = 0;

              if (prevBlock) {
                freePeriodDuration = calculateDurationMinutes(prevBlock.end_time, block.start_time);
              }

              const courseCode = block.course?.code || 'GEN';
              const courseTitle = block.course?.name || block.session_type.toUpperCase();
              const durationMinutes = calculateDurationMinutes(block.start_time, block.end_time);
              const durationLabel = formatDuration(durationMinutes);
              const hasConflict = dayConflicts.some((c) => c.blockId === block.id);

              return (
                <React.Fragment key={block.id}>
                  {/* Free Period / Break Slot Spacer */}
                  {freePeriodDuration >= 10 && prevBlock && (
                    <View className="mb-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 p-2.5 flex-row items-center justify-between">
                      <View className="flex-row items-center space-x-2 pl-1.5 flex-1 mr-2">
                        <Coffee size={15} color="#71717A" />
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-neutral-800">
                            Free Slot ({formatTime12Hour(prevBlock.end_time)} - {formatTime12Hour(block.start_time)})
                          </Text>
                          <Text className="text-[10px] text-neutral-500 font-medium">
                            {freePeriodDuration}m Break • Tap Add Slot to schedule
                          </Text>
                        </View>
                      </View>

                      {isSectionAdmin && (
                        <Pressable
                          onPress={() =>
                            router.push(
                              `/schedule/edit-block?day=${selectedDay}&start=${prevBlock.end_time.slice(
                                0,
                                5
                              )}&end=${block.start_time.slice(0, 5)}`
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200/90 active:bg-neutral-100 flex-row items-center space-x-1"
                        >
                          <Plus size={11} color="#18181B" strokeWidth={2.5} />
                          <Text className="text-[11px] font-bold text-neutral-800 ml-0.5">Add Slot</Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  {/* Class Time Slot Card */}
                  <View
                    className={`mb-3 rounded-2xl bg-white border p-3.5 shadow-2xs relative overflow-hidden ${
                      hasConflict
                        ? 'border-amber-400 bg-amber-50/30'
                        : 'border-neutral-200/80'
                    }`}
                  >
                    {/* Left Yellow Visual Accent Bar */}
                    <View className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-[#FACC15] rounded-r-full" />

                    <View className="flex-row items-start pl-2">
                      {/* Drag Grip Handle */}
                      <View className="pr-2 pt-1">
                        <GripVertical size={16} color="#A1A1AA" />
                      </View>

                      {/* Main Card Content */}
                      <View className="flex-1">
                        {/* Header Row */}
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1 mr-2">
                            <View className="flex-row items-center space-x-1.5 flex-wrap">
                              <Text className="text-xs font-black font-mono text-neutral-900 tracking-tight">
                                {courseCode}
                              </Text>
                              <View className="px-2 py-0.5 rounded-full bg-[#FACC15]/20 border border-[#FACC15]/40">
                                <Text className="text-[10px] font-extrabold text-neutral-900 uppercase">
                                  {block.session_type}
                                </Text>
                              </View>
                              <Text className="text-[10px] font-semibold text-neutral-500">
                                {block.frequency === 'weekly'
                                  ? 'Weekly'
                                  : block.frequency === 'biweekly_week_a'
                                  ? 'Week A'
                                  : 'Week B'}
                              </Text>
                            </View>

                            <Text className="text-sm font-black text-neutral-900 mt-1" numberOfLines={1}>
                              {courseTitle}
                            </Text>
                          </View>

                          {/* Action Buttons: Edit & Delete */}
                          {isSectionAdmin && (
                            <View className="flex-row items-center space-x-1">
                              <Pressable
                                onPress={() => router.push(`/schedule/edit-block?day=${selectedDay}&id=${block.id}`)}
                                className="w-8 h-8 rounded-lg items-center justify-center bg-neutral-100 active:bg-neutral-200"
                                accessibilityLabel="Edit Slot"
                              >
                                <Edit2 size={13} color="#18181B" />
                              </Pressable>
                              <Pressable
                                onPress={() => handleDeleteBlock(block.id, courseTitle)}
                                className="w-8 h-8 rounded-lg items-center justify-center bg-rose-50 active:bg-rose-100 ml-1"
                                accessibilityLabel="Delete Slot"
                              >
                                <Trash2 size={13} color="#E11D48" />
                              </Pressable>
                            </View>
                          )}
                        </View>

                        {/* Inline Conflict Warning */}
                        {hasConflict && (
                          <View className="mt-2 px-2 py-1 rounded-md bg-amber-100/80 border border-amber-300 flex-row items-center space-x-1.5">
                            <AlertTriangle size={12} color="#B45309" strokeWidth={2.5} />
                            <Text className="text-[10px] font-bold text-amber-900">
                              Schedule overlap on {formatTime12Hour(block.start_time)}
                            </Text>
                          </View>
                        )}

                        {/* Details Grid: Time & Venue */}
                        <View className="flex-row items-center space-x-2 mt-2.5">
                          <View className="flex-row items-center space-x-1 bg-neutral-100/80 border border-neutral-200/60 px-2 py-1 rounded-lg">
                            <Clock size={12} color="#71717A" />
                            <Text className="text-[11px] font-bold text-neutral-800">
                              {formatTime12Hour(block.start_time)} - {formatTime12Hour(block.end_time)}
                            </Text>
                            <Text className="text-[10px] text-neutral-400 font-mono font-semibold ml-0.5">
                              ({durationLabel})
                            </Text>
                          </View>

                          <View className="flex-row items-center space-x-1 bg-neutral-100/80 border border-neutral-200/60 px-2 py-1 rounded-lg flex-1">
                            <MapPin size={12} color="#71717A" />
                            <Text className="text-[11px] font-medium text-neutral-700 truncate" numberOfLines={1}>
                              {block.room || 'TBA'} • {block.instructor || 'Staff'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 5. Floating Bottom Docked Action Bar */}
      {isSectionAdmin && (
        <View className="absolute bottom-0 inset-x-0 bg-white/95 border-t border-neutral-200/80 px-4 pt-2.5 pb-6 shadow-lg">
          <View className="flex-row items-center space-x-2">
            <Pressable
              onPress={() => router.push(`/schedule/edit-block?day=${selectedDay}`)}
              className="flex-1 h-12 rounded-2xl bg-[#FACC15] items-center justify-center flex-row space-x-2 shadow-sm active:bg-yellow-400"
              accessibilityLabel="Add Time Slot"
            >
              <PlusCircle size={18} color="#18181B" strokeWidth={2.5} />
              <Text className="text-sm font-black text-neutral-950 tracking-wide ml-1">
                Add Time Slot
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setIsCloneModalVisible(true)}
              className="h-12 w-12 rounded-2xl bg-neutral-100 border border-neutral-200 items-center justify-center active:bg-neutral-200"
              accessibilityLabel="Clone Day Timetable"
            >
              <Copy size={18} color="#18181B" strokeWidth={2} />
            </Pressable>
          </View>
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
