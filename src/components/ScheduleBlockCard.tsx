import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  Clock,
  MapPin,
  Coffee,
  Heart,
  Users,
  BookOpen,
  FlaskConical,
  GraduationCap,
  AlertTriangle,
  Sparkles,
  Check,
  X,
  ShieldAlert,
  Lock,
  Radio,
} from 'lucide-react-native';
import type { BaseScheduleRow } from '@/store/useAppStore';
import type { CompiledScheduleItem } from '@/lib/schedule/scheduleCompiler';
import {
  formatTime12Hour,
  calculateDurationMinutes,
  formatDuration,
} from '@/lib/schedule/timeUtils';
import { useAttendance } from '@/hooks/useAttendance';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  isAttendanceEligible,
  type AttendanceStatus,
} from '@/lib/attendance/bunkCalculator';
import type { PeerReportWithVotes } from '@/hooks/usePeerVerification';
import { isPeerVotingWindowOpen } from '@/services/peerVerificationService';

export interface ScheduleBlockCardProps {
  block: BaseScheduleRow | CompiledScheduleItem | any;
  onPress?: (block: any) => void;
  onLongPress?: (block: any) => void;
  onBroadcastPress?: (block: any) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
  date?: string; // Target calendar date 'YYYY-MM-DD'
  peerReport?: PeerReportWithVotes;
  userVote?: 'affirm' | 'deny' | null;
  onPeerVotePress?: (block: any) => void;
}

export function ScheduleBlockCard({
  block,
  onPress,
  onLongPress,
  onBroadcastPress,
  readOnly = false,
  isAdmin = false,
  date,
  peerReport,
  userVote,
  onPeerVotePress,
}: ScheduleBlockCardProps) {
  const { allLogs, logAttendance, isLogging } = useAttendance();
  const { activeSection } = useWorkspaces();
  const timezone = activeSection?.timezone || 'UTC';

  const isInteractive = (!readOnly && !!onPress) || !!onLongPress;
  const durationMins = calculateDurationMinutes(block.start_time, block.end_time);
  const durationLabel = formatDuration(durationMins);
  const timeWindow = `${formatTime12Hour(block.start_time)} - ${formatTime12Hour(block.end_time)}`;

  const isGeneralSession =
    block.session_type === 'break' ||
    block.session_type === 'prayer' ||
    block.session_type === 'meeting';

  const targetDate = block.override_date || date;

  // Time-Guarded Attendance Logging
  const timeGuard = useMemo(() => {
    if (!targetDate || isGeneralSession) return null;
    return isAttendanceEligible(targetDate, block.start_time, timezone);
  }, [targetDate, isGeneralSession, block.start_time, timezone]);

  // Lookup existing attendance log for this session
  const sessionLog = useMemo(() => {
    if (!targetDate || !block.course_id) return null;
    return allLogs.find((l) => {
      if (l.course_id !== block.course_id || l.attendance_date !== targetDate) {
        return false;
      }
      if (block.is_makeup && block.override_id) {
        return l.override_id === block.override_id;
      }
      if (block.base_schedule_id) {
        return l.schedule_block_id === block.base_schedule_id;
      }
      return l.schedule_block_id === block.id;
    });
  }, [allLogs, block.course_id, block.id, block.base_schedule_id, block.override_id, block.is_makeup, targetDate]);

  const currentStatus: AttendanceStatus | null =
    (sessionLog?.status as AttendanceStatus) ?? null;

  const handleLogAttendance = async (status: AttendanceStatus) => {
    if (!targetDate || !block.course_id) return;
    try {
      await logAttendance({
        course_id: block.course_id,
        attendance_date: targetDate,
        status,
        schedule_block_id: block.is_makeup ? null : (block.base_schedule_id || block.id),
        override_id: block.is_makeup ? (block.override_id || block.id) : null,
      });
    } catch (e) {
      console.error('[ScheduleBlockCard] Failed to log attendance:', e);
    }
  };

  const generalTitle =
    block.session_type === 'break'
      ? 'Recess / Break'
      : block.session_type === 'prayer'
      ? 'Prayer Break'
      : 'Cohort Meeting';

  const courseTitle = isGeneralSession
    ? generalTitle
    : block.course?.name || 'Academic Session';
  const courseCode = isGeneralSession ? 'BREAK' : (block.course?.code || 'CLASS');

  const isCancelled = block.status === 'cancelled' || !!block.is_cancelled;
  const isDelayed =
    (block.status === 'delayed' || !!block.is_delayed) && (block.delay_minutes ?? 0) > 0;
  const isRoomMoved = block.status === 'room_moved' || !!block.is_room_moved;
  const isMakeup = !!block.is_makeup;

  // Stripe color: Yellow by default, rose if cancelled
  const stripeColor = isCancelled ? '#E11D48' : '#FACC15';

  return (
    <Pressable
      disabled={!isInteractive}
      onPress={() => !readOnly && onPress?.(block)}
      onLongPress={() => onLongPress?.(block)}
      className={`relative bg-white rounded-2xl border border-neutral-200/80 p-3.5 mb-2.5 shadow-2xs overflow-hidden ${
        isInteractive ? 'active:scale-[0.99] active:bg-neutral-50/50' : ''
      }`}
    >
      {/* 1. Leading Left Edge Solid Color Accent Stripe */}
      <View
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: stripeColor }}
      />

      <View className="pl-1.5">
        {/* 2. Top Header Metadata Row */}
        <View className="flex-row items-center justify-between mb-1.5">
          <View className="flex-row items-center space-x-1.5 flex-wrap flex-1 mr-2">
            {/* Monospace Course Code Badge */}
            <View className="bg-neutral-100 border border-neutral-200/80 px-2 py-0.5 rounded-md">
              <Text className="text-[10px] font-black font-mono text-neutral-800 tracking-wider">
                {courseCode}
              </Text>
            </View>

            {/* Session Type Pill */}
            <View className="bg-[#FACC15]/20 border border-[#FACC15]/40 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-black text-neutral-900 uppercase">
                {block.session_type}
              </Text>
            </View>

            {/* Recurrence Pill */}
            {block.frequency && block.frequency !== 'weekly' && (
              <View className="bg-neutral-100 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-neutral-600">
                  {block.frequency === 'biweekly_week_a' ? 'Week A' : 'Week B'}
                </Text>
              </View>
            )}

            {/* Exception Badges */}
            {isCancelled && (
              <View className="bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full flex-row items-center space-x-1">
                <AlertTriangle size={10} color="#E11D48" />
                <Text className="text-[10px] font-black text-rose-800 uppercase">Cancelled</Text>
              </View>
            )}
            {isDelayed && (
              <View className="bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex-row items-center space-x-1">
                <Clock size={10} color="#B45309" />
                <Text className="text-[10px] font-black text-amber-900 uppercase">+{block.delay_minutes}m Delay</Text>
              </View>
            )}
            {isRoomMoved && (
              <View className="bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-full flex-row items-center space-x-1">
                <MapPin size={10} color="#7E22CE" />
                <Text className="text-[10px] font-black text-purple-900 uppercase">Room Moved</Text>
              </View>
            )}
            {isMakeup && (
              <View className="bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded-full flex-row items-center space-x-1">
                <Sparkles size={10} color="#4338CA" />
                <Text className="text-[10px] font-black text-indigo-900 uppercase">Makeup</Text>
              </View>
            )}
          </View>

          {/* Duration Badge */}
          <Text className="text-[10px] font-bold text-neutral-400 font-mono">
            {durationLabel}
          </Text>
        </View>

        {/* 3. Class Title */}
        <Text
          className={`text-sm font-black tracking-tight leading-snug mb-2 ${
            isCancelled ? 'text-neutral-400 line-through' : 'text-neutral-900'
          }`}
          numberOfLines={2}
        >
          {courseTitle}
        </Text>

        {/* 4. Details Row: Time Window & Location */}
        <View className="flex-row items-center space-x-2 flex-wrap">
          <View className="flex-row items-center space-x-1 bg-neutral-100/90 px-2.5 py-1 rounded-lg">
            <Clock size={12} color="#71717A" />
            <Text className="text-xs font-bold text-neutral-800 font-mono">
              {timeWindow}
            </Text>
          </View>

          <View className="flex-row items-center space-x-1 bg-neutral-100/90 px-2.5 py-1 rounded-lg flex-1">
            <MapPin size={12} color="#71717A" />
            <Text className="text-xs font-semibold text-neutral-700 truncate" numberOfLines={1}>
              {block.room || 'TBA'} • {block.instructor || 'Staff'}
            </Text>
          </View>
        </View>

        {/* 5. Custom Note / Live Override Explanation */}
        {block.custom_note && (
          <View className="mt-2 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
            <Text className="text-[11px] font-semibold text-amber-900">
              Note: {block.custom_note}
            </Text>
          </View>
        )}

        {/* 6. Crowd-Sourced Peer Verification Notice */}
        {targetDate && !isGeneralSession && (
          <>
            {peerReport && peerReport.status === 'active' && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onPeerVotePress?.(block);
                }}
                className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <ShieldAlert size={14} color="#D97706" />
                  <View className="ml-1.5 flex-1">
                    <Text className="text-xs font-black text-amber-950">
                      Unscheduled Cancellation Reported
                    </Text>
                    <Text className="text-[10px] text-amber-800 font-medium">
                      {peerReport.affirmation_count}/3 Affirmations • {userVote ? `You voted: ${userVote}` : 'Tap to vote'}
                    </Text>
                  </View>
                </View>
                <View className="px-2.5 py-1 bg-[#FACC15] rounded-full">
                  <Text className="text-[10px] font-black text-neutral-950">Vote</Text>
                </View>
              </Pressable>
            )}

            {peerReport && peerReport.status === 'confirmed' && (
              <View className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-xl flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-2">
                  <ShieldAlert size={13} color="#E11D48" />
                  <Text className="text-[11px] font-bold text-rose-800 ml-1.5">
                    Peer Verified: Cancelled ({peerReport.affirmation_count} votes)
                  </Text>
                </View>
                {isAdmin && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onPeerVotePress?.(block);
                    }}
                    className="bg-rose-100 px-2 py-0.5 rounded-full"
                  >
                    <Text className="text-[9px] font-black text-rose-900">Veto</Text>
                  </Pressable>
                )}
              </View>
            )}

            {!isCancelled && (!peerReport || peerReport.status === 'vetoed') && (
              (() => {
                const windowCheck = isPeerVotingWindowOpen(
                  targetDate,
                  block.start_time,
                  timezone
                );
                if (!windowCheck.isOpen) return null;
                return (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onPeerVotePress?.(block);
                    }}
                    className="mt-2 pt-2 border-t border-neutral-100 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center space-x-1">
                      <ShieldAlert size={12} color="#D97706" />
                      <Text className="text-[10px] font-bold text-amber-800 ml-1">
                        Instructor absent? Tap to report cancellation
                      </Text>
                    </View>
                    <View className="px-2 py-0.5 bg-amber-100 rounded-full">
                      <Text className="text-[9px] font-black text-amber-900">Report</Text>
                    </View>
                  </Pressable>
                );
              })()
            )}
          </>
        )}

        {/* 7. 1-Tap Attendance Logger (Time-Guarded) */}
        {targetDate && !isGeneralSession && !isCancelled && (
          <View className="mt-2.5 pt-2 border-t border-neutral-100">
            {timeGuard?.isEligible ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                  Log Attendance:
                </Text>
                <View className="flex-row items-center space-x-1.5">
                  {/* Present */}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleLogAttendance('present');
                    }}
                    disabled={isLogging}
                    className={`px-3 py-1 rounded-full border flex-row items-center space-x-1 ${
                      currentStatus === 'present'
                        ? 'bg-emerald-600 border-emerald-600 shadow-2xs'
                        : 'bg-emerald-50 border-emerald-200/80 active:bg-emerald-100'
                    }`}
                  >
                    <Check
                      size={11}
                      color={currentStatus === 'present' ? '#FFFFFF' : '#059669'}
                      strokeWidth={2.6}
                    />
                    <Text
                      className={`text-[11px] font-bold ml-0.5 ${
                        currentStatus === 'present' ? 'text-white font-black' : 'text-emerald-800'
                      }`}
                    >
                      Present
                    </Text>
                  </Pressable>

                  {/* Absent */}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleLogAttendance('absent');
                    }}
                    disabled={isLogging}
                    className={`px-3 py-1 rounded-full border flex-row items-center space-x-1 ${
                      currentStatus === 'absent'
                        ? 'bg-rose-600 border-rose-600 shadow-2xs'
                        : 'bg-rose-50 border-rose-200/80 active:bg-rose-100'
                    }`}
                  >
                    <X
                      size={11}
                      color={currentStatus === 'absent' ? '#FFFFFF' : '#E11D48'}
                      strokeWidth={2.6}
                    />
                    <Text
                      className={`text-[11px] font-bold ml-0.5 ${
                        currentStatus === 'absent' ? 'text-white font-black' : 'text-rose-800'
                      }`}
                    >
                      Absent
                    </Text>
                  </Pressable>

                  {/* Late */}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleLogAttendance('late');
                    }}
                    disabled={isLogging}
                    className={`px-2.5 py-1 rounded-full border flex-row items-center space-x-1 ${
                      currentStatus === 'late'
                        ? 'bg-amber-500 border-amber-500 shadow-2xs'
                        : 'bg-amber-50 border-amber-200/80 active:bg-amber-100'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-bold ${
                        currentStatus === 'late' ? 'text-white font-black' : 'text-amber-800'
                      }`}
                    >
                      Late
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center space-x-1">
                  <Clock size={11} color="#A1A1AA" />
                  <Text className="text-[10px] font-medium text-neutral-400 ml-1">
                    {timeGuard?.reason === 'future_today'
                      ? `Attendance unlocks at ${formatTime12Hour(block.start_time)}`
                      : 'Upcoming session (future date)'}
                  </Text>
                </View>
                <View className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                  <Text className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">
                    Locked
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 8. CR Controls Quick Actions Toolbar */}
        {isAdmin && !readOnly && (
          <View className="mt-2.5 pt-2 border-t border-neutral-100 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-[#FACC15] mr-1.5" />
              <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                CR Controls
              </Text>
            </View>
            <View className="flex-row items-center space-x-1.5">
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  (onBroadcastPress || onLongPress)?.(block);
                }}
                accessibilityRole="button"
                testID="btn-card-alert-cancel"
                className="px-2.5 py-1 rounded-full bg-[#FEF08A] border border-[#FACC15] flex-row items-center active:bg-[#FACC15]"
              >
                <Radio size={11} color="#854D0E" />
                <Text className="text-[10px] font-black text-neutral-900 ml-1">
                  {isCancelled ? 'Update Alert' : 'Alert / Cancel'}
                </Text>
              </Pressable>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onPress?.(block);
                }}
                className="px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200/80 flex-row items-center active:bg-neutral-200 ml-1.5"
              >
                <Text className="text-[10px] font-bold text-neutral-700">
                  Edit Slot
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}
