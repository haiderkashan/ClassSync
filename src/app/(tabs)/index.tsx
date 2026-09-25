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
  ChevronLeft,
  ChevronRight,
  Radio,
  Moon,
  ArrowRight,
  PartyPopper,
  Sparkles,
  QrCode,
  Cast,
  Clock,
  Plus,
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

/**
 * Stitch-designed Student Agenda & Timetable Screen
 * File: src/app/(tabs)/index.tsx
 */
export default function AgendaScreen() {
  const router = useRouter();
  const supabase = useSupabase();

  const {
    sections,
    courses,
    activeSection,
    activeSectionId,
    setActiveSectionId,
    isLoading: isWorkspaceLoading,
    refetch,
  } = useWorkspaces();

  const {
    baseSchedules,
    overrides,
    currentParity,
    setCurrentParity,
    activeCourses,
  } = useAppStore();

  const {
    refetch: refetchSchedule,
    isLoading: isScheduleLoading,
    isSectionAdmin,
  } = useBaseSchedule();

  const {
    refetch: refetchOverrides,
    isLoading: isOverridesLoading,
  } = useScheduleOverrides();

  // Fetch active section calendar breaks
  const { data: sectionBreaks = [] } = useQuery<CalendarBreak[]>({
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
      return (data || []) as CalendarBreak[];
    },
    enabled: !!activeSection?.id,
  });

  // Resolve current device day of the week (1=Mon ... 7=Sun)
  const todayDayOfWeek = useMemo(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  }, []);

  const [selectedDay, setSelectedDay] = useState<number>(todayDayOfWeek);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const isToday = weekOffset === 0 && selectedDay === todayDayOfWeek;

  // Compute exact dates for the active week (Monday through Sunday)
  const weekDates = useMemo(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    if (weekOffset !== 0) {
      now.setDate(now.getDate() + weekOffset * 7);
    }
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
        isDeviceToday: weekOffset === 0 && todayDayOfWeek === day.id,
      };
    });
  }, [todayDayOfWeek, weekOffset]);

  const weekDateRangeFormatted = useMemo(() => {
    if (weekDates.length === 0) return '';
    const first = weekDates[0].fullDate;
    const last = weekDates[weekDates.length - 1].fullDate;
    const m1 = first.toLocaleDateString('en-US', { month: 'short' });
    const d1 = first.getDate();
    const m2 = last.toLocaleDateString('en-US', { month: 'short' });
    const d2 = last.getDate();
    return m1 === m2 ? `${m1} ${d1} – ${d2}` : `${m1} ${d1} – ${m2} ${d2}`;
  }, [weekDates]);

  const weekLabelText = useMemo(() => {
    if (weekOffset === 0) return 'This Week';
    if (weekOffset === 1) return 'Next Week';
    if (weekOffset === 2) return 'In 2 Weeks';
    if (weekOffset === -1) return 'Last Week';
    return weekOffset > 0 ? `+${weekOffset} Weeks` : `${weekOffset} Weeks`;
  }, [weekOffset]);

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
    const semStart =
      (activeSection as any)?.semester_start_date ||
      activeSection?.week_a_anchor_date;
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
  }, [
    selectedDateString,
    activeSection?.week_a_anchor_date,
    activeSection?.cycle_mode,
    sectionBreaks,
  ]);

  // Format academic week badge label (e.g. "Week 4 • Week A")
  const academicWeekLabel = useMemo(() => {
    if (activeSection?.cycle_mode !== 'alternating_ab' && !instructionalWeekNum) {
      return null;
    }
    return formatAcademicWeekLabel({
      parity: calculatedParity,
      weekNumber: instructionalWeekNum,
      namingConvention:
        (activeSection as any)?.cycle_naming_convention || 'week_ab',
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

  // Formatted selected day label
  const selectedDayFullHeader = useMemo(() => {
    const dayObj = weekDates.find((d) => d.id === selectedDay);
    const monthName = dayObj?.fullDate
      ? dayObj.fullDate.toLocaleDateString('en-US', { month: 'short' })
      : new Date().toLocaleDateString('en-US', { month: 'short' });
    return `${dayObj?.name || getDayName(selectedDay)}, ${monthName} ${dayObj?.dateNumber || ''}`;
  }, [selectedDay, weekDates]);

  // Calculate evening past 8 PM
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

  const tomorrowDayOfWeek = todayDayOfWeek >= 6 ? 1 : todayDayOfWeek + 1;

  // Determine if all classes on this day have been cancelled
  const allCancelled = useMemo(() => {
    return dayBlocks.length > 0 && dayBlocks.every((b) => b.is_cancelled);
  }, [dayBlocks]);

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchSchedule(), refetchOverrides()]);
  };

  const isLoading = isWorkspaceLoading || isScheduleLoading || isOverridesLoading;

  if (isLoading && sections.length === 0 && courses.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAF9] items-center justify-center">
        <ActivityIndicator size="large" color="#FACC15" />
        <Text className="text-xs font-semibold text-neutral-500 mt-3">
          Synchronizing schedule...
        </Text>
      </SafeAreaView>
    );
  }

  // If student has no enrolled section, show clean EmptyState
  if (!activeSection) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'bottom', 'left', 'right']}>
        <EmptyState
          title="No Enrolled Section"
          subtitle="Join your university class section or create a new section as a Class Representative to unlock your synchronized academic timetable."
          onJoinPress={() => router.push('/join-section')}
          onCreatePress={() => router.push('/create-section')}
          onScanPress={() => router.push('/cohort/scan-qr')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'left', 'right']}>
      {/* Top Header: Institution & Cohort Badge & Actions */}
      <View className="px-5 pt-2 pb-3 bg-[#FAFAF9] border-b border-neutral-200/60">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest" numberOfLines={1}>
              {activeSection.institution_tag || 'ACADEMIC TIMETABLE'}
            </Text>
            <View className="flex-row items-center space-x-2 mt-0.5">
              <Text className="text-xl font-black text-neutral-900 tracking-tight" numberOfLines={1}>
                {activeSection.name}
              </Text>
              {activeSection.join_code && (
                <View className="px-2 py-0.5 rounded-full bg-[#FACC15]/20 border border-[#FACC15]/60 ml-1.5">
                  <Text className="text-[10px] font-mono font-bold text-neutral-900">
                    #{activeSection.join_code}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Header Actions */}
          <View className="flex-row items-center space-x-2">
            {isSectionAdmin && (
              <Pressable
                testID="btn-makeup"
                accessibilityRole="button"
                accessibilityLabel="Schedule Makeup Class"
                onPress={() =>
                  router.push({
                    pathname: '/schedule/broadcast-exception',
                    params: { override_date: selectedDateString },
                  })
                }
                className="px-2.5 py-1.5 rounded-full bg-[#FEF08A] border border-[#FACC15] flex-row items-center active:bg-[#FACC15] transition-all"
              >
                <Sparkles size={12} color="#854D0E" />
                <Text className="text-[11px] font-bold text-neutral-900 ml-1">
                  + Makeup
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => router.push('/cohort/presenter-hud')}
              className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200/80 items-center justify-center active:bg-neutral-200 ml-1.5"
              accessibilityLabel="Presenter HUD"
            >
              <QrCode size={15} color="#18181B" strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        {/* Parity Segmented Switcher & Synced Indicator Row */}
        <View className="flex-row items-center justify-between mt-3">
          {/* Week Parity Segmented Toggle */}
          <View className="flex-row p-1 bg-neutral-100/90 rounded-full border border-neutral-200/60">
            <Pressable
              onPress={() => setCurrentParity('biweekly_week_a')}
              className={`px-3 py-1 rounded-full transition-all ${
                currentParity === 'biweekly_week_a'
                  ? 'bg-[#FACC15] shadow-2xs'
                  : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  currentParity === 'biweekly_week_a'
                    ? 'text-neutral-900'
                    : 'text-neutral-500'
                }`}
              >
                Week A
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setCurrentParity('biweekly_week_b')}
              className={`px-3 py-1 rounded-full transition-all ${
                currentParity === 'biweekly_week_b'
                  ? 'bg-[#FACC15] shadow-2xs'
                  : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  currentParity === 'biweekly_week_b'
                    ? 'text-neutral-900'
                    : 'text-neutral-500'
                }`}
              >
                Week B
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setCurrentParity('weekly')}
              className={`px-3 py-1 rounded-full transition-all ${
                currentParity === 'weekly'
                  ? 'bg-[#FACC15] shadow-2xs'
                  : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  currentParity === 'weekly'
                    ? 'text-neutral-900'
                    : 'text-neutral-500'
                }`}
              >
                All
              </Text>
            </Pressable>
          </View>

          {/* Sync Status Badge */}
          <View className="flex-row items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60">
            <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            <Text className="text-[10px] font-bold text-emerald-800">
              {academicWeekLabel || 'Synced'}
            </Text>
          </View>
        </View>

        {/* Week Navigator Strip (Previous, Current/Next Week with Date Range, Next) */}
        <View className="flex-row items-center justify-between mt-3 px-1 py-1.5 bg-neutral-100/90 rounded-2xl border border-neutral-200/60">
          <Pressable
            onPress={() => setWeekOffset((prev) => prev - 1)}
            accessibilityRole="button"
            testID="btn-prev-week"
            accessibilityLabel="Previous Week"
            className="w-8 h-8 rounded-xl bg-white border border-neutral-200/80 items-center justify-center active:bg-neutral-50 shadow-2xs"
          >
            <ChevronLeft size={16} color="#18181B" strokeWidth={2.2} />
          </Pressable>

          <View className="flex-row items-center">
            <Calendar size={13} color="#854D0E" strokeWidth={2.2} />
            <Text className="text-xs font-black text-neutral-900 ml-1.5 tracking-tight">
              {weekLabelText}
            </Text>
            <Text className="text-[11px] font-semibold text-neutral-500 ml-1.5">
              ({weekDateRangeFormatted})
            </Text>
            {weekOffset !== 0 && (
              <Pressable
                onPress={() => {
                  setWeekOffset(0);
                  setSelectedDay(todayDayOfWeek);
                }}
                accessibilityRole="button"
                testID="btn-week-today"
                className="px-2 py-0.5 rounded-full bg-[#FACC15] ml-2"
              >
                <Text className="text-[10px] font-bold text-neutral-900">
                  Today
                </Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => setWeekOffset((prev) => prev + 1)}
            accessibilityRole="button"
            testID="btn-next-week"
            accessibilityLabel="Next Week"
            className="w-8 h-8 rounded-xl bg-white border border-neutral-200/80 items-center justify-center active:bg-neutral-50 shadow-2xs"
          >
            <ChevronRight size={16} color="#18181B" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Horizontal Weekday Strip (Stitch 7-Day Rail) */}
        <View className="flex-row justify-between items-center mt-3 pt-1">
          {weekDates.map((day) => {
            const isSelected = selectedDay === day.id;
            return (
              <Pressable
                key={day.id}
                testID={`day-pill-${day.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${day.short} ${day.dateNumber}`}
                onPress={() => setSelectedDay(day.id)}
                className={`flex-1 mx-0.5 py-2 rounded-2xl items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-neutral-900 border border-neutral-900 shadow-xs'
                    : 'bg-white border border-neutral-200/70 active:bg-neutral-50'
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
                  className={`text-base font-black mt-0.5 leading-none ${
                    isSelected ? 'text-white' : 'text-neutral-800'
                  }`}
                >
                  {day.dateNumber}
                </Text>
                <View
                  className={`w-1 h-1 rounded-full mt-1.5 ${
                    isSelected ? 'bg-[#FACC15]' : day.isDeviceToday ? 'bg-amber-400' : 'bg-transparent'
                  }`}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Main Agenda Feed ScrollView */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor="#FACC15"
            colors={['#FACC15']}
          />
        }
      >
        {/* Recess / Break Banner */}
        {currentBreak && (
          <View className="mx-5 mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex-row items-center space-x-3">
            <Sparkles size={18} color="#D97706" />
            <View className="flex-1 ml-2">
              <Text className="text-xs font-bold text-amber-900">
                {currentBreak.break_name}
              </Text>
              <Text className="text-[11px] text-amber-700 mt-0.5">
                Break from {currentBreak.start_date} to {currentBreak.end_date}. Regular classes suspended.
              </Text>
            </View>
          </View>
        )}

        {/* All Classes Cancelled Banner */}
        {allCancelled && (
          <View className="mx-5 mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex-row items-center space-x-3">
            <PartyPopper size={18} color="#E11D48" />
            <View className="flex-1 ml-2">
              <Text className="text-xs font-bold text-rose-900">
                All Classes Cancelled Today
              </Text>
              <Text className="text-[11px] text-rose-700 mt-0.5">
                Every session scheduled for today has been officially called off.
              </Text>
            </View>
          </View>
        )}

        {/* Timetable Management CTA Header for CR */}
        {isSectionAdmin && (
          <View className="mx-5 mt-3.5 p-3.5 bg-white border border-neutral-200/80 rounded-2xl flex-row items-center justify-between shadow-2xs">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-8 h-8 rounded-xl bg-neutral-100 items-center justify-center mr-2.5">
                <Calendar size={16} color="#18181B" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-neutral-900">
                  Timetable Builder
                </Text>
                <Text className="text-[11px] text-neutral-500">
                  Manage weekly schedule and recurring time slots
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/schedule/builder')}
              accessibilityRole="button"
              accessibilityLabel="Open Timetable Builder"
              testID="btn-builder"
              className="bg-[#18181B] px-3 py-1.5 rounded-full flex-row items-center active:bg-neutral-800"
            >
              <Text className="text-xs font-bold text-white">Builder</Text>
              <ChevronRight size={13} color="#FFFFFF" className="ml-0.5" />
            </Pressable>
          </View>
        )}

        {/* Schedule Agenda Content */}
        {dayBlocks.length === 0 ? (
          <View className="mx-5 my-6 p-8 bg-white border border-neutral-200/70 rounded-3xl items-center justify-center shadow-2xs">
            <View className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 items-center justify-center mb-3">
              <Coffee size={24} color="#D97706" strokeWidth={2} />
            </View>
            <Text className="text-base font-black text-neutral-900 mb-1 text-center tracking-tight">
              {isToday ? 'No Classes Today' : `Free Day on ${getDayName(selectedDay)}`}
            </Text>
            <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs leading-relaxed">
              {isToday
                ? 'Enjoy your free day! There are no classes or makeup sessions scheduled on your calendar today.'
                : `There are no recurring classes or makeup sessions scheduled on ${getDayName(selectedDay)}.`}
            </Text>
            {isSectionAdmin && (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/schedule/edit-block',
                    params: { day: selectedDay.toString() },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Schedule Class"
                testID="btn-schedule-class"
                className="mt-4 px-4 py-2 rounded-full bg-neutral-900 flex-row items-center active:bg-neutral-800"
              >
                <Plus size={14} color="#FACC15" strokeWidth={2.5} />
                <Text className="text-xs font-bold text-white ml-1.5">
                  Schedule Class
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View className="px-5 pt-3.5">
            {dayBlocks.map((block: CompiledScheduleItem, index: number) => {
              const prevBlock = index > 0 ? dayBlocks[index - 1] : null;
              let freePeriodDuration = 0;

              if (prevBlock) {
                freePeriodDuration = calculateDurationMinutes(
                  prevBlock.end_time,
                  block.start_time
                );
              }

              const peerReport = getReportForBlock(block.id);
              const userVote = getUserVoteForBlock(block.id);

              return (
                <View key={block.id || `schedule-item-${index}`}>
                  {/* Free Period Break Spacer */}
                  {freePeriodDuration >= 15 && (
                    <FreePeriodSpacer
                      durationMinutes={freePeriodDuration}
                      startTime={prevBlock?.end_time}
                      endTime={block.start_time}
                    />
                  )}

                  {/* Class Card */}
                  <ScheduleBlockCard
                    block={block}
                    date={selectedDateString}
                    readOnly={false}
                    isAdmin={isSectionAdmin}
                    peerReport={peerReport}
                    userVote={userVote}
                    onPeerVotePress={(b) => setActiveVotingBlock(b)}
                    onPress={(b) => {
                      if (isSectionAdmin) {
                        router.push({
                          pathname: '/schedule/edit-block',
                          params: { id: b.id, day: selectedDay.toString() },
                        });
                      }
                    }}
                    onLongPress={(b) => {
                      if (isSectionAdmin) {
                        router.push({
                          pathname: '/schedule/broadcast-exception',
                          params: {
                            base_schedule_id: b.id,
                            override_date: selectedDateString,
                          },
                        });
                      }
                    }}
                    onBroadcastPress={(b) => {
                      if (isSectionAdmin) {
                        router.push({
                          pathname: '/schedule/broadcast-exception',
                          params: {
                            base_schedule_id: b.id,
                            override_date: selectedDateString,
                          },
                        });
                      }
                    }}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Peer Verification Voting Modal */}
      {activeVotingBlock && (
        <PeerVotingModal
          visible={!!activeVotingBlock}
          onClose={() => setActiveVotingBlock(null)}
          block={activeVotingBlock}
          report={getReportForBlock(activeVotingBlock.base_schedule_id || activeVotingBlock.id)}
          isAdmin={isSectionAdmin}
          targetDate={selectedDateString}
          userVote={getUserVoteForBlock(activeVotingBlock.base_schedule_id || activeVotingBlock.id)}
          onCastVote={async (vote: 'affirm' | 'deny') => {
            await castVote({
              baseScheduleId: activeVotingBlock.base_schedule_id || activeVotingBlock.id,
              vote,
            });
          }}
          onVetoReport={async (reportId: string, reason?: string) => {
            await vetoReport({ reportId, reason });
          }}
          isVoting={isCastingVote}
          isVetoing={isVetoing}
        />
      )}
    </SafeAreaView>
  );
}
