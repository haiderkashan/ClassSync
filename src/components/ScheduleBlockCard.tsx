import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
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
  AlertTriangle,
  Sparkles,
  Radio,
} from 'lucide-react-native';
import type { BaseScheduleRow } from '@/store/useAppStore';
import type { CompiledScheduleItem } from '@/lib/schedule/scheduleCompiler';
import {
  formatTime12Hour,
  calculateDurationMinutes,
  formatDuration,
} from '@/lib/schedule/timeUtils';

export interface ScheduleBlockCardProps {
  block: BaseScheduleRow | CompiledScheduleItem | any;
  onPress?: (block: any) => void;
  onLongPress?: (block: any) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
}

/**
 * Returns pastel theme colors, session icon, and typography styles for a given session type.
 * Inspired by premium soft UI design language (mint, lavender, peach, teal, sky).
 */
function getSessionPalette(sessionType: string) {
  switch (sessionType?.toLowerCase()) {
    case 'lab':
      return {
        label: 'LAB',
        icon: FlaskConical,
        bgColor: '#EDFAF3', // soft mint
        borderColor: '#C7F0DB',
        badgeBg: '#D1F4E2',
        textColor: '#064E3B',
        iconColor: '#059669',
      };
    case 'break':
      return {
        label: 'BREAK',
        icon: Coffee,
        bgColor: '#FEF7EC', // soft peach
        borderColor: '#FCE7C5',
        badgeBg: '#FDECD2',
        textColor: '#78350F',
        iconColor: '#D97706',
      };
    case 'prayer':
      return {
        label: 'PRAYER',
        icon: Heart,
        bgColor: '#EBF7F6', // soft teal
        borderColor: '#C7ECE8',
        badgeBg: '#CEEFEA',
        textColor: '#134E4A',
        iconColor: '#0D9488',
      };
    case 'meeting':
      return {
        label: 'MEETING',
        icon: Users,
        bgColor: '#F4EEFD', // soft lavender
        borderColor: '#E5D6FA',
        badgeBg: '#EBDCFB',
        textColor: '#4C1D95',
        iconColor: '#7C3AED',
      };
    case 'makeup':
      return {
        label: 'MAKEUP',
        icon: Sparkles,
        bgColor: '#EEF2FF', // soft indigo
        borderColor: '#C7D2FE',
        badgeBg: '#E0E7FF',
        textColor: '#3730A3',
        iconColor: '#4F46E5',
      };
    case 'tutorial':
    case 'seminar':
    case 'studio':
    case 'workshop':
      return {
        label: sessionType.toUpperCase(),
        icon: GraduationCap,
        bgColor: '#FEF1F3', // soft rose
        borderColor: '#FCD3D9',
        badgeBg: '#FCE0E5',
        textColor: '#881337',
        iconColor: '#E11D48',
      };
    case 'lecture':
    default:
      return {
        label: 'LECTURE',
        icon: BookOpen,
        bgColor: '#EEF6FF', // soft sky blue
        borderColor: '#D8E8FC',
        badgeBg: '#DBEBFE',
        textColor: '#1E3A8A',
        iconColor: '#2563EB',
      };
  }
}

export function ScheduleBlockCard({
  block,
  onPress,
  onLongPress,
  readOnly = false,
  isAdmin = false,
}: ScheduleBlockCardProps) {
  const isInteractive = (!readOnly && !!onPress) || !!onLongPress;
  const durationMins = calculateDurationMinutes(block.start_time, block.end_time);
  const durationLabel = formatDuration(durationMins);
  const timeWindow = `${formatTime12Hour(block.start_time)} - ${formatTime12Hour(block.end_time)}`;

  const isGeneralSession =
    block.session_type === 'break' ||
    block.session_type === 'prayer' ||
    block.session_type === 'meeting';

  const generalTitle =
    block.session_type === 'break'
      ? 'Recess / Break'
      : block.session_type === 'prayer'
      ? 'Prayer Break'
      : 'Cohort Meeting';

  const courseTitle = isGeneralSession
    ? generalTitle
    : block.course?.name || 'Academic Session';
  const courseCode = isGeneralSession ? undefined : block.course?.code;

  const palette = getSessionPalette(block.session_type);
  const SessionIcon = palette.icon;

  const isBiweekly =
    block.frequency === 'biweekly_week_a' || block.frequency === 'biweekly_week_b';
  const biweeklyLabel = block.frequency === 'biweekly_week_a' ? 'Week A' : 'Week B';

  // Exception override properties
  const isCancelled = block.status === 'cancelled' || !!block.is_cancelled;
  const isDelayed =
    (block.status === 'delayed' || !!block.is_delayed) && (block.delay_minutes ?? 0) > 0;
  const isRoomMoved = block.status === 'room_moved' || !!block.is_room_moved;
  const isMakeup = !!block.is_makeup;
  const customNote = block.custom_note;

  return (
    <Pressable
      disabled={!isInteractive}
      onPress={() => !readOnly && onPress?.(block)}
      onLongPress={() => onLongPress?.(block)}
      style={[
        styles.cardContainer,
        {
          backgroundColor: isCancelled ? '#FFF1F2' : palette.bgColor,
          borderColor: isCancelled ? '#FECDD3' : palette.borderColor,
          opacity: isCancelled ? 0.85 : 1,
        },
      ]}
      className={`rounded-3xl p-4 mb-3 transition-transform ${
        isInteractive ? 'active:scale-[0.98]' : ''
      }`}
    >
      {/* Top Header: Session Type Badge + Duration Pill + Live Exception Badges */}
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center flex-wrap gap-1.5 flex-1 mr-2">
          {/* Session Type Pill */}
          <View className="flex-row items-center bg-white/90 px-2.5 py-1 rounded-full border border-white/80 shadow-2xs">
            <SessionIcon size={12} color={palette.iconColor} />
            <Text
              className="text-[10px] font-black tracking-wider ml-1"
              style={{ color: palette.textColor }}
            >
              {palette.label}
            </Text>
          </View>

          {/* Live Status Override Badges */}
          {isCancelled && (
            <View className="flex-row items-center bg-rose-500/15 border border-rose-400/30 px-2.5 py-1 rounded-full">
              <AlertTriangle size={10} color="#e11d48" />
              <Text className="text-[10px] font-black text-rose-700 ml-1 tracking-wider">
                CANCELLED
              </Text>
            </View>
          )}

          {isDelayed && (
            <View className="flex-row items-center bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 rounded-full">
              <Clock size={10} color="#d97706" />
              <Text className="text-[10px] font-black text-amber-800 ml-1 tracking-wider">
                +{block.delay_minutes}m DELAY
              </Text>
            </View>
          )}

          {isRoomMoved && (
            <View className="flex-row items-center bg-purple-500/15 border border-purple-400/30 px-2.5 py-1 rounded-full">
              <MapPin size={10} color="#7c3aed" />
              <Text className="text-[10px] font-black text-purple-800 ml-1 tracking-wider">
                ROOM MOVED
              </Text>
            </View>
          )}

          {isMakeup && (
            <View className="flex-row items-center bg-indigo-500/15 border border-indigo-400/30 px-2.5 py-1 rounded-full">
              <Sparkles size={10} color="#4338ca" />
              <Text className="text-[10px] font-black text-indigo-800 ml-1 tracking-wider">
                MAKEUP
              </Text>
            </View>
          )}
        </View>

        {/* Right Badges: Frequency, Duration, and Admin Broadcast Hint */}
        <View className="flex-row items-center space-x-1.5">
          {isBiweekly && (
            <View className="bg-white/90 px-2 py-0.5 rounded-full border border-white/80 shadow-2xs">
              <Text className="text-[10px] font-bold text-neutral-700">
                {biweeklyLabel}
              </Text>
            </View>
          )}

          <View className="flex-row items-center bg-white/90 px-2.5 py-0.5 rounded-full border border-white/80 shadow-2xs">
            <Clock size={10} color="#71717a" />
            <Text className="text-[10px] font-bold text-neutral-700 ml-1">
              {durationLabel}
            </Text>
          </View>

          {isAdmin && (
            <View className="w-5 h-5 rounded-full bg-neutral-900/10 items-center justify-center">
              <Radio size={10} color="#18181b" />
            </View>
          )}
        </View>
      </View>

      {/* Main Content: Course Title & Code */}
      <View className="mb-2.5">
        <Text
          className={`text-base font-black tracking-tight ${
            isCancelled ? 'line-through text-neutral-400' : 'text-neutral-900'
          }`}
          numberOfLines={1}
        >
          {courseTitle}
        </Text>
        {courseCode && (
          <Text className="text-[11px] font-bold text-neutral-500 mt-0.5 uppercase tracking-wider">
            {courseCode}
          </Text>
        )}
      </View>

      {/* Bottom Row: Room, Instructor, and Time Window */}
      <View className="flex-row flex-wrap items-center justify-between pt-2 border-t border-black/5 gap-1.5">
        <View className="flex-row items-center flex-wrap gap-1.5">
          {/* Room Badge */}
          {block.room && (
            <View
              className={`flex-row items-center px-2.5 py-1 rounded-full border shadow-2xs ${
                isRoomMoved
                  ? 'bg-purple-100/90 border-purple-300'
                  : 'bg-white/90 border-white/80'
              }`}
            >
              <MapPin size={11} color={isRoomMoved ? '#7c3aed' : '#71717a'} />
              <Text
                className={`text-[11px] font-bold ml-1 ${
                  isRoomMoved ? 'text-purple-900' : 'text-neutral-800'
                }`}
              >
                {block.room}
              </Text>
            </View>
          )}

          {/* Instructor Badge */}
          {block.instructor && (
            <View className="flex-row items-center bg-white/90 px-2.5 py-1 rounded-full border border-white/80 shadow-2xs max-w-[130px]">
              <User size={11} color="#71717a" />
              <Text
                className="text-[11px] font-semibold text-neutral-800 ml-1"
                numberOfLines={1}
              >
                {block.instructor}
              </Text>
            </View>
          )}
        </View>

        {/* Effective Time Window */}
        <View className="items-end ml-auto">
          <Text
            className={`text-[11px] font-bold ${
              isDelayed ? 'text-amber-700' : 'text-neutral-500'
            }`}
          >
            {timeWindow}
          </Text>
        </View>
      </View>

      {/* Announcement Note Callout */}
      {customNote && (
        <View className="mt-2.5 pt-2 border-t border-black/5 flex-row items-center bg-white/40 px-2.5 py-1.5 rounded-2xl">
          <Sparkles size={11} color="#71717a" />
          <Text
            className="text-[11px] font-medium text-neutral-600 ml-1.5 flex-1"
            numberOfLines={2}
          >
            {customNote}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
      default: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
      },
    }),
  },
});
