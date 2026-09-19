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
 * Renders a subtle break indicator between non-contiguous timetable sessions.
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
    <View className="flex-row items-center justify-center my-2 py-1 px-4">
      {/* Left Dashed Line */}
      <View className="flex-1 border-b border-dashed border-gray-200" />

      {/* Center Pill */}
      <View className="mx-3 flex-row items-center space-x-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
        <Coffee size={12} color="#9ca3af" />
        <Text className="text-[11px] font-semibold text-gray-500">
          Free Period • {durationText}
        </Text>
        {timeWindow && (
          <Text className="text-[10px] text-gray-400 ml-1">
            ({timeWindow})
          </Text>
        )}
      </View>

      {/* Right Dashed Line */}
      <View className="flex-1 border-b border-dashed border-gray-200" />
    </View>
  );
}
