import React from 'react';
import { View, Text } from 'react-native';
import { Coffee } from 'lucide-react-native';
import { formatDuration, formatTime12Hour } from '@/lib/schedule/timeUtils';

export interface FreePeriodSpacerProps {
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
}

/**
 * Renders a subtle break indicator between non-contiguous timetable sessions
 * matching the soft, floating pill design system.
 */
export function FreePeriodSpacer({ durationMinutes, startTime, endTime }: FreePeriodSpacerProps) {
  if (durationMinutes <= 0) {
    return null;
  }

  const durationText = formatDuration(durationMinutes);
  const timeWindow =
    startTime && endTime
      ? `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`
      : null;

  return (
    <View className="flex-row items-center justify-center my-3 px-2">
      {/* Left dashed line */}
      <View className="flex-1 border-b border-dashed border-neutral-200" />

      {/* Center Soft Pill */}
      <View className="mx-3 flex-row items-center bg-white border border-neutral-200/90 px-3.5 py-1.5 rounded-full shadow-2xs">
        <Coffee size={12} color="#D97706" />
        <Text className="text-[11px] font-bold text-neutral-800 ml-1.5">
          Free Period • {durationText}
        </Text>
        {timeWindow && (
          <Text className="text-[10px] font-semibold text-neutral-400 ml-1">
            ({timeWindow})
          </Text>
        )}
      </View>

      {/* Right dashed line */}
      <View className="flex-1 border-b border-dashed border-neutral-200" />
    </View>
  );
}
