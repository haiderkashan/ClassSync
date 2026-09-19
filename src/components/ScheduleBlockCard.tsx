import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  Clock,
  MapPin,
  User,
  Coffee,
  Heart,
  Users,
  BookOpen,
  FlaskConical,
  GraduationCap,
  Sparkles,
} from 'lucide-react-native';
import type { BaseScheduleRow } from '@/store/useAppStore';
import {
  formatTime12Hour,
  calculateDurationMinutes,
  formatDuration,
} from '@/lib/schedule/timeUtils';

export interface ScheduleBlockCardProps {
  block: BaseScheduleRow;
  onPress?: (block: BaseScheduleRow) => void;
  onLongPress?: (block: BaseScheduleRow) => void;
}

/**
 * Returns icon, label, and theme classes for a given session type.
 */
function getSessionTypeConfig(sessionType: string) {
  switch (sessionType?.toLowerCase()) {
    case 'lab':
      return {
        label: 'LAB',
        icon: FlaskConical,
        bgClass: 'bg-emerald-50 border-emerald-200',
        textClass: 'text-emerald-700',
        iconColor: '#059669',
      };
    case 'break':
      return {
        label: 'BREAK',
        icon: Coffee,
        bgClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-700',
        iconColor: '#d97706',
      };
    case 'prayer':
      return {
        label: 'PRAYER',
        icon: Heart,
        bgClass: 'bg-teal-50 border-teal-200',
        textClass: 'text-teal-700',
        iconColor: '#0d9488',
      };
    case 'meeting':
      return {
        label: 'MEETING',
        icon: Users,
        bgClass: 'bg-slate-100 border-slate-200',
        textClass: 'text-slate-700',
        iconColor: '#475569',
      };
    case 'tutorial':
    case 'seminar':
    case 'studio':
    case 'workshop':
      return {
        label: sessionType.toUpperCase(),
        icon: GraduationCap,
        bgClass: 'bg-purple-50 border-purple-200',
        textClass: 'text-purple-700',
        iconColor: '#9333ea',
      };
    case 'lecture':
    default:
      return {
        label: 'LECTURE',
        icon: BookOpen,
        bgClass: 'bg-indigo-50 border-indigo-200',
        textClass: 'text-indigo-700',
        iconColor: '#4f46e5',
      };
  }
}

export function ScheduleBlockCard({ block, onPress, onLongPress }: ScheduleBlockCardProps) {
  const durationMins = calculateDurationMinutes(block.start_time, block.end_time);
  const durationLabel = formatDuration(durationMins);
  const timeWindow = `${formatTime12Hour(block.start_time)} - ${formatTime12Hour(block.end_time)}`;

  const accentColor = block.color_override || block.course?.color_hex || '#4F46E5';
  const courseTitle = block.course?.name || 'Academic Session';
  const courseCode = block.course?.code;
  const sessionConfig = getSessionTypeConfig(block.session_type);
  const SessionIcon = sessionConfig.icon;

  const isBiweekly = block.frequency === 'biweekly_week_a' || block.frequency === 'biweekly_week_b';
  const biweeklyLabel = block.frequency === 'biweekly_week_a' ? 'Week A Only' : 'Week B Only';

  return (
    <Pressable
      onPress={() => onPress?.(block)}
      onLongPress={() => onLongPress?.(block)}
      className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm active:scale-[0.99] transition-transform"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: accentColor,
      }}
    >
      {/* Top Header: Time Window + Duration Badge + Frequency */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center space-x-1.5">
          <Clock size={14} color="#6b7280" />
          <Text className="text-xs font-semibold text-gray-700">{timeWindow}</Text>
        </View>

        <View className="flex-row items-center space-x-1.5">
          {isBiweekly && (
            <View className="bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
              <Text className="text-[10px] font-bold text-purple-700">{biweeklyLabel}</Text>
            </View>
          )}
          <View className="bg-gray-100 px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-bold text-gray-600">{durationLabel}</Text>
          </View>
        </View>
      </View>

      {/* Main Content: Course Name and Code */}
      <View className="mb-3">
        <Text className="text-base font-bold text-gray-900 tracking-tight" numberOfLines={1}>
          {courseTitle}
        </Text>
        {courseCode && (
          <Text className="text-xs font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">
            {courseCode}
          </Text>
        )}
      </View>

      {/* Bottom Row: Session Type, Room, and Instructor Badges */}
      <View className="flex-row flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
        {/* Session Type Pill */}
        <View
          className={`flex-row items-center space-x-1 px-2.5 py-1 rounded-lg border ${sessionConfig.bgClass}`}
        >
          <SessionIcon size={12} color={sessionConfig.iconColor} />
          <Text className={`text-[11px] font-bold tracking-wider ${sessionConfig.textClass}`}>
            {sessionConfig.label}
          </Text>
        </View>

        {/* Room / Location */}
        {block.room && (
          <View className="flex-row items-center space-x-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200">
            <MapPin size={12} color="#6b7280" />
            <Text className="text-[11px] font-medium text-gray-700">{block.room}</Text>
          </View>
        )}

        {/* Instructor */}
        {block.instructor && (
          <View className="flex-row items-center space-x-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200">
            <User size={12} color="#6b7280" />
            <Text className="text-[11px] font-medium text-gray-700" numberOfLines={1}>
              {block.instructor}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
