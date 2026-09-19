import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
  ChevronDown,
  Clock,
  ArrowRight,
  MapPin,
  User,
  AlertTriangle,
  Sparkles,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import {
  getDayName,
  formatTime12Hour,
  calculateDurationMinutes,
  formatDuration,
  addMinutesToTime,
} from '@/lib/schedule/timeUtils';
import {
  detectScheduleConflicts,
  type ScheduleBlockInterval,
} from '@/lib/schedule/conflictDetector';
import type { CourseRow } from '@/store/useAppStore';

const SESSION_TYPES = [
  { id: 'lecture', label: 'Lecture', icon: BookOpen, color: '#4f46e5' },
  { id: 'lab', label: 'Lab', icon: FlaskConical, color: '#059669' },
  { id: 'break', label: 'Break', icon: Coffee, color: '#d97706' },
  { id: 'prayer', label: 'Prayer', icon: Heart, color: '#0d9488' },
  { id: 'meeting', label: 'Meeting', icon: Users, color: '#475569' },
  { id: 'tutorial', label: 'Tutorial', icon: GraduationCap, color: '#9333ea' },
  { id: 'seminar', label: 'Seminar', icon: GraduationCap, color: '#e11d48' },
];

const FREQUENCIES = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly_week_a', label: 'Week A Only' },
  { id: 'biweekly_week_b', label: 'Week B Only' },
];

const DURATION_PRESETS = [
  { label: '+50m', minutes: 50 },
  { label: '+60m', minutes: 60 },
  { label: '+90m', minutes: 90 },
  { label: '+120m', minutes: 120 },
  { label: '+180m', minutes: 180 },
  { label: 'Custom', minutes: null },
];

export default function EditBlockModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; id?: string }>();
  const { courses, activeSection } = useWorkspaces();
  const { baseSchedules } = useAppStore();

  const initialDay = params.day ? parseInt(params.day, 10) : 1;
  const [dayOfWeek, setDayOfWeek] = useState<number>(initialDay);
  const [sessionType, setSessionType] = useState<string>('lecture');
  const [frequency, setFrequency] = useState<string>('weekly');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    courses.length > 0 ? courses[0].id : null
  );

  // Time and dynamic duration presets
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('10:30');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(90);

  // Room and instructor inputs
  const [room, setRoom] = useState<string>('');
  const [instructor, setInstructor] = useState<string>('');

  // Determine if this session type requires a course association
  const isGeneralSession = sessionType === 'break' || sessionType === 'prayer' || sessionType === 'meeting';

  // Calculate duration dynamically
  const durationMinutes = calculateDurationMinutes(startTime, endTime);
  const durationLabel = formatDuration(durationMinutes);

  // Derive unique historical room & instructor suggestions from Zustand store
  const roomSuggestions = useMemo(() => {
    const set = new Set<string>();
    baseSchedules.forEach((b) => {
      if (b.room?.trim()) set.add(b.room.trim());
    });
    return Array.from(set).slice(0, 5);
  }, [baseSchedules]);

  const instructorSuggestions = useMemo(() => {
    const set = new Set<string>();
    baseSchedules.forEach((b) => {
      if (b.instructor?.trim()) set.add(b.instructor.trim());
    });
    return Array.from(set).slice(0, 5);
  }, [baseSchedules]);

  // Real-time conflict detection against local Zustand store
  const conflictResult = useMemo(() => {
    const selectedCourse = courses.find((c) => c.id === selectedCourseId);
    const candidate: ScheduleBlockInterval = {
      id: params.id,
      courseId: selectedCourseId || undefined,
      courseTitle: selectedCourse?.name || (isGeneralSession ? sessionType.toUpperCase() : 'New Session'),
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

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Modal Header */}
      <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-extrabold text-gray-900 tracking-tight">
            New Timetable Block
          </Text>
          <Text className="text-xs text-gray-500 font-medium">
            {activeSection?.name || 'Cohort'} • {getDayName(dayOfWeek)}
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
          accessibilityLabel="Close"
        >
          <X size={18} color="#374151" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 80 }}>
          {/* 1. Session Type Selector */}
          <View className="mb-5">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
              Session Type
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 flex-row">
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
                    className={`mx-1 px-3.5 py-2.5 rounded-2xl flex-row items-center space-x-2 border transition-all ${
                      isSelected
                        ? 'bg-brand-600 border-brand-700 shadow-sm shadow-brand-500/20'
                        : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                    }`}
                  >
                    <IconComponent
                      size={15}
                      color={isSelected ? '#ffffff' : type.color}
                      strokeWidth={2}
                    />
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-white' : 'text-gray-800'
                      }`}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 2. Frequency Segmented Control */}
          <View className="mb-5">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Recurrence Frequency
            </Text>
            <View className="flex-row p-1 bg-gray-100 rounded-2xl">
              {FREQUENCIES.map((freq) => {
                const isSelected = frequency === freq.id;
                return (
                  <Pressable
                    key={freq.id}
                    onPress={() => setFrequency(freq.id)}
                    className={`flex-1 py-2 rounded-xl items-center justify-center transition-all ${
                      isSelected ? 'bg-white shadow-xs' : 'active:bg-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-brand-700' : 'text-gray-600'
                      }`}
                    >
                      {freq.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 3. Conditional Course Selection Field */}
          <View className="mb-5">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Course / Subject
            </Text>

            {isGeneralSession ? (
              /* Informative Banner when Course is Not Applicable */
              <View className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex-row items-center space-x-2.5">
                <Coffee size={18} color="#d97706" />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-amber-900">
                    Cohort-Wide Activity
                  </Text>
                  <Text className="text-[11px] text-amber-700 mt-0.5">
                    Breaks, prayers, and meetings apply to all students without course binding.
                  </Text>
                </View>
              </View>
            ) : courses.length === 0 ? (
              /* No Courses Warning */
              <View className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                <Text className="text-xs text-gray-600">
                  No courses found in this section. Please add a course first before scheduling lectures or labs.
                </Text>
              </View>
            ) : (
              /* Course Picker Radio List */
              <View className="space-y-2">
                {courses.map((course: CourseRow) => {
                  const isSelected = selectedCourseId === course.id;
                  const color = course.color_hex || '#4F46E5';

                  return (
                    <Pressable
                      key={course.id}
                      onPress={() => setSelectedCourseId(course.id)}
                      className={`p-3 rounded-2xl border flex-row items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-brand-50/50 border-brand-500'
                          : 'bg-white border-gray-200 active:bg-gray-50'
                      }`}
                    >
                      <View className="flex-row items-center space-x-3 flex-1 mr-2">
                        <View
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                            {course.name}
                          </Text>
                          {course.code && (
                            <Text className="text-[11px] text-gray-500 font-semibold mt-0.5 uppercase tracking-wide">
                              {course.code}
                            </Text>
                          )}
                        </View>
                      </View>

                      {isSelected && (
                        <View className="w-5 h-5 rounded-full bg-brand-600 items-center justify-center">
                          <Check size={12} color="#ffffff" strokeWidth={3} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* 4. Smart Time Picker & Dynamic Duration Presets */}
          <View className="mb-5">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Session Time Window
              </Text>
              {durationMinutes > 0 && (
                <View className="bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
                  <Text className="text-[11px] font-bold text-brand-700">
                    Duration: {durationLabel}
                  </Text>
                </View>
              )}
            </View>

            {/* Start and End Time Inputs */}
            <View className="flex-row items-center space-x-3">
              {/* Start Time Input */}
              <View className="flex-1">
                <Text className="text-[11px] font-semibold text-gray-400 mb-1">
                  START TIME
                </Text>
                <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5">
                  <Clock size={16} color="#6b7280" className="mr-2" />
                  <TextInput
                    value={startTime}
                    onChangeText={handleStartTimeChange}
                    placeholder="09:00"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 text-sm font-bold text-gray-900 font-mono"
                    maxLength={5}
                  />
                  <Text className="text-xs font-semibold text-gray-400 ml-1">
                    {formatTime12Hour(startTime)}
                  </Text>
                </View>
              </View>

              <ArrowRight size={16} color="#9ca3af" className="mt-5" />

              {/* End Time Input */}
              <View className="flex-1">
                <Text className="text-[11px] font-semibold text-gray-400 mb-1">
                  END TIME
                </Text>
                <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5">
                  <Clock size={16} color="#6b7280" className="mr-2" />
                  <TextInput
                    value={endTime}
                    onChangeText={handleEndTimeChange}
                    placeholder="10:30"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 text-sm font-bold text-gray-900 font-mono"
                    maxLength={5}
                  />
                  <Text className="text-xs font-semibold text-gray-400 ml-1">
                    {formatTime12Hour(endTime)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick-Duration Presets Row */}
            <View className="mt-3">
              <Text className="text-[11px] font-semibold text-gray-400 mb-1.5">
                QUICK DURATION PRESETS
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {DURATION_PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.minutes;

                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => handleSelectPreset(preset.minutes)}
                      className={`px-3 py-1.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-brand-600 border-brand-700 shadow-xs'
                          : 'bg-white border-gray-200 active:bg-gray-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-gray-700'
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

          {/* 5. Room & Instructor Text Inputs with Autocomplete */}
          <View className="mb-5">
            {/* Room / Location */}
            <View className="mb-4">
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Room / Venue (Optional)
              </Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5">
                <MapPin size={16} color="#6b7280" className="mr-2" />
                <TextInput
                  value={room}
                  onChangeText={setRoom}
                  placeholder="e.g. Room 302, CS Lab 1"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 text-sm font-medium text-gray-900"
                />
              </View>
              {roomSuggestions.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 mt-2">
                  {roomSuggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setRoom(s)}
                      className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 active:bg-gray-200"
                    >
                      <Text className="text-[11px] font-medium text-gray-600">
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Instructor Name */}
            <View>
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Instructor / Teacher (Optional)
              </Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-3.5 py-2.5">
                <User size={16} color="#6b7280" className="mr-2" />
                <TextInput
                  value={instructor}
                  onChangeText={setInstructor}
                  placeholder="e.g. Dr. Jane Smith"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 text-sm font-medium text-gray-900"
                />
              </View>
              {instructorSuggestions.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 mt-2">
                  {instructorSuggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setInstructor(s)}
                      className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 active:bg-gray-200"
                    >
                      <Text className="text-[11px] font-medium text-gray-600">
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* 6. Real-Time Soft Clash Warning Banner */}
          {conflictResult.hasConflict && (
            <View className="p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-6">
              <View className="flex-row items-center space-x-2 mb-1.5">
                <AlertTriangle size={18} color="#d97706" />
                <Text className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Soft Clash Detected (Override Allowed)
                </Text>
              </View>
              {conflictResult.conflicts.map((conflict, idx) => (
                <Text key={idx} className="text-xs text-amber-800 leading-relaxed font-medium">
                  • {conflict.message}
                </Text>
              ))}
              <Text className="text-[11px] text-amber-700 mt-1.5">
                You can still save this session if your cohort runs parallel electives or split lab groups.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
