// ============================================================================
// ClassSync Course Attendance & Bunk Calculator Analytics Modal
// File: src/app/attendance/course-metrics.tsx
// Description: Detailed course attendance analytics modal featuring the pure
//              bunk calculator engine, safe vs danger zone indicators,
//              interactive "What-If" simulator, and session history logs.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Calendar,
  Clock,
  Check,
  Plus,
  Minus,
  ArrowRight,
  Calculator,
  ShieldAlert,
  Info,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import { useAttendance } from '@/hooks/useAttendance';
import {
  calculateAttendanceMetrics,
  calculateCourseAttendance,
  simulateFutureAttendance,
} from '@/lib/attendance/bunkCalculator';

export default function CourseMetricsModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ course_id?: string }>();
  const { courses } = useWorkspaces();
  const { activeCourses, attendanceLogs } = useAppStore();

  const enrolledCourses = useMemo(() => {
    return activeCourses.length > 0 ? activeCourses : courses;
  }, [activeCourses, courses]);

  // Selected course (defaults to param, or first enrolled course)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    params.course_id || (enrolledCourses.length > 0 ? enrolledCourses[0].id : null)
  );

  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null;
    return enrolledCourses.find((c) => c.id === selectedCourseId) ?? null;
  }, [selectedCourseId, enrolledCourses]);

  // Attendance hook scoped to selected course
  const {
    logs,
    allLogs,
    getCourseMetrics,
    overallMetrics,
    isLoading,
  } = useAttendance({ courseId: selectedCourseId || undefined });

  const activeMetrics = useMemo(() => {
    if (selectedCourseId) {
      return getCourseMetrics(selectedCourseId);
    }
    return overallMetrics;
  }, [selectedCourseId, getCourseMetrics, overallMetrics]);

  // "What-If" Simulation Stepper State
  const [simAttend, setSimAttend] = useState<number>(0);
  const [simSkip, setSimSkip] = useState<number>(0);

  const simulation = useMemo(() => {
    return simulateFutureAttendance(activeMetrics, simAttend, simSkip);
  }, [activeMetrics, simAttend, simSkip]);

  const targetThresholdPercent = Math.round(activeMetrics.threshold * 100);

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'left', 'right']}>
      {/* Modal Header */}
      <View className="px-5 pt-3 pb-3 flex-row items-center justify-between border-b border-neutral-200/60 bg-white/80 backdrop-blur-md">
        <View>
          <Text className="text-xl font-black text-neutral-900 tracking-tight">
            Attendance & Bunk Analytics
          </Text>
          <Text className="text-xs font-semibold text-neutral-500 mt-0.5">
            {selectedCourse ? selectedCourse.name : 'All Enrolled Courses'}
          </Text>
        </View>

        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
        >
          <X size={18} color="#475569" strokeWidth={2.4} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Horizontal Course Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row -mx-1 mb-4"
        >
          {enrolledCourses.map((course) => {
            const isSelected = selectedCourseId === course.id;
            const courseMetric = getCourseMetrics(course.id);
            return (
              <Pressable
                key={course.id}
                onPress={() => {
                  setSelectedCourseId(course.id);
                  setSimAttend(0);
                  setSimSkip(0);
                }}
                className={`mx-1 px-3.5 py-2.5 rounded-2xl border flex-row items-center transition-all ${
                  isSelected
                    ? 'bg-neutral-900 border-neutral-900 shadow-xs'
                    : 'bg-white border-neutral-200/80 active:bg-neutral-50'
                }`}
              >
                <View
                  className="w-2.5 h-2.5 rounded-full mr-2"
                  style={{ backgroundColor: course.color_hex || '#3B82F6' }}
                />
                <Text
                  className={`text-xs font-bold mr-2 ${
                    isSelected ? 'text-white' : 'text-neutral-800'
                  }`}
                >
                  {course.code || course.name}
                </Text>
                <View
                  className={`px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-neutral-800'
                      : courseMetric.isSafe
                      ? 'bg-emerald-50'
                      : 'bg-rose-50'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-black ${
                      isSelected
                        ? courseMetric.isSafe
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                        : courseMetric.isSafe
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {courseMetric.percentage}%
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Hero Gauge & Bunk Allowance Card */}
        <View
          className={`rounded-3xl p-5 mb-4 border shadow-xs ${
            activeMetrics.status === 'safe'
              ? 'bg-emerald-500/10 border-emerald-300/80'
              : activeMetrics.status === 'warning'
              ? 'bg-amber-500/10 border-amber-300/80'
              : 'bg-rose-500/10 border-rose-300/80'
          }`}
        >
          {/* Top Status Pill */}
          <View className="flex-row items-center justify-between mb-3">
            <View
              className={`px-3 py-1 rounded-full border flex-row items-center ${
                activeMetrics.status === 'safe'
                  ? 'bg-emerald-100 border-emerald-300'
                  : activeMetrics.status === 'warning'
                  ? 'bg-amber-100 border-amber-300'
                  : 'bg-rose-100 border-rose-300'
              }`}
            >
              {activeMetrics.status === 'safe' ? (
                <ShieldCheck size={13} color="#059669" />
              ) : (
                <AlertTriangle
                  size={13}
                  color={activeMetrics.status === 'warning' ? '#D97706' : '#DC2626'}
                />
              )}
              <Text
                className={`text-[11px] font-black uppercase tracking-wider ml-1.5 ${
                  activeMetrics.status === 'safe'
                    ? 'text-emerald-800'
                    : activeMetrics.status === 'warning'
                    ? 'text-amber-800'
                    : 'text-rose-800'
                }`}
              >
                {activeMetrics.status === 'safe'
                  ? 'Safe Zone'
                  : activeMetrics.status === 'warning'
                  ? 'Threshold Boundary'
                  : 'Danger Zone'}
              </Text>
            </View>

            <Text className="text-[11px] font-bold text-neutral-500">
              Target: {targetThresholdPercent}%
            </Text>
          </View>

          {/* Large Percentage Metric */}
          <View className="flex-row items-baseline mb-3">
            <Text
              className={`text-5xl font-black tracking-tight ${
                activeMetrics.status === 'safe'
                  ? 'text-emerald-950'
                  : activeMetrics.status === 'warning'
                  ? 'text-amber-950'
                  : 'text-rose-950'
              }`}
            >
              {activeMetrics.percentage}%
            </Text>
            <Text className="text-xs font-bold text-neutral-500 ml-2">
              ({activeMetrics.attended} / {activeMetrics.totalHeld} held sessions)
            </Text>
          </View>

          {/* Visual Progress Bar with Threshold Marker */}
          <View className="mb-4">
            <View className="h-3 w-full bg-white/70 rounded-full overflow-hidden border border-black/5 relative">
              <View
                style={{
                  width: `${Math.min(100, Math.max(0, activeMetrics.percentage))}%`,
                  backgroundColor:
                    activeMetrics.status === 'safe'
                      ? '#059669'
                      : activeMetrics.status === 'warning'
                      ? '#D97706'
                      : '#E11D48',
                }}
                className="h-full rounded-full"
              />
              {/* 75% Target Marker line */}
              <View
                style={{ left: `${targetThresholdPercent}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-neutral-900 opacity-60"
              />
            </View>
            <View className="flex-row justify-between items-center mt-1 px-0.5">
              <Text className="text-[9px] font-semibold text-neutral-400">0%</Text>
              <Text
                style={{ left: `${targetThresholdPercent - 4}%` }}
                className="text-[9px] font-black text-neutral-700 absolute"
              >
                75%
              </Text>
              <Text className="text-[9px] font-semibold text-neutral-400">100%</Text>
            </View>
          </View>

          {/* Bunk Allowance Hero Banner */}
          <View className="bg-white/90 rounded-2xl p-4 border border-white/80 shadow-2xs">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs font-bold text-neutral-500">
                {activeMetrics.isSafe ? 'Skips Allowed ("Bunk Capacity")' : 'Recovery Sessions Needed'}
              </Text>
              <Calculator size={13} color="#64748B" />
            </View>

            <View className="flex-row items-center mt-1">
              <Text
                className={`text-3xl font-black ${
                  activeMetrics.isSafe ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {activeMetrics.isSafe
                  ? activeMetrics.skipsAllowed
                  : activeMetrics.recoveryNeeded}
              </Text>
              <Text className="text-xs font-semibold text-neutral-600 ml-2.5 flex-1 leading-snug">
                {activeMetrics.statusMessage}
              </Text>
            </View>
          </View>
        </View>

        {/* Breakdown Stats Grid */}
        <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
          <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-3">
            Session History Breakdown
          </Text>

          <View className="flex-row -mx-1">
            <View className="flex-1 mx-1 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 items-center">
              <Text className="text-base font-black text-emerald-800">
                {activeMetrics.presentCount}
              </Text>
              <Text className="text-[10px] font-bold text-emerald-600 mt-0.5">Present</Text>
            </View>

            <View className="flex-1 mx-1 p-3 rounded-2xl bg-rose-50/70 border border-rose-100 items-center">
              <Text className="text-base font-black text-rose-800">
                {activeMetrics.absentCount}
              </Text>
              <Text className="text-[10px] font-bold text-rose-600 mt-0.5">Absent</Text>
            </View>

            <View className="flex-1 mx-1 p-3 rounded-2xl bg-amber-50/70 border border-amber-100 items-center">
              <Text className="text-base font-black text-amber-800">
                {activeMetrics.lateCount}
              </Text>
              <Text className="text-[10px] font-bold text-amber-600 mt-0.5">Late</Text>
            </View>

            <View className="flex-1 mx-1 p-3 rounded-2xl bg-blue-50/70 border border-blue-100 items-center">
              <Text className="text-base font-black text-blue-800">
                {activeMetrics.excusedCount}
              </Text>
              <Text className="text-[10px] font-bold text-blue-600 mt-0.5">Excused</Text>
            </View>
          </View>
        </View>

        {/* Interactive "What-If" Bunk Simulator */}
        <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Sparkles size={14} color="#3B82F6" />
              <Text className="text-xs font-black text-neutral-900 ml-1.5">
                "What-If" Bunk Simulator
              </Text>
            </View>
            <Text className="text-[10px] font-semibold text-neutral-400">
              Live Projection
            </Text>
          </View>
          <Text className="text-[11px] font-medium text-neutral-500 mb-4 leading-relaxed">
            Test how your attendance percentage will change if you attend or miss upcoming classes.
          </Text>

          {/* Steppers Row */}
          <View className="flex-row -mx-1.5 mb-4">
            {/* Attend Stepper */}
            <View className="flex-1 mx-1.5 bg-neutral-50 p-3 rounded-2xl border border-neutral-200/70">
              <Text className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Classes to Attend
              </Text>
              <View className="flex-row items-center justify-between">
                <Pressable
                  onPress={() => setSimAttend(Math.max(0, simAttend - 1))}
                  className="w-8 h-8 rounded-full bg-white border border-neutral-200 items-center justify-center active:bg-neutral-100"
                >
                  <Minus size={13} color="#475569" />
                </Pressable>
                <Text className="text-base font-black text-neutral-900">{simAttend}</Text>
                <Pressable
                  onPress={() => setSimAttend(simAttend + 1)}
                  className="w-8 h-8 rounded-full bg-white border border-neutral-200 items-center justify-center active:bg-neutral-100"
                >
                  <Plus size={13} color="#475569" />
                </Pressable>
              </View>
            </View>

            {/* Skip Stepper */}
            <View className="flex-1 mx-1.5 bg-neutral-50 p-3 rounded-2xl border border-neutral-200/70">
              <Text className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Classes to Skip
              </Text>
              <View className="flex-row items-center justify-between">
                <Pressable
                  onPress={() => setSimSkip(Math.max(0, simSkip - 1))}
                  className="w-8 h-8 rounded-full bg-white border border-neutral-200 items-center justify-center active:bg-neutral-100"
                >
                  <Minus size={13} color="#475569" />
                </Pressable>
                <Text className="text-base font-black text-neutral-900">{simSkip}</Text>
                <Pressable
                  onPress={() => setSimSkip(simSkip + 1)}
                  className="w-8 h-8 rounded-full bg-white border border-neutral-200 items-center justify-center active:bg-neutral-100"
                >
                  <Plus size={13} color="#475569" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Simulation Output Card */}
          <View
            className={`p-3.5 rounded-2xl border flex-row items-center justify-between ${
              simulation.projectedPercentage >= targetThresholdPercent
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-rose-50 border-rose-200'
            }`}
          >
            <View className="flex-1 pr-2">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Projected Attendance
              </Text>
              <Text
                className={`text-xs font-semibold mt-0.5 ${
                  simulation.projectedPercentage >= targetThresholdPercent
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {simulation.projectedPercentage >= targetThresholdPercent
                  ? 'Meets 75% Threshold'
                  : 'Below 75% Requirement'}
              </Text>
            </View>

            <View className="items-end">
              <Text
                className={`text-2xl font-black ${
                  simulation.projectedPercentage >= targetThresholdPercent
                    ? 'text-emerald-900'
                    : 'text-rose-900'
                }`}
              >
                {simulation.projectedPercentage}%
              </Text>
              <Text className="text-[10px] font-bold text-neutral-500">
                ({simulation.projectedAttended}/{simulation.projectedTotal} sessions)
              </Text>
            </View>
          </View>
        </View>

        {/* Detailed Attendance Logs for this course */}
        <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
          <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-3">
            Logged Session History ({logs.length})
          </Text>

          {logs.length === 0 ? (
            <View className="py-6 items-center justify-center">
              <Clock size={20} color="#94A3B8" />
              <Text className="text-xs font-medium text-neutral-500 mt-2 text-center">
                No attendance sessions logged for this course yet.
              </Text>
            </View>
          ) : (
            logs.map((log) => {
              const statusColor =
                log.status === 'present'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : log.status === 'absent'
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : log.status === 'late'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200';

              return (
                <View
                  key={log.id}
                  className="py-2.5 border-b border-neutral-100 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-xs font-bold text-neutral-800">
                      {log.attendance_date}
                    </Text>
                    {log.notes && (
                      <Text className="text-[10px] text-neutral-500 mt-0.5" numberOfLines={1}>
                        {log.notes}
                      </Text>
                    )}
                  </View>

                  <View className={`px-2.5 py-0.5 rounded-full border ${statusColor}`}>
                    <Text className="text-[10px] font-black uppercase tracking-wider">
                      {log.status}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
