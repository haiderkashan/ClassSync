import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  X,
  BookOpen,
  FlaskConical,
  Coffee,
  Heart,
  Users,
  GraduationCap,
  Calendar,
  Check,
  Clock,
  ArrowRight,
  MapPin,
  User,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Sparkles,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import { useBaseSchedule } from '@/hooks/useBaseSchedule';
import {
  getDayName,
  formatTime12Hour,
  calculateDurationMinutes,
  formatDuration,
  addMinutesToTime,
  isValidTimeRange,
} from '@/lib/schedule/timeUtils';
import {
  detectScheduleConflicts,
  type ScheduleBlockInterval,
} from '@/lib/schedule/conflictDetector';
import type { CourseRow } from '@/store/useAppStore';

const SESSION_TYPES = [
  { id: 'lecture', label: 'Lecture', icon: BookOpen },
  { id: 'lab', label: 'Practical Lab', icon: FlaskConical },
  { id: 'tutorial', label: 'Tutorial', icon: GraduationCap },
  { id: 'seminar', label: 'Seminar', icon: GraduationCap },
  { id: 'break', label: 'Break', icon: Coffee },
  { id: 'prayer', label: 'Prayer', icon: Heart },
  { id: 'meeting', label: 'Meeting', icon: Users },
];

const DAYS_GRID = [
  { id: 1, label: 'MON' },
  { id: 2, label: 'TUE' },
  { id: 3, label: 'WED' },
  { id: 4, label: 'THU' },
  { id: 5, label: 'FRI' },
  { id: 6, label: 'SAT' },
  { id: 7, label: 'SUN' },
];

const FREQUENCIES = [
  { id: 'weekly', label: 'Weekly (All)' },
  { id: 'biweekly_week_a', label: 'Week A Only' },
  { id: 'biweekly_week_b', label: 'Week B Only' },
];

const DURATION_PRESETS = [
  { label: '+50m', minutes: 50 },
  { label: '+60m', minutes: 60 },
  { label: '+90m', minutes: 90 },
  { label: '+120m', minutes: 120 },
  { label: '+180m', minutes: 180 },
];

export default function EditBlockModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; id?: string }>();
  const { courses, activeSection } = useWorkspaces();
  const { baseSchedules } = useAppStore();
  const { upsertBlock, isUpserting, deleteBlock, isDeleting } = useBaseSchedule();

  // Find existing block if editing
  const existingBlock = useMemo(() => {
    if (!params.id) return null;
    return baseSchedules.find((b) => b.id === params.id) || null;
  }, [params.id, baseSchedules]);

  const initialDay = params.day
    ? parseInt(params.day, 10)
    : existingBlock?.day_of_week ?? 1;

  const [dayOfWeek, setDayOfWeek] = useState<number>(initialDay);
  const [sessionType, setSessionType] = useState<string>(
    existingBlock?.session_type ?? 'lecture'
  );
  const [frequency, setFrequency] = useState<string>(
    existingBlock?.frequency ?? 'weekly'
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    existingBlock?.course_id ?? (courses.length > 0 ? courses[0].id : null)
  );

  // Time inputs and presets
  const [startTime, setStartTime] = useState<string>(
    existingBlock ? existingBlock.start_time.slice(0, 5) : '09:00'
  );
  const [endTime, setEndTime] = useState<string>(
    existingBlock ? existingBlock.end_time.slice(0, 5) : '10:30'
  );
  const [selectedPreset, setSelectedPreset] = useState<number | null>(() => {
    if (existingBlock) {
      const dur = calculateDurationMinutes(
        existingBlock.start_time.slice(0, 5),
        existingBlock.end_time.slice(0, 5)
      );
      const match = DURATION_PRESETS.find((p) => p.minutes === dur);
      return match ? match.minutes : null;
    }
    return 90;
  });

  // Room and instructor inputs
  const [room, setRoom] = useState<string>(existingBlock?.room ?? '');
  const [instructor, setInstructor] = useState<string>(
    existingBlock?.instructor ?? ''
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Determine if general session
  const isGeneralSession =
    sessionType === 'break' || sessionType === 'prayer' || sessionType === 'meeting';

  // Calculate duration dynamically
  const durationMinutes = calculateDurationMinutes(startTime, endTime);
  const durationLabel = formatDuration(durationMinutes);

  // Historical suggestions
  const roomSuggestions = useMemo(() => {
    const set = new Set<string>();
    baseSchedules.forEach((b) => {
      if (b.room?.trim()) set.add(b.room.trim());
    });
    return Array.from(set).slice(0, 4);
  }, [baseSchedules]);

  const instructorSuggestions = useMemo(() => {
    const set = new Set<string>();
    baseSchedules.forEach((b) => {
      if (b.instructor?.trim()) set.add(b.instructor.trim());
    });
    return Array.from(set).slice(0, 4);
  }, [baseSchedules]);

  // Real-time conflict detection
  const conflictResult = useMemo(() => {
    const selectedCourse = courses.find((c) => c.id === selectedCourseId);
    const candidate: ScheduleBlockInterval = {
      id: params.id,
      courseId: selectedCourseId || undefined,
      courseTitle:
        selectedCourse?.name ||
        (isGeneralSession ? sessionType.toUpperCase() : 'New Session'),
      courseCode: selectedCourse?.code || undefined,
      dayOfWeek,
      startTime,
      endTime,
      frequency,
      room: room.trim() || null,
      sessionType,
    };

    const existingIntervals: ScheduleBlockInterval[] = baseSchedules.map((b) => ({
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

    return detectScheduleConflicts(candidate, existingIntervals);
  }, [
    params.id,
    selectedCourseId,
    courses,
    isGeneralSession,
    sessionType,
    dayOfWeek,
    startTime,
    endTime,
    frequency,
    room,
    baseSchedules,
  ]);

  const handleSelectPreset = (presetMinutes: number | null) => {
    setSelectedPreset(presetMinutes);
    if (presetMinutes !== null && startTime) {
      const computedEnd = addMinutesToTime(startTime, presetMinutes);
      setEndTime(computedEnd);
    }
  };

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    if (selectedPreset !== null && newStart.length === 5) {
      const computedEnd = addMinutesToTime(newStart, selectedPreset);
      setEndTime(computedEnd);
    }
  };

  const handleEndTimeChange = (newEnd: string) => {
    setEndTime(newEnd);
    setSelectedPreset(null);
  };

  const handleSave = async () => {
    setErrorMessage(null);

    if (!isValidTimeRange(startTime, endTime)) {
      setErrorMessage('End time must be strictly after start time.');
      return;
    }

    let targetCourseId = selectedCourseId;
    if (isGeneralSession && !targetCourseId) {
      if (courses.length > 0) {
        targetCourseId = courses[0].id;
      } else {
        setErrorMessage(
          'Cannot schedule session: cohort must have at least one registered course.'
        );
        return;
      }
    }

    if (!targetCourseId) {
      setErrorMessage('Please select a course for this academic session.');
      return;
    }

    try {
      await upsertBlock({
        id: params.id,
        course_id: targetCourseId,
        day_of_week: dayOfWeek,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        room: room.trim() || null,
        instructor: instructor.trim() || null,
        session_type: sessionType,
        frequency,
      });

      router.back();
    } catch (err: any) {
      console.error('[EditBlockModal] Failed to save block:', err);
      setErrorMessage(
        err?.message || 'Failed to save timetable block. Please check your inputs.'
      );
    }
  };

  const handleDelete = () => {
    if (!params.id) return;
    Alert.alert(
      'Delete Schedule Block',
      'Are you sure you want to delete this schedule block? This will permanently remove it from the cohort timetable.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBlock(params.id!);
              router.back();
            } catch (err: any) {
              console.error('[EditBlockModal] Failed to delete block:', err);
              setErrorMessage(err?.message || 'Failed to delete block.');
            }
          },
        },
      ]
    );
  };

  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'bottom', 'left', 'right']}>
      {/* 1. Modal Top Header & Grab Handle */}
      <View className="px-5 pt-2 pb-3 bg-white border-b border-neutral-200/80">
        <View className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-3" />
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-lg font-black text-neutral-900 tracking-tight">
              {params.id ? 'Edit Schedule Block' : 'New Schedule Block'}
            </Text>
            <View className="flex-row items-center space-x-1.5 mt-0.5">
              <Text className="text-xs font-bold text-neutral-900 font-mono">
                {activeCourse?.code || (isGeneralSession ? 'COHORT' : 'COURSE')}
              </Text>
              <Text className="text-xs text-neutral-400">•</Text>
              <Text className="text-xs text-neutral-500 font-semibold" numberOfLines={1}>
                {activeSection?.name || 'Cohort'} • {getDayName(dayOfWeek)}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-neutral-100 border border-neutral-200/80 items-center justify-center active:bg-neutral-200"
            accessibilityLabel="Close modal"
          >
            <X size={18} color="#18181B" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 130 }}
        >
          {/* Error Message Alert */}
          {errorMessage && (
            <View className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex-row items-center space-x-2">
              <AlertCircle size={16} color="#E11D48" />
              <Text className="text-xs text-rose-700 font-bold flex-1 ml-1.5">
                {errorMessage}
              </Text>
            </View>
          )}

          {/* 2. Course Selection Section */}
          <View className="mb-5">
            <View className="flex-row items-center justify-between px-1 mb-2">
              <Text className="text-[11px] font-black tracking-wider text-neutral-400 uppercase">
                Course Selection
              </Text>
            </View>

            {isGeneralSession ? (
              <View className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex-row items-center space-x-2.5">
                <Coffee size={18} color="#D97706" />
                <View className="flex-1 ml-1.5">
                  <Text className="text-xs font-black text-amber-950">
                    Cohort-Wide Event
                  </Text>
                  <Text className="text-[11px] text-amber-800 mt-0.5 font-medium leading-relaxed">
                    Breaks, prayers, and common meetings automatically apply to all students.
                  </Text>
                </View>
              </View>
            ) : courses.length === 0 ? (
              <View className="p-4 rounded-2xl bg-neutral-100 border border-neutral-200">
                <Text className="text-xs text-neutral-600 font-medium">
                  No courses found in this section. Please register courses in Settings first.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 flex-row py-1">
                {courses.map((course: CourseRow) => {
                  const isSelected = selectedCourseId === course.id;
                  const color = course.color_hex || '#FACC15';

                  return (
                    <Pressable
                      key={course.id}
                      onPress={() => setSelectedCourseId(course.id)}
                      className={`mr-2.5 px-4 py-3 rounded-2xl border min-w-[200px] flex-col justify-between transition-all ${
                        isSelected
                          ? 'bg-[#FACC15]/10 border-[#EAB308] shadow-xs'
                          : 'bg-white border-neutral-200/80 active:bg-neutral-50'
                      }`}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                          <Text className="text-[10px] font-black font-mono text-neutral-800">
                            {course.code || 'COURSE'}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View className="w-5 h-5 rounded-full bg-[#FACC15] items-center justify-center">
                            <Check size={12} color="#18181B" strokeWidth={3} />
                          </View>
                        ) : (
                          <View
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        )}
                      </View>

                      <View>
                        <Text className="text-xs font-black text-neutral-900" numberOfLines={1}>
                          {course.name}
                        </Text>
                        <View className="flex-row items-center space-x-1 mt-1">
                          <View
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: isSelected ? '#18181B' : '#A1A1AA' }}
                          />
                          <Text className="text-[10px] font-semibold text-neutral-500">
                            {isSelected ? 'Selected Course' : 'Tap to Select'}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* 3. Day of Week & Time Slot Configuration */}
          <View className="mb-5 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
            <View className="flex-row items-center justify-between mb-2.5">
              <Text className="text-[11px] font-black tracking-wider text-neutral-400 uppercase">
                Day of Week
              </Text>
              <Text className="text-[11px] font-black text-neutral-900">
                {getDayName(dayOfWeek)}
              </Text>
            </View>

            {/* Day Selector Buttons Grid */}
            <View className="flex-row justify-between mb-4">
              {DAYS_GRID.map((d) => {
                const isSelected = dayOfWeek === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setDayOfWeek(d.id)}
                    className={`flex-1 mx-0.5 py-2.5 rounded-xl items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-[#FACC15] border-[#EAB308] shadow-2xs'
                        : 'bg-neutral-50 border-neutral-200/80 active:bg-neutral-100'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-black ${
                        isSelected ? 'text-neutral-950' : 'text-neutral-600'
                      }`}
                    >
                      {d.label}
                    </Text>
                    {isSelected && (
                      <View className="w-1 h-1 rounded-full bg-neutral-950 mt-1" />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Time Slot Picker */}
            <View className="pt-2 border-t border-neutral-100">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[11px] font-black tracking-wider text-neutral-400 uppercase">
                  Time Slot Window
                </Text>
                {durationMinutes > 0 && (
                  <View className="bg-neutral-100 px-2.5 py-0.5 rounded-full border border-neutral-200 flex-row items-center space-x-1">
                    <Clock size={11} color="#18181B" />
                    <Text className="text-[10px] font-black text-neutral-900 ml-1">
                      {durationLabel} Duration
                    </Text>
                  </View>
                )}
              </View>

              {/* Start Time & End Time Dual Cards */}
              <View className="flex-row items-center space-x-2">
                {/* Start Time */}
                <View className="flex-1 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/90">
                  <Text className="text-[10px] font-extrabold text-neutral-400 uppercase mb-1">
                    START TIME
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <TextInput
                      value={startTime}
                      onChangeText={handleStartTimeChange}
                      placeholder="09:00"
                      placeholderTextColor="#A1A1AA"
                      className="text-base font-black font-mono text-neutral-900 p-0 flex-1"
                      maxLength={5}
                    />
                    <Text className="text-[11px] font-bold text-neutral-400">
                      {formatTime12Hour(startTime)}
                    </Text>
                  </View>
                </View>

                {/* Arrow Divider */}
                <View className="w-7 h-7 rounded-full bg-neutral-100 items-center justify-center">
                  <ArrowRight size={14} color="#71717A" />
                </View>

                {/* End Time */}
                <View className="flex-1 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/90">
                  <Text className="text-[10px] font-extrabold text-neutral-400 uppercase mb-1">
                    END TIME
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <TextInput
                      value={endTime}
                      onChangeText={handleEndTimeChange}
                      placeholder="10:30"
                      placeholderTextColor="#A1A1AA"
                      className="text-base font-black font-mono text-neutral-900 p-0 flex-1"
                      maxLength={5}
                    />
                    <Text className="text-[11px] font-bold text-neutral-400">
                      {formatTime12Hour(endTime)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Duration Presets */}
              <View className="flex-row flex-wrap gap-1.5 mt-3">
                {DURATION_PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.minutes;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => handleSelectPreset(preset.minutes)}
                      className={`px-3 py-1.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-neutral-900 border-neutral-900 shadow-2xs'
                          : 'bg-white border-neutral-200/80 active:bg-neutral-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-neutral-700'
                        }`}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 4. Recurrence Frequency */}
          <View className="mb-5">
            <Text className="text-[11px] font-black tracking-wider text-neutral-400 uppercase px-1 mb-2">
              Recurrence Frequency
            </Text>
            <View className="p-1 rounded-2xl bg-neutral-200/60 flex-row">
              {FREQUENCIES.map((freq) => {
                const isSelected = frequency === freq.id;
                return (
                  <Pressable
                    key={freq.id}
                    onPress={() => setFrequency(freq.id)}
                    className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row space-x-1.5 transition-all ${
                      isSelected
                        ? 'bg-white shadow-2xs border border-neutral-200/60'
                        : 'active:bg-neutral-200'
                    }`}
                  >
                    {isSelected && (
                      <View className="w-1.5 h-1.5 rounded-full bg-[#FACC15] mr-1" />
                    )}
                    <Text
                      className={`text-xs font-black ${
                        isSelected ? 'text-neutral-950' : 'text-neutral-600'
                      }`}
                    >
                      {freq.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 5. Session Type / Category */}
          <View className="mb-5">
            <Text className="text-[11px] font-black tracking-wider text-neutral-400 uppercase px-1 mb-2">
              Session Category
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 flex-row py-1">
              {SESSION_TYPES.map((type) => {
                const isSelected = sessionType === type.id;
                const IconComponent = type.icon;

                return (
                  <Pressable
                    key={type.id}
                    onPress={() => {
                      setSessionType(type.id);
                      if (type.id === 'break' || type.id === 'prayer' || type.id === 'meeting') {
                        setSelectedCourseId(null);
                      } else if (!selectedCourseId && courses.length > 0) {
                        setSelectedCourseId(courses[0].id);
                      }
                    }}
                    className={`mr-2 px-3.5 py-2.5 rounded-2xl flex-row items-center space-x-1.5 border transition-all ${
                      isSelected
                        ? 'bg-neutral-900 border-neutral-900 shadow-2xs'
                        : 'bg-white border-neutral-200/80 active:bg-neutral-100'
                    }`}
                  >
                    <IconComponent
                      size={14}
                      color={isSelected ? '#FACC15' : '#71717A'}
                      strokeWidth={2}
                    />
                    <Text
                      className={`text-xs font-bold ml-1 ${
                        isSelected ? 'text-white' : 'text-neutral-800'
                      }`}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 6. Location & Faculty Details */}
          <View className="mb-5 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-4">
            <Text className="text-[11px] font-black tracking-wider text-neutral-400 uppercase">
              Location & Faculty Details
            </Text>

            {/* Room / Hall */}
            <View>
              <Text className="text-[10px] font-extrabold text-neutral-400 uppercase mb-1.5">
                ROOM / HALL (OPTIONAL)
              </Text>
              <View className="flex-row items-center bg-neutral-50 border border-neutral-200/90 rounded-2xl px-3.5 py-2.5">
                <MapPin size={16} color="#71717A" />
                <TextInput
                  value={room}
                  onChangeText={setRoom}
                  placeholder="e.g. LH-102 (Lecture Hall 1)"
                  placeholderTextColor="#A1A1AA"
                  className="flex-1 text-sm font-bold text-neutral-900 ml-2"
                />
              </View>
              {roomSuggestions.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 mt-2">
                  {roomSuggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setRoom(s)}
                      className="bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 active:bg-neutral-200"
                    >
                      <Text className="text-[10px] font-bold text-neutral-600">
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Instructor */}
            <View className="pt-2 border-t border-neutral-100">
              <Text className="text-[10px] font-extrabold text-neutral-400 uppercase mb-1.5">
                INSTRUCTOR / FACULTY (OPTIONAL)
              </Text>
              <View className="flex-row items-center bg-neutral-50 border border-neutral-200/90 rounded-2xl px-3.5 py-2.5">
                <User size={16} color="#71717A" />
                <TextInput
                  value={instructor}
                  onChangeText={setInstructor}
                  placeholder="e.g. Dr. Jane Smith"
                  placeholderTextColor="#A1A1AA"
                  className="flex-1 text-sm font-bold text-neutral-900 ml-2"
                />
              </View>
              {instructorSuggestions.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 mt-2">
                  {instructorSuggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setInstructor(s)}
                      className="bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 active:bg-neutral-200"
                    >
                      <Text className="text-[10px] font-bold text-neutral-600">
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* 7. Real-Time Soft Clash Warning */}
          {conflictResult.hasConflict && (
            <View className="p-4 rounded-3xl bg-amber-50/90 border border-amber-300 mb-6 shadow-2xs">
              <View className="flex-row items-center space-x-2 mb-1.5">
                <AlertTriangle size={16} color="#B45309" strokeWidth={2.5} />
                <Text className="text-xs font-black text-amber-950 uppercase tracking-tight ml-1">
                  Soft Clash Detected (Override Allowed)
                </Text>
              </View>
              {conflictResult.conflicts.map((conflict, idx) => (
                <Text key={idx} className="text-xs text-amber-900 leading-relaxed font-semibold">
                  • {conflict.message}
                </Text>
              ))}
              <Text className="text-[10px] text-amber-800 mt-1.5 font-medium">
                You can still save this session if your section runs parallel lab groups or electives.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* 8. Bottom Action Footer */}
        <View className="absolute bottom-0 inset-x-0 bg-white/95 border-t border-neutral-200/80 px-4 pt-3 pb-6 shadow-lg">
          <Pressable
            onPress={handleSave}
            disabled={isUpserting}
            className={`w-full py-4 rounded-2xl items-center justify-center flex-row space-x-2 shadow-sm ${
              isUpserting
                ? 'bg-neutral-300'
                : 'bg-[#FACC15] active:bg-yellow-400'
            }`}
          >
            {isUpserting ? (
              <ActivityIndicator size="small" color="#18181B" />
            ) : (
              <>
                <Check size={18} color="#18181B" strokeWidth={2.5} />
                <Text className="text-neutral-950 text-sm font-black tracking-wide ml-1.5">
                  {params.id ? 'Save Schedule Block' : 'Add to Timetable'}
                </Text>
              </>
            )}
          </Pressable>

          {params.id && (
            <Pressable
              onPress={handleDelete}
              disabled={isDeleting}
              className="w-full py-2.5 mt-1.5 items-center justify-center flex-row space-x-1.5 active:bg-rose-50 rounded-xl"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#E11D48" />
              ) : (
                <>
                  <Trash2 size={15} color="#E11D48" />
                  <Text className="text-xs font-bold text-rose-600 ml-1">
                    Delete Class Block
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
