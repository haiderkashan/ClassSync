import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Calendar,
  Hash,
  Layers,
  Coffee,
  ChevronRight,
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
  formatTime12Hour,
} from '@/lib/schedule/timeUtils';
import type { BaseScheduleRow, WeekParity } from '@/store/useAppStore';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

const PARITY_OPTIONS: { id: WeekParity; label: string }[] = [
  { id: 'biweekly_week_a', label: 'Week A' },
  { id: 'biweekly_week_b', label: 'Week B' },
  { id: 'weekly', label: 'All' },
];

export default function AgendaScreen() {
  const router = useRouter();
  const { sections, activeSection, courses, isLoading, isFetching, refetch } = useWorkspaces();
  const { setActiveSectionId } = useAppStore();
  const {
    getBlocksForDay,
    isFetching: isScheduleFetching,
    refetch: refetchSchedule,
    isSectionAdmin,
    currentParity,
    setCurrentParity,
  } = useBaseSchedule();

  // Resolve current device day of the week (1=Mon ... 7=Sun)
  const todayDayOfWeek = useMemo(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  }, []);

  const [selectedDay, setSelectedDay] = useState<number>(todayDayOfWeek);
  const dayBlocks = getBlocksForDay(selectedDay);
  const isToday = selectedDay === todayDayOfWeek;

  // Compute exact dates for the current week (Monday through Sunday)
  const weekDates = useMemo(() => {
    const now = new Date();
    const currentJsDay = now.getDay() === 0 ? 7 : now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (currentJsDay - 1));

    return DAYS_OF_WEEK.map((day) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + (day.id - 1));
      return {
        ...day,
        dateNumber: d.getDate(),
        isDeviceToday: todayDayOfWeek === day.id,
      };
    });
  }, [todayDayOfWeek]);

  // Formatted selected day label, e.g. "Monday, September 19"
  const selectedDayFullHeader = useMemo(() => {
    const dayObj = weekDates.find((d) => d.id === selectedDay);
    const monthName = new Date().toLocaleDateString('en-US', { month: 'short' });
    return `${dayObj?.name || getDayName(selectedDay)}, ${monthName} ${dayObj?.dateNumber || ''}`;
  }, [selectedDay, weekDates]);

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchSchedule()]);
  };

  if (isLoading && sections.length === 0 && courses.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F9FA] items-center justify-center" edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color="#18181b" />
        <Text className="text-xs font-semibold text-neutral-400 mt-3 tracking-wide">
          Syncing your academic workspaces...
        </Text>
      </SafeAreaView>
    );
  }

  if (sections.length === 0 && courses.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'left', 'right']}>
        <EmptyState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching || isScheduleFetching}
            onRefresh={handleRefresh}
            tintColor="#18181b"
            colors={['#18181b']}
          />
        }
      >
        {/* Active Section Header Card */}
        <View className="px-5 pt-3 pb-3 bg-white border-b border-neutral-100/90 shadow-2xs">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">
                {activeSection?.institution_tag || (courses.length > 0 ? 'Guest Student Enrollment' : 'Active Cohort')}
              </Text>
              <Text className="text-xl font-black text-neutral-900 tracking-tight" numberOfLines={1}>
                {activeSection?.name || (courses.length > 0 ? 'Enrolled Courses Timetable' : 'Class Section')}
              </Text>
            </View>

            {/* Join Code Pill */}
            {activeSection?.join_code && (
              <View className="bg-neutral-50 border border-neutral-200/70 px-3 py-1.5 rounded-full flex-row items-center shadow-2xs">
                <Hash size={12} color="#71717a" />
                <Text className="text-xs font-mono font-bold text-neutral-800 ml-1">
                  {activeSection.join_code}
                </Text>
              </View>
            )}
          </View>

          {/* Multi-Section Workspace Switcher Pills */}
          {sections.length > 1 && (
            <View className="mt-3 pt-2.5 border-t border-neutral-100">
              <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                Enrolled Sections
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {sections.map((sec) => {
                  const isSelected = sec.id === activeSection?.id;
                  return (
                    <Pressable
                      key={sec.id}
                      onPress={() => setActiveSectionId(sec.id)}
                      className={`mr-2 px-3.5 py-1.5 rounded-full border flex-row items-center transition-all ${
                        isSelected
                          ? 'bg-neutral-900 border-neutral-900 shadow-xs'
                          : 'bg-white border-neutral-200/80 active:bg-neutral-50'
                      }`}
                    >
                      <Layers
                        size={12}
                        color={isSelected ? '#ffffff' : '#71717a'}
                        className="mr-1.5"
                      />
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-neutral-700'
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

          {/* Header Sub-Row: Selected Day Full Name & Parity Segmented Control */}
          <View className="mt-3 pt-2.5 border-t border-neutral-100 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-xs font-bold text-neutral-800 tracking-tight">
                {selectedDayFullHeader}
              </Text>
              {isToday && (
                <View className="ml-2 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-emerald-700">Today</Text>
                </View>
              )}
            </View>

            {/* Parity Segmented Control */}
            <View className="flex-row p-1 bg-neutral-100/90 rounded-full">
              {PARITY_OPTIONS.map((opt) => {
                const isSelected = currentParity === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setCurrentParity(opt.id)}
                    className={`px-3 py-1 rounded-full transition-all ${
                      isSelected
                        ? 'bg-white shadow-2xs'
                        : 'active:bg-neutral-200/60'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-bold ${
                        isSelected ? 'text-neutral-900' : 'text-neutral-500'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Date Strip: Day Name Stacked Over Date Number */}
          <View className="mt-3 pt-2 border-t border-neutral-100">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
              {weekDates.map((day) => {
                const isSelected = selectedDay === day.id;

                return (
                  <Pressable
                    key={day.id}
                    onPress={() => setSelectedDay(day.id)}
                    className={`mr-2.5 rounded-2xl py-2.5 px-3 min-w-[50px] items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-neutral-900 shadow-sm shadow-neutral-900/20'
                        : 'bg-white border border-neutral-150/90 shadow-2xs active:bg-neutral-50'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isSelected ? 'text-neutral-400' : 'text-neutral-400'
                      }`}
                    >
                      {day.short}
                    </Text>
                    <Text
                      className={`text-base font-black mt-0.5 ${
                        isSelected ? 'text-white' : 'text-neutral-800'
                      }`}
                    >
                      {day.dateNumber}
                    </Text>
                    {/* Active/Today Indicator Dot */}
                    <View
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        isSelected
                          ? 'bg-white'
                          : day.isDeviceToday
                          ? 'bg-neutral-900'
                          : 'bg-transparent'
                      }`}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* CR Timetable Management Quick Action Banner */}
        {isSectionAdmin && (
          <View className="mx-5 mt-4 p-4 bg-white border border-neutral-100/90 rounded-3xl flex-row items-center justify-between shadow-2xs">
            <View className="flex-row items-center space-x-3 flex-1 mr-3">
              <View className="w-10 h-10 rounded-2xl bg-neutral-900 items-center justify-center shadow-xs">
                <Calendar size={18} color="#ffffff" strokeWidth={2.2} />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs font-black text-neutral-900 tracking-tight">
                  Timetable Builder
                </Text>
                <Text className="text-[11px] font-medium text-neutral-500 mt-0.5">
                  Configure class slots, rooms, and weekly schedule
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/schedule/builder')}
              className="bg-neutral-900 px-4 py-2.5 rounded-full flex-row items-center active:bg-neutral-800 shadow-2xs"
            >
              <Text className="text-xs font-bold text-white">Manage</Text>
              <ChevronRight size={14} color="#ffffff" className="ml-1" />
            </Pressable>
          </View>
        )}

        {/* Schedule Agenda Content */}
        {dayBlocks.length === 0 ? (
          <View className="mx-5 my-6 p-8 bg-white border border-neutral-100/90 rounded-3xl items-center justify-center shadow-2xs">
            <View className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100/80 items-center justify-center mb-3">
              <Coffee size={24} color="#d97706" strokeWidth={2} />
            </View>
            <Text className="text-base font-black text-neutral-900 mb-1 text-center tracking-tight">
              No Classes Scheduled
            </Text>
            <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs leading-relaxed">
              {isToday
                ? 'Enjoy your free day! There are no recurring classes scheduled for today.'
                : `There are no recurring classes scheduled on ${getDayName(selectedDay)}.`}
            </Text>
          </View>
        ) : (
          <View className="px-5 pt-4">
            {dayBlocks.map((block: BaseScheduleRow, index: number) => {
              const prevBlock = index > 0 ? dayBlocks[index - 1] : null;
              let freePeriodDuration = 0;

              if (prevBlock) {
                freePeriodDuration = calculateDurationMinutes(
                  prevBlock.end_time,
                  block.start_time
                );
              }

              const startTimeParts = formatTime12Hour(block.start_time).split(' ');
              const startTimeNumber = startTimeParts[0];
              const startTimePeriod = startTimeParts[1] || '';
              const endTimeNumber = formatTime12Hour(block.end_time).split(' ')[0];

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

                  {/* Vertical Timeline Row */}
                  <View className="flex-row items-stretch mb-1">
                    {/* Left: Time Axis */}
                    <View className="w-14 pt-1 items-end pr-2.5">
                      <Text className="text-xs font-black text-neutral-900 tracking-tight">
                        {startTimeNumber}
                      </Text>
                      <Text className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                        {startTimePeriod}
                      </Text>
                      <View className="my-1.5 h-1" />
                      <Text className="text-[10px] font-semibold text-neutral-400">
                        {endTimeNumber}
                      </Text>
                    </View>

                    {/* Timeline Node & Vertical Connector Line */}
                    <View className="items-center mr-2.5 pt-1.5">
                      <View className="w-2.5 h-2.5 rounded-full bg-neutral-900 border-2 border-white shadow-2xs" />
                      <View className="w-0.5 flex-1 bg-neutral-200/70 my-1 rounded-full" />
                    </View>

                    {/* Right: Floating Pastel Schedule Block Card */}
                    <View className="flex-1 pb-1">
                      <ScheduleBlockCard
                        block={block}
                        readOnly={true}
                      />
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
