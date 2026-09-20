import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  X,
  Clock,
  MapPin,
  AlertTriangle,
  Calendar,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Radio,
  BookOpen,
  Send,
} from 'lucide-react-native';
import { useAppStore } from '@/store/useAppStore';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useScheduleOverrides } from '@/hooks/useScheduleOverrides';
import {
  formatTime12Hour,
  timeToMinutes,
  minutesToTime,
  calculateDurationMinutes,
  formatDuration,
} from '@/lib/schedule/timeUtils';
import {
  getLocalDateString,
  getTomorrowDateString,
} from '@/lib/schedule/calendarUtils';
import type { ScheduleOverrideStatus } from '@/lib/schedule/scheduleCompiler';

interface QuickDelayPreset {
  label: string;
  minutes: number;
}

const DELAY_PRESETS: QuickDelayPreset[] = [
  { label: '+10m', minutes: 10 },
  { label: '+15m', minutes: 15 },
  { label: '+20m', minutes: 20 },
  { label: '+30m', minutes: 30 },
  { label: '+45m', minutes: 45 },
  { label: '+60m', minutes: 60 },
];

const NOTE_PRESETS = [
  'Professor delayed in transit',
  'Room change due to technical issue',
  'Extended lab session',
  'Makeup lecture for holiday',
  'Special guest speaker presentation',
];

export default function BroadcastExceptionModal() {
  const router = useRouter();
  const { activeSection, courses, activeSectionId } = useWorkspaces();
  const timezone = activeSection?.timezone || 'UTC';

  // Extract lightweight identifiers from Expo Router route params
  const {
    base_schedule_id,
    course_id: paramCourseId,
    override_date: paramOverrideDate,
  } = useLocalSearchParams<{
    base_schedule_id?: string;
    course_id?: string;
    override_date?: string;
  }>();

  // Read data from Zustand client store
  const { baseSchedules, overrides, activeCourses } = useAppStore();
  const { upsertOverride, deleteOverride, isUpserting, isDeleting } =
    useScheduleOverrides();

  // Lookup the recurring base block from store (if editing an existing recurring block)
  const baseBlock = useMemo(() => {
    if (!base_schedule_id) return null;
    return baseSchedules.find((b) => b.id === base_schedule_id) ?? null;
  }, [base_schedule_id, baseSchedules]);

  const isMakeup = !base_schedule_id;

  // Resolve target calendar date (defaults to param or today)
  const defaultToday = useMemo(() => getLocalDateString(new Date(), timezone), [timezone]);
  const defaultTomorrow = useMemo(() => getTomorrowDateString(timezone), [timezone]);

  const [selectedDate, setSelectedDate] = useState<string>(
    paramOverrideDate || defaultToday
  );
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [datePickerValue, setDatePickerValue] = useState<Date>(() => {
    if (paramOverrideDate) {
      const [y, m, d] = paramOverrideDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });

  // Check if an existing override is present for this block and date
  const existingOverride = useMemo(() => {
    if (!selectedDate) return null;
    return (
      overrides.find(
        (o) =>
          o.override_date === selectedDate &&
          ((base_schedule_id && o.base_schedule_id === base_schedule_id) ||
            (isMakeup && paramCourseId && o.course_id === paramCourseId))
      ) ?? null
    );
  }, [overrides, selectedDate, base_schedule_id, isMakeup, paramCourseId]);

  // Form states
  const [status, setStatus] = useState<ScheduleOverrideStatus>(() => {
    if (existingOverride) {
      return (existingOverride.status as ScheduleOverrideStatus) || 'scheduled';
    }
    return 'delayed';
  });

  const [delayMinutes, setDelayMinutes] = useState<number>(() => {
    return existingOverride?.delay_minutes || 15;
  });

  const [newRoom, setNewRoom] = useState<string>(() => {
    return existingOverride?.new_room || '';
  });

  const [customNote, setCustomNote] = useState<string>(() => {
    return existingOverride?.custom_note || '';
  });

  // Course selection for ad-hoc makeup classes
  const [makeupCourseId, setMakeupCourseId] = useState<string>(() => {
    return (
      paramCourseId ||
      baseBlock?.course_id ||
      (courses.length > 0 ? courses[0].id : '')
    );
  });

  // Makeup timing state
  const [makeupStartTime, setMakeupStartTime] = useState<string>(() => {
    return existingOverride?.makeup_start_time?.slice(0, 5) || '14:00';
  });
  const [makeupEndTime, setMakeupEndTime] = useState<string>(() => {
    return existingOverride?.makeup_end_time?.slice(0, 5) || '16:00';
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state if existing override changes
  useEffect(() => {
    if (existingOverride) {
      setStatus((existingOverride.status as ScheduleOverrideStatus) || 'scheduled');
      setDelayMinutes(existingOverride.delay_minutes || 0);
      setNewRoom(existingOverride.new_room || '');
      setCustomNote(existingOverride.custom_note || '');
      if (existingOverride.makeup_start_time) {
        setMakeupStartTime(existingOverride.makeup_start_time.slice(0, 5));
      }
      if (existingOverride.makeup_end_time) {
        setMakeupEndTime(existingOverride.makeup_end_time.slice(0, 5));
      }
    }
  }, [existingOverride]);

  // Room suggestions from store
  const roomSuggestions = useMemo(() => {
    const set = new Set<string>();
    baseSchedules.forEach((b) => {
      if (b.room?.trim()) set.add(b.room.trim());
    });
    return Array.from(set).slice(0, 6);
  }, [baseSchedules]);

  // Calculated effective times for delayed status
  const effectiveTimes = useMemo(() => {
    const rawStart = isMakeup ? makeupStartTime : baseBlock?.start_time || '09:00';
    const rawEnd = isMakeup ? makeupEndTime : baseBlock?.end_time || '10:30';

    if (status !== 'delayed' || delayMinutes <= 0) {
      return {
        startFormatted: formatTime12Hour(rawStart),
        endFormatted: formatTime12Hour(rawEnd),
        rawStart,
        rawEnd,
      };
    }

    const startMins = timeToMinutes(rawStart) + delayMinutes;
    const endMins = timeToMinutes(rawEnd) + delayMinutes;
    const newStartStr = minutesToTime(startMins);
    const newEndStr = minutesToTime(endMins);

    return {
      startFormatted: formatTime12Hour(newStartStr),
      endFormatted: formatTime12Hour(newEndStr),
      rawStart: newStartStr,
      rawEnd: newEndStr,
    };
  }, [isMakeup, makeupStartTime, makeupEndTime, baseBlock, status, delayMinutes]);

  // Course title resolution
  const courseDetails = useMemo(() => {
    const targetId = isMakeup ? makeupCourseId : baseBlock?.course_id;
    return courses.find((c) => c.id === targetId) ?? baseBlock?.course ?? null;
  }, [isMakeup, makeupCourseId, baseBlock, courses]);

  // Handle native DatePicker change
  const handleDateChange = (
    event: DateTimePickerEvent,
    date?: Date
  ) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && date) {
      setDatePickerValue(date);
      const dateStr = getLocalDateString(date, timezone);
      setSelectedDate(dateStr);
    }
  };

  // Submit exception override broadcast
  const handleBroadcast = async () => {
    if (!activeSectionId) {
      setErrorMessage('No active section found.');
      return;
    }

    const targetCourseId = isMakeup ? makeupCourseId : baseBlock?.course_id;
    if (!targetCourseId) {
      setErrorMessage('A course must be associated with this broadcast.');
      return;
    }

    setErrorMessage(null);

    try {
      await upsertOverride({
        id: existingOverride?.id,
        section_id: activeSectionId,
        course_id: targetCourseId,
        base_schedule_id: baseBlock ? baseBlock.id : null,
        override_date: selectedDate,
        status,
        delay_minutes: status === 'delayed' ? delayMinutes : 0,
        new_room: status === 'room_moved' ? newRoom.trim() || null : null,
        custom_note: customNote.trim() || null,
        is_makeup: isMakeup,
        makeup_start_time: isMakeup ? `${makeupStartTime}:00` : null,
        makeup_end_time: isMakeup ? `${makeupEndTime}:00` : null,
      });

      router.back();
    } catch (err: any) {
      console.error('[BroadcastException] Failed to broadcast override:', err);
      setErrorMessage(
        err?.message || 'Failed to broadcast exception. Please verify your connection.'
      );
    }
  };

  // Revert override back to normal scheduled status
  const handleRevert = async () => {
    if (!existingOverride) return;

    try {
      await deleteOverride(existingOverride.id);
      router.back();
    } catch (err: any) {
      console.error('[BroadcastException] Failed to revert override:', err);
      setErrorMessage(err?.message || 'Failed to revert exception.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F8F9FA]">
      {/* Header Bar */}
      <View className="px-5 py-3.5 flex-row items-center justify-between border-b border-neutral-200/60 bg-white">
        <View className="flex-row items-center space-x-2.5">
          <View className="w-9 h-9 rounded-2xl bg-amber-500/10 items-center justify-center border border-amber-500/20">
            <Radio size={18} color="#d97706" />
          </View>
          <View className="ml-2">
            <Text className="text-base font-black text-neutral-900 tracking-tight">
              {isMakeup ? 'Broadcast Makeup Class' : 'Live Status Broadcast'}
            </Text>
            <Text className="text-[11px] font-bold text-neutral-400">
              {courseDetails?.name || 'Class Exception Alert'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
          accessibilityLabel="Close"
        >
          <X size={18} color="#18181b" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-5 pt-4"
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Target Date Selector Card */}
          <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
            <View className="flex-row items-center justify-between mb-2.5">
              <View className="flex-row items-center space-x-1.5">
                <Calendar size={14} color="#71717a" />
                <Text className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider ml-1">
                  Active Exception Date
                </Text>
              </View>
              <Text className="text-xs font-mono font-bold text-neutral-900">
                {selectedDate}
              </Text>
            </View>

            {/* Quick Date Pills */}
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setSelectedDate(defaultToday)}
                className={`flex-1 py-2 rounded-full items-center justify-center border transition-all ${
                  selectedDate === defaultToday
                    ? 'bg-neutral-900 border-neutral-900 shadow-2xs'
                    : 'bg-neutral-50 border-neutral-200/80 active:bg-neutral-100'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedDate === defaultToday ? 'text-white' : 'text-neutral-700'
                  }`}
                >
                  Today
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedDate(defaultTomorrow)}
                className={`flex-1 py-2 rounded-full items-center justify-center border transition-all ${
                  selectedDate === defaultTomorrow
                    ? 'bg-neutral-900 border-neutral-900 shadow-2xs'
                    : 'bg-neutral-50 border-neutral-200/80 active:bg-neutral-100'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedDate === defaultTomorrow ? 'text-white' : 'text-neutral-700'
                  }`}
                >
                  Tomorrow
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="px-3.5 py-2 rounded-full bg-neutral-100 border border-neutral-200/80 items-center justify-center active:bg-neutral-200"
              >
                <Text className="text-xs font-bold text-neutral-800">Pick Date</Text>
              </Pressable>
            </View>

            {showDatePicker && (
              <View className="mt-3 items-center">
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={handleDateChange}
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    className="mt-2 py-1.5 px-4 bg-neutral-900 rounded-full"
                  >
                    <Text className="text-xs font-bold text-white">Done</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Session Overview Card */}
          {baseBlock && (
            <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  <Text className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                    {baseBlock.session_type}
                  </Text>
                </View>
                <Text className="text-[11px] font-bold text-neutral-400">
                  Recurring Base: {formatTime12Hour(baseBlock.start_time)} -{' '}
                  {formatTime12Hour(baseBlock.end_time)}
                </Text>
              </View>

              <Text className="text-base font-black text-neutral-900 tracking-tight">
                {courseDetails?.name || 'Class Session'}
              </Text>

              <View className="flex-row items-center space-x-3 mt-2">
                {baseBlock.room && (
                  <View className="flex-row items-center">
                    <MapPin size={12} color="#71717a" />
                    <Text className="text-xs font-bold text-neutral-600 ml-1">
                      {baseBlock.room}
                    </Text>
                  </View>
                )}
                {baseBlock.instructor && (
                  <View className="flex-row items-center ml-3">
                    <Text className="text-xs text-neutral-500 font-medium">
                      {baseBlock.instructor}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Course Selection (Only for Ad-Hoc Makeup) */}
          {isMakeup && (
            <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
              <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2.5">
                Select Course for Makeup
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-1">
                {courses.map((c) => {
                  const isSelected = makeupCourseId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setMakeupCourseId(c.id)}
                      className={`mx-1 px-3.5 py-2 rounded-full border transition-all ${
                        isSelected
                          ? 'bg-neutral-900 border-neutral-900'
                          : 'bg-neutral-50 border-neutral-200/80 active:bg-neutral-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-neutral-700'
                        }`}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Makeup Start / End Time Inputs */}
              <View className="flex-row items-center gap-3 mt-4 pt-3 border-t border-neutral-100">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-neutral-400 uppercase mb-1">
                    Start Time
                  </Text>
                  <TextInput
                    value={makeupStartTime}
                    onChangeText={setMakeupStartTime}
                    placeholder="14:00"
                    placeholderTextColor="#a1a1aa"
                    className="bg-neutral-50 border border-neutral-200/80 rounded-2xl px-3 py-2 text-xs font-mono font-bold text-neutral-900"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-neutral-400 uppercase mb-1">
                    End Time
                  </Text>
                  <TextInput
                    value={makeupEndTime}
                    onChangeText={setMakeupEndTime}
                    placeholder="16:00"
                    placeholderTextColor="#a1a1aa"
                    className="bg-neutral-50 border border-neutral-200/80 rounded-2xl px-3 py-2 text-xs font-mono font-bold text-neutral-900"
                  />
                </View>
              </View>
            </View>
          )}

          {/* 1. Status Broadcast 2-Tap Selector */}
          <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
            <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-3">
              1. Select Status Exception
            </Text>

            <View className="gap-2">
              {/* Delayed */}
              <Pressable
                onPress={() => setStatus('delayed')}
                className={`p-3.5 rounded-2xl border flex-row items-center justify-between transition-all ${
                  status === 'delayed'
                    ? 'bg-amber-50/80 border-amber-300 shadow-2xs'
                    : 'bg-white border-neutral-200/70 active:bg-neutral-50'
                }`}
              >
                <View className="flex-row items-center space-x-3">
                  <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center">
                    <Clock size={16} color="#d97706" />
                  </View>
                  <View className="ml-2.5">
                    <Text className="text-sm font-bold text-neutral-900">
                      Delayed Class
                    </Text>
                    <Text className="text-[11px] text-neutral-500">
                      Pushes start and end times by specified minutes
                    </Text>
                  </View>
                </View>
                <View
                  className={`w-5 h-5 rounded-full border items-center justify-center ${
                    status === 'delayed'
                      ? 'bg-amber-500 border-amber-500'
                      : 'border-neutral-300'
                  }`}
                >
                  {status === 'delayed' && <Check size={12} color="#ffffff" />}
                </View>
              </Pressable>

              {/* Room Moved */}
              <Pressable
                onPress={() => setStatus('room_moved')}
                className={`p-3.5 rounded-2xl border flex-row items-center justify-between transition-all ${
                  status === 'room_moved'
                    ? 'bg-purple-50/80 border-purple-300 shadow-2xs'
                    : 'bg-white border-neutral-200/70 active:bg-neutral-50'
                }`}
              >
                <View className="flex-row items-center space-x-3">
                  <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center">
                    <MapPin size={16} color="#7c3aed" />
                  </View>
                  <View className="ml-2.5">
                    <Text className="text-sm font-bold text-neutral-900">
                      Room Moved
                    </Text>
                    <Text className="text-[11px] text-neutral-500">
                      Notifies students of venue/hall reallocation
                    </Text>
                  </View>
                </View>
                <View
                  className={`w-5 h-5 rounded-full border items-center justify-center ${
                    status === 'room_moved'
                      ? 'bg-purple-600 border-purple-600'
                      : 'border-neutral-300'
                  }`}
                >
                  {status === 'room_moved' && <Check size={12} color="#ffffff" />}
                </View>
              </Pressable>

              {/* Cancelled */}
              <Pressable
                onPress={() => setStatus('cancelled')}
                className={`p-3.5 rounded-2xl border flex-row items-center justify-between transition-all ${
                  status === 'cancelled'
                    ? 'bg-rose-50/80 border-rose-300 shadow-2xs'
                    : 'bg-white border-neutral-200/70 active:bg-neutral-50'
                }`}
              >
                <View className="flex-row items-center space-x-3">
                  <View className="w-8 h-8 rounded-full bg-rose-100 items-center justify-center">
                    <AlertTriangle size={16} color="#e11d48" />
                  </View>
                  <View className="ml-2.5">
                    <Text className="text-sm font-bold text-neutral-900">
                      Class Cancelled
                    </Text>
                    <Text className="text-[11px] text-neutral-500">
                      Marks class as cancelled for this date
                    </Text>
                  </View>
                </View>
                <View
                  className={`w-5 h-5 rounded-full border items-center justify-center ${
                    status === 'cancelled'
                      ? 'bg-rose-500 border-rose-500'
                      : 'border-neutral-300'
                  }`}
                >
                  {status === 'cancelled' && <Check size={12} color="#ffffff" />}
                </View>
              </Pressable>

              {/* Scheduled (Normal) */}
              <Pressable
                onPress={() => setStatus('scheduled')}
                className={`p-3.5 rounded-2xl border flex-row items-center justify-between transition-all ${
                  status === 'scheduled'
                    ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
                    : 'bg-white border-neutral-200/70 active:bg-neutral-50'
                }`}
              >
                <View className="flex-row items-center space-x-3">
                  <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
                    <Check size={16} color="#059669" />
                  </View>
                  <View className="ml-2.5">
                    <Text className="text-sm font-bold text-neutral-900">
                      Running as Scheduled
                    </Text>
                    <Text className="text-[11px] text-neutral-500">
                      On time at original room location
                    </Text>
                  </View>
                </View>
                <View
                  className={`w-5 h-5 rounded-full border items-center justify-center ${
                    status === 'scheduled'
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'border-neutral-300'
                  }`}
                >
                  {status === 'scheduled' && <Check size={12} color="#ffffff" />}
                </View>
              </Pressable>
            </View>
          </View>

          {/* 2. Delay Details (Conditional if status === 'delayed') */}
          {status === 'delayed' && (
            <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
              <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2.5">
                2. Delay Duration
              </Text>

              {/* Preset Delay Pills */}
              <View className="flex-row flex-wrap gap-2 mb-3">
                {DELAY_PRESETS.map((p) => {
                  const isSelected = delayMinutes === p.minutes;
                  return (
                    <Pressable
                      key={p.minutes}
                      onPress={() => setDelayMinutes(p.minutes)}
                      className={`px-3.5 py-2 rounded-full border transition-all ${
                        isSelected
                          ? 'bg-amber-500 border-amber-500 shadow-2xs'
                          : 'bg-neutral-50 border-neutral-200/80 active:bg-neutral-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-neutral-700'
                        }`}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Real-time Calculated Times Banner */}
              <View className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-2xl flex-row items-center justify-between">
                <View className="flex-row items-center space-x-2">
                  <Clock size={16} color="#d97706" />
                  <Text className="text-xs font-bold text-amber-900 ml-1.5">
                    New Time Window:
                  </Text>
                </View>
                <Text className="text-xs font-mono font-black text-amber-950">
                  {effectiveTimes.startFormatted} - {effectiveTimes.endFormatted}
                </Text>
              </View>
            </View>
          )}

          {/* 3. Room Moved Details (Conditional if status === 'room_moved') */}
          {status === 'room_moved' && (
            <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
              <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                2. New Room / Venue
              </Text>
              <View className="flex-row items-center bg-neutral-50 border border-neutral-200/80 rounded-2xl px-3.5 py-2.5 mb-2.5">
                <MapPin size={16} color="#71717a" className="mr-2" />
                <TextInput
                  value={newRoom}
                  onChangeText={setNewRoom}
                  placeholder="e.g. Auditorium Hall 2, Room 405"
                  placeholderTextColor="#a1a1aa"
                  className="flex-1 text-sm font-bold text-neutral-900 ml-1.5"
                />
              </View>

              {roomSuggestions.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5">
                  {roomSuggestions.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setNewRoom(r)}
                      className="bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200/70 active:bg-neutral-200"
                    >
                      <Text className="text-[11px] font-bold text-neutral-600">
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 4. Announcement Note (Optional) */}
          <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
            <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Announcement Note (Optional)
            </Text>
            <TextInput
              value={customNote}
              onChangeText={setCustomNote}
              placeholder="e.g. Please bring laptops for the practical demo"
              placeholderTextColor="#a1a1aa"
              multiline
              numberOfLines={2}
              className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-3 text-xs font-medium text-neutral-900 mb-2.5"
            />

            {/* Quick Note Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-1">
              {NOTE_PRESETS.map((note) => (
                <Pressable
                  key={note}
                  onPress={() => setCustomNote(note)}
                  className="mx-1 bg-neutral-100 px-3 py-1.5 rounded-full border border-neutral-200/70 active:bg-neutral-200"
                >
                  <Text className="text-[10px] font-bold text-neutral-600">
                    {note}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex-row items-center mb-4">
              <AlertTriangle size={16} color="#e11d48" />
              <Text className="text-xs font-bold text-rose-700 ml-2 flex-1">
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Revert Button if an override already existed */}
          {existingOverride && (
            <Pressable
              onPress={handleRevert}
              disabled={isDeleting}
              className="mb-4 py-3 rounded-full bg-neutral-100 border border-neutral-200/80 flex-row items-center justify-center space-x-2 active:bg-neutral-200"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#52525b" />
              ) : (
                <>
                  <RotateCcw size={14} color="#52525b" />
                  <Text className="text-xs font-bold text-neutral-700 ml-1.5">
                    Revert to Default Schedule
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </ScrollView>

        {/* Bottom Save / Broadcast Bar */}
        <View className="px-5 py-3.5 border-t border-neutral-200/60 bg-white">
          <Pressable
            onPress={handleBroadcast}
            disabled={isUpserting}
            className={`w-full py-4 rounded-full items-center justify-center flex-row space-x-2 shadow-md ${
              isUpserting
                ? 'bg-neutral-400'
                : 'bg-neutral-900 active:bg-neutral-800 shadow-neutral-900/15'
            }`}
          >
            {isUpserting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Send size={16} color="#ffffff" strokeWidth={2.5} />
                <Text className="text-white text-sm font-bold tracking-wide ml-2">
                  Broadcast Update
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
