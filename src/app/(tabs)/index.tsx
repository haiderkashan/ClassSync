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
  Radio,
  Moon,
  ArrowRight,
  PartyPopper,
  Sparkles,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import { useBaseSchedule } from '@/hooks/useBaseSchedule';
import { useScheduleOverrides } from '@/hooks/useScheduleOverrides';
import { EmptyState } from '@/components/EmptyState';
import { ScheduleBlockCard } from '@/components/ScheduleBlockCard';
import { FreePeriodSpacer } from '@/components/FreePeriodSpacer';
import { PeerVotingModal } from '@/components/peer/PeerVotingModal';
import { usePeerVerification } from '@/hooks/usePeerVerification';
import {
  getDayName,
  calculateDurationMinutes,
  formatTime12Hour,
} from '@/lib/schedule/timeUtils';
import {
  compileDailySchedule,
  type CompiledScheduleItem,
} from '@/lib/schedule/scheduleCompiler';
import {
  getLocalDateString,
  calculateWeekParity,
  isDateInBreak,
  getInstructionalWeekNumber,
  formatAcademicWeekLabel,
  type CalendarBreak,
} from '@/lib/schedule/calendarUtils';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
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
  const { setActiveSectionId, baseSchedules, overrides, activeCourses } = useAppStore();
  const {
    isFetching: isScheduleFetching,
    refetch: refetchSchedule,
    isSectionAdmin,
    currentParity,
    setCurrentParity,
  } = useBaseSchedule();
  const { refetch: refetchOverrides } = useScheduleOverrides();

  const supabase = useSupabase();

  // Fetch active section calendar breaks
  const { data: sectionBreaks = [] } = useQuery({
    queryKey: ['section_calendar_breaks', activeSection?.id],
    queryFn: async () => {
      if (!activeSection?.id) return [];
      const { data, error } = await supabase
        .from('section_calendar_breaks')
        .select('*')
        .eq('section_id', activeSection.id)
        .order('start_date', { ascending: true });
      if (error) {
        console.warn('⚠️ [Agenda] Failed to fetch calendar breaks:', error.message);
        return [];
      }
      return data as CalendarBreak[];
    },
    enabled: !!activeSection?.id,
  });

  // Resolve current device day of the week (1=Mon ... 7=Sun)
  const todayDayOfWeek = useMemo(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  }, []);

  const [selectedDay, setSelectedDay] = useState<number>(todayDayOfWeek);
  const isToday = selectedDay === todayDayOfWeek;

  // Compute exact dates for the current week (Monday through Sunday)
  const weekDates = useMemo(() => {
    const now = new Date();
    // Anchor to 12:00:00 (Noon) so timezone shifts never cross calendar day boundaries
    now.setHours(12, 0, 0, 0);
    const currentJsDay = now.getDay() === 0 ? 7 : now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (currentJsDay - 1));

    return DAYS_OF_WEEK.map((day) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + (day.id - 1));
      return {
        ...day,
        dateNumber: d.getDate(),
        fullDate: d,
        isDeviceToday: todayDayOfWeek === day.id,
      };
    });
  }, [todayDayOfWeek]);

  // Derived calendar date string (YYYY-MM-DD) for currently selected day
  const selectedDateString = useMemo(() => {
    const dayObj = weekDates.find((d) => d.id === selectedDay);
    if (!dayObj) return getLocalDateString(new Date(), activeSection?.timezone || 'UTC');
    return getLocalDateString(dayObj.fullDate, activeSection?.timezone || 'UTC');
  }, [selectedDay, weekDates, activeSection?.timezone]);

  // Crowd-Sourced Peer Verification Hook & Realtime Consensus
  const {
    getReportForBlock,
    getUserVoteForBlock,
    castVote,
    vetoReport,
    isCastingVote,
    isVetoing,
  } = usePeerVerification({
    sectionId: activeSection?.id,
    targetDate: selectedDateString,
  });

  const [activeVotingBlock, setActiveVotingBlock] = useState<any | null>(null);

  // Check if currently selected day falls in any registered break
  const currentBreak = useMemo(() => {
    return isDateInBreak(selectedDateString, sectionBreaks);
  }, [selectedDateString, sectionBreaks]);

  // Compute 1-indexed instructional week number
  const instructionalWeekNum = useMemo(() => {
    const semStart = (activeSection as any)?.semester_start_date || activeSection?.week_a_anchor_date;
    return getInstructionalWeekNumber(selectedDateString, semStart, sectionBreaks);
  }, [selectedDateString, activeSection, sectionBreaks]);

  // Compute calculated parity for selected date
  const calculatedParity = useMemo(() => {
    return calculateWeekParity(
      selectedDateString,
      activeSection?.week_a_anchor_date,
      activeSection?.cycle_mode || 'standard_weekly',
      sectionBreaks
    );
  }, [selectedDateString, activeSection?.week_a_anchor_date, activeSection?.cycle_mode, sectionBreaks]);

  // Format academic week badge label (e.g. "Week 4 • Week A")
  const academicWeekLabel = useMemo(() => {
    if (activeSection?.cycle_mode !== 'alternating_ab' && !instructionalWeekNum) {
      return null;
    }
    return formatAcademicWeekLabel({
      parity: calculatedParity,
      weekNumber: instructionalWeekNum,
      namingConvention: (activeSection as any)?.cycle_naming_convention || 'week_ab',
      inBreak: !!currentBreak,
      breakName: currentBreak?.break_name,
    });
  }, [activeSection, calculatedParity, instructionalWeekNum, currentBreak]);

  // Dynamically compile daily schedule incorporating live status overrides & makeups
  const dayBlocks = useMemo(() => {
    return compileDailySchedule({
      targetDate: selectedDateString,
      baseSchedules,
      overrides,
      activeCourses,
      targetParity: currentParity,
      anchorDate: activeSection?.week_a_anchor_date,
      cycleMode: activeSection?.cycle_mode || 'standard_weekly',
      includeCancelled: true,
      breaks: sectionBreaks,
    });
  }, [
    selectedDateString,
    baseSchedules,
    overrides,
    activeCourses,
    currentParity,
    activeSection?.week_a_anchor_date,
    activeSection?.cycle_mode,
    sectionBreaks,
  ]);

  // Formatted selected day label, e.g. "Monday, September 19"
  const selectedDayFullHeader = useMemo(() => {
    const dayObj = weekDates.find((d) => d.id === selectedDay);
    const monthName = dayObj?.fullDate
      ? dayObj.fullDate.toLocaleDateString('en-US', { month: 'short' })
      : new Date().toLocaleDateString('en-US', { month: 'short' });
    return `${dayObj?.name || getDayName(selectedDay)}, ${monthName} ${dayObj?.dateNumber || ''}`;
  }, [selectedDay, weekDates]);

  // Calculate current wall-clock hour in section's timezone to detect evening past 20:00
  const isEveningPast8PM = useMemo(() => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: activeSection?.timezone || 'UTC',
        hour: 'numeric',
        hour12: false,
      });
      const currentHour = parseInt(formatter.format(new Date()), 10);
      return currentHour >= 20;
    } catch {
      return new Date().getHours() >= 20;
    }
  }, [activeSection?.timezone]);

  const tomorrowDayOfWeek = todayDayOfWeek === 7 ? 1 : todayDayOfWeek + 1;

  // Determine if all classes on this day have been cancelled
  const allCancelled = useMemo(() => {
    return dayBlocks.length > 0 && dayBlocks.every((b) => b.is_cancelled);
  }, [dayBlocks]);

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchSchedule(), refetchOverrides()]);
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
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'left', 'right']}>
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
              <View className="bg-[#FEF08A]/70 border border-[#FACC15]/80 px-3 py-1.5 rounded-full flex-row items-center shadow-2xs">
                <Hash size={12} color="#854D0E" />
                <Text className="text-xs font-mono font-bold text-neutral-900 ml-1">
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
                      className={`mr-2 px-3.5 py-1.5 rounded-full border flex-row items-center ${
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
            <View className="flex-row items-center flex-wrap gap-1.5 flex-1 mr-2">
              <Text className="text-xs font-bold text-neutral-800 tracking-tight">
                {selectedDayFullHeader}
              </Text>
              {isToday && (
                <View className="bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-emerald-700">Today</Text>
                </View>
              )}
              {academicWeekLabel && (
                <View className="bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-indigo-700">{academicWeekLabel}</Text>
                </View>
              )}
            </View>

            {/* Parity Segmented Control */}
            <View className="flex-row p-1 bg-neutral-100 rounded-full border border-neutral-200/60">
              {PARITY_OPTIONS.map((opt) => {
                const isSelected = currentParity === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setCurrentParity(opt.id)}
                    className={`px-3 py-1 rounded-full ${
                      isSelected
                        ? 'bg-[#FACC15] shadow-xs'
                        : 'active:bg-neutral-200/60'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-bold ${
                        isSelected ? 'text-[#18181B]' : 'text-neutral-500'
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
                    className={`mr-2.5 rounded-2xl py-2 px-3 min-w-[52px] items-center justify-center ${
                      isSelected
                        ? 'bg-[#18181B] border border-[#FACC15] shadow-sm'
                        : 'bg-white border border-neutral-200/90 shadow-2xs active:bg-neutral-50'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isSelected ? 'text-[#FACC15]' : 'text-neutral-400'
                      }`}
                    >
                      {day.short}
                    </Text>
                    <Text
                      className={`text-base font-black mt-0.5 ${
                        isSelected ? 'text-white' : 'text-neutral-900'
                      }`}
                    >
                      {day.dateNumber}
                    </Text>
                    {/* Active/Today Indicator Dot */}
                    <View
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        isSelected
                          ? 'bg-[#FACC15]'
                          : day.isDeviceToday
                          ? 'bg-[#18181B]'
                          : 'bg-transparent'
                      }`}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Smart Evening Auto-Recommendation Pill (Past 20:00) */}
        {isEveningPast8PM && isToday && (
          <Pressable
            onPress={() => setSelectedDay(tomorrowDayOfWeek)}
            className="mx-5 mt-3 px-4 py-2.5 bg-neutral-900 rounded-full flex-row items-center justify-between shadow-2xs active:bg-neutral-800"
          >
            <View className="flex-row items-center space-x-2">
              <Moon size={14} color="#fef08a" />
              <Text className="text-xs font-bold text-white ml-2">
                Good evening! Tap to preview tomorrow
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-[11px] font-bold text-neutral-400 mr-1.5">
                {DAYS_OF_WEEK.find((d) => d.id === tomorrowDayOfWeek)?.short}
              </Text>
              <ArrowRight size={13} color="#ffffff" />
            </View>
          </Pressable>
        )}

        {/* Recess / Academic Break Banner */}
        {currentBreak && (
          <View className="mx-5 mt-3 p-4 bg-indigo-50/90 border border-indigo-200/80 rounded-3xl flex-row items-center space-x-3 shadow-2xs">
            <View className="w-10 h-10 rounded-2xl bg-indigo-100 items-center justify-center">
              <Sparkles size={20} color="#4F46E5" />
            </View>
            <View className="flex-1 ml-2.5">
              <View className="flex-row items-center space-x-1.5">
                <Text className="text-xs font-black text-indigo-950">{currentBreak.break_name}</Text>
                {currentBreak.freeze_cycle && (
                  <View className="bg-purple-100 px-1.5 py-0.5 rounded-full">
                    <Text className="text-[9px] font-bold text-purple-800">Cycle Paused</Text>
                  </View>
                )}
              </View>
              <Text className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                Semester recess from {currentBreak.start_date} to {currentBreak.end_date}. Regular classes are on break.
              </Text>
            </View>
          </View>
        )}

        {/* All Classes Cancelled Banner */}
        {allCancelled && (
          <View className="mx-5 mt-3 p-4 bg-rose-50/90 border border-rose-200/80 rounded-3xl flex-row items-center space-x-3 shadow-2xs">
            <View className="w-10 h-10 rounded-2xl bg-rose-100 items-center justify-center">
              <PartyPopper size={20} color="#e11d48" />
            </View>
            <View className="flex-1 ml-2.5">
              <Text className="text-xs font-black text-rose-900">
                All Classes Cancelled Today
              </Text>
              <Text className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                Enjoy your free time! Every session scheduled for today has been called off.
              </Text>
            </View>
          </View>
        )}

        {/* CR Timetable Management & Exception Broadcast Banner */}
        {isSectionAdmin && (
          <View className="mx-5 mt-4 p-4 bg-white border border-neutral-100/90 rounded-3xl flex-row items-center justify-between shadow-2xs">
            <View className="flex-row items-center space-x-3 flex-1 mr-2">
              <View className="w-10 h-10 rounded-2xl bg-neutral-900 items-center justify-center shadow-xs">
                <Calendar size={18} color="#ffffff" strokeWidth={2.2} />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs font-black text-neutral-900 tracking-tight">
                  Timetable & Live Alerts
                </Text>
                <Text className="text-[11px] font-medium text-neutral-500 mt-0.5">
                  Long-press any class to broadcast delays or cancellations
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-1.5">
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/schedule/broadcast-exception',
                    params: {
                      override_date: selectedDateString,
                    },
                  })
                }
                className="bg-[#FEF08A]/80 border border-[#FACC15] px-3 py-2 rounded-full flex-row items-center active:bg-[#FEF08A]"
              >
                <Radio size={12} color="#854D0E" />
                <Text className="text-xs font-bold text-neutral-900 ml-1">+ Alert</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/schedule/builder')}
                className="bg-[#18181B] px-3.5 py-2 rounded-full flex-row items-center active:bg-neutral-800 shadow-2xs"
              >
                <Text className="text-xs font-bold text-white">Builder</Text>
                <ChevronRight size={14} color="#ffffff" className="ml-0.5" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Schedule Agenda Content */}
        {dayBlocks.length === 0 ? (
          <View className="mx-5 my-6 p-8 bg-white border border-neutral-100/90 rounded-3xl items-center justify-center shadow-2xs">
            <View className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100/80 items-center justify-center mb-3">
              {selectedDay === 6 || selectedDay === 7 ? (
                <Sparkles size={24} color="#d97706" strokeWidth={2} />
              ) : (
                <Coffee size={24} color="#d97706" strokeWidth={2} />
              )}
            </View>
            <Text className="text-base font-black text-neutral-900 mb-1 text-center tracking-tight">
              {selectedDay === 6 || selectedDay === 7
                ? 'Weekend Recharge'
                : isToday
                ? 'No Classes Today'
                : `Free Day on ${getDayName(selectedDay)}`}
            </Text>
            <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs leading-relaxed">
              {selectedDay === 6 || selectedDay === 7
                ? 'No classes scheduled for the weekend. Rest up and prepare for the week ahead!'
                : isToday
                ? 'Enjoy your free day! There are no classes or makeup sessions scheduled on your calendar today.'
                : `There are no recurring classes or makeup sessions scheduled on ${getDayName(selectedDay)}.`}
            </Text>
          </View>
        ) : (
          <View className="px-5 pt-4">
            {dayBlocks.map((block: CompiledScheduleItem, index: number) => {
              const prevBlock = index > 0 ? dayBlocks[index - 1] : null;
              let freePeriodDuration = 0;

              if (prevBlock) {
                freePeriodDuration = calculateDurationMinutes(
                  prevBlock.end_time,
                  block.start_time
                );
              }

              const startTimeParts = formatTime12Hour(block.start_time || '09:00').split(' ');
              const startTimeNumber = startTimeParts[0] || '9:00';
              const startTimePeriod = startTimeParts[1] || 'AM';
              const endTimeNumber = formatTime12Hour(block.end_time || '10:00').split(' ')[0] || '10:00';

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
                      <View className="w-3 h-3 rounded-full bg-[#18181B] border-2 border-white items-center justify-center shadow-2xs">
                        <View className="w-1 h-1 rounded-full bg-[#FACC15]" />
                      </View>
                      <View className="w-0.5 flex-1 bg-neutral-200/80 my-1 rounded-full" />
                    </View>

                    {/* Right: Floating Pastel Schedule Block Card */}
                    <View className="flex-1 pb-1">
                      {(() => {
                        const blockId = block.base_schedule_id || block.id;
                        const report = getReportForBlock(blockId);
                        const vote = getUserVoteForBlock(blockId);

                        return (
                          <ScheduleBlockCard
                            block={block}
                            date={selectedDateString}
                            readOnly={!isSectionAdmin}
                            isAdmin={isSectionAdmin}
                            peerReport={report}
                            userVote={vote}
                            onPeerVotePress={(target) => setActiveVotingBlock(target)}
                            onPress={() => {
                              if (isSectionAdmin) {
                                router.push({
                                  pathname: '/schedule/broadcast-exception',
                                  params: {
                                    base_schedule_id: block.is_makeup ? undefined : (block.base_schedule_id || block.id),
                                    course_id: block.course_id,
                                    override_date: selectedDateString,
                                  },
                                });
                              }
                            }}
                            onLongPress={() => {
                              if (isSectionAdmin) {
                                router.push({
                                  pathname: '/schedule/broadcast-exception',
                                  params: {
                                    base_schedule_id: block.is_makeup ? undefined : (block.base_schedule_id || block.id),
                                    course_id: block.course_id,
                                    override_date: selectedDateString,
                                  },
                                });
                              }
                            }}
                          />
                        );
                      })()}
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Peer Voting & CR Veto Consensus Modal */}
      {activeVotingBlock && (
        <PeerVotingModal
          visible={!!activeVotingBlock}
          onClose={() => setActiveVotingBlock(null)}
          block={activeVotingBlock}
          report={getReportForBlock(activeVotingBlock.base_schedule_id || activeVotingBlock.id)}
          isAdmin={isSectionAdmin}
          targetDate={selectedDateString}
          userVote={getUserVoteForBlock(activeVotingBlock.base_schedule_id || activeVotingBlock.id)}
          onCastVote={async (vote) => {
            await castVote({
              baseScheduleId: activeVotingBlock.base_schedule_id || activeVotingBlock.id,
              vote,
            });
          }}
          onVetoReport={async (reportId, reason) => {
            await vetoReport({ reportId, reason });
          }}
          isVoting={isCastingVote}
          isVetoing={isVetoing}
        />
      )}
    </SafeAreaView>
  );
}
