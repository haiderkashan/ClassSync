import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
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
  Sparkles,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { getDayName } from '@/lib/schedule/timeUtils';
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

export default function EditBlockModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; id?: string }>();
  const { courses, activeSection } = useWorkspaces();

  const initialDay = params.day ? parseInt(params.day, 10) : 1;
  const [dayOfWeek, setDayOfWeek] = useState<number>(initialDay);
  const [sessionType, setSessionType] = useState<string>('lecture');
  const [frequency, setFrequency] = useState<string>('weekly');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    courses.length > 0 ? courses[0].id : null
  );

  // Determine if this session type requires a course association
  const isGeneralSession = sessionType === 'break' || sessionType === 'prayer' || sessionType === 'meeting';

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
        <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 60 }}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
