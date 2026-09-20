// ============================================================================
// ClassSync Web-Safe Date & Time Picker Component
// File: src/components/tasks/DateTimePickerWebSafe.tsx
// Description: Cross-platform due date & time picker with strict web fallback.
//              Prevents crashes on Expo Web Bundler with native pickers for mobile
//              and intuitive presets & inputs on web.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { Calendar, Clock, Sparkles, Check, ChevronDown } from 'lucide-react-native';
import { formatDeadlineRelative } from '@/lib/tasks/taskUtils';

// Only load native DateTimePicker on native platforms to prevent web bundler crashes
let NativeDateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    NativeDateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (e) {
    console.warn('[DateTimePickerWebSafe] Native datetimepicker not available:', e);
  }
}

export interface DateTimePickerWebSafeProps {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

export function DateTimePickerWebSafe({
  value,
  onChange,
  minimumDate = new Date(),
}: DateTimePickerWebSafeProps) {
  const [showNativeDatePicker, setShowNativeDatePicker] = useState(false);
  const [showNativeTimePicker, setShowNativeTimePicker] = useState(false);
  const [customWebDate, setCustomWebDate] = useState(() => {
    return value.toISOString().split('T')[0];
  });
  const [customWebTime, setCustomWebTime] = useState(() => {
    const hours = value.getHours().toString().padStart(2, '0');
    const minutes = value.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  });

  const relativeDeadline = useMemo(() => {
    return formatDeadlineRelative(value);
  }, [value]);

  // Quick Preset Handlers (Common student deadlines)
  const applyPresetTonight = () => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    onChange(d);
    setCustomWebDate(d.toISOString().split('T')[0]);
    setCustomWebTime('23:59');
  };

  const applyPresetTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 0, 0);
    onChange(d);
    setCustomWebDate(d.toISOString().split('T')[0]);
    setCustomWebTime('23:59');
  };

  const applyPresetIn3Days = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 0, 0);
    onChange(d);
    setCustomWebDate(d.toISOString().split('T')[0]);
    setCustomWebTime('23:59');
  };

  const applyPresetIn7Days = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    onChange(d);
    setCustomWebDate(d.toISOString().split('T')[0]);
    setCustomWebTime('23:59');
  };

  const handleWebDateChange = (newDateStr: string) => {
    setCustomWebDate(newDateStr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) {
      const [year, month, day] = newDateStr.split('-').map(Number);
      const updated = new Date(value);
      updated.setFullYear(year);
      updated.setMonth(month - 1);
      updated.setDate(day);
      onChange(updated);
    }
  };

  const handleWebTimeChange = (newTimeStr: string) => {
    setCustomWebTime(newTimeStr);
    if (/^\d{2}:\d{2}$/.test(newTimeStr)) {
      const [hours, minutes] = newTimeStr.split(':').map(Number);
      const updated = new Date(value);
      updated.setHours(hours);
      updated.setMinutes(minutes);
      onChange(updated);
    }
  };

  const formatDisplayDate = (d: Date) => {
    return d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDisplayTime = (d: Date) => {
    return d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
          Due Date & Time <Text className="text-rose-500">*</Text>
        </Text>

        <View
          className={`px-2.5 py-1 rounded-full border flex-row items-center ${
            relativeDeadline.isOverdue
              ? 'bg-rose-50 border-rose-200'
              : relativeDeadline.isUrgent
              ? 'bg-amber-50 border-amber-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <Clock
            size={11}
            color={
              relativeDeadline.isOverdue
                ? '#E11D48'
                : relativeDeadline.isUrgent
                ? '#D97706'
                : '#2563EB'
            }
          />
          <Text
            className={`text-[11px] font-bold ml-1 ${
              relativeDeadline.isOverdue
                ? 'text-rose-700'
                : relativeDeadline.isUrgent
                ? 'text-amber-700'
                : 'text-blue-700'
            }`}
          >
            {relativeDeadline.text}
          </Text>
        </View>
      </View>

      {/* Quick Presets ScrollView */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-row -mx-1 mb-3.5"
      >
        <Pressable
          onPress={applyPresetTonight}
          className="mx-1 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200/80 active:bg-neutral-200 flex-row items-center"
        >
          <Sparkles size={11} color="#475569" />
          <Text className="text-xs font-bold text-neutral-700 ml-1">Tonight 11:59 PM</Text>
        </Pressable>

        <Pressable
          onPress={applyPresetTomorrow}
          className="mx-1 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200/80 active:bg-neutral-200 flex-row items-center"
        >
          <Calendar size={11} color="#475569" />
          <Text className="text-xs font-bold text-neutral-700 ml-1">Tomorrow 11:59 PM</Text>
        </Pressable>

        <Pressable
          onPress={applyPresetIn3Days}
          className="mx-1 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200/80 active:bg-neutral-200 flex-row items-center"
        >
          <Text className="text-xs font-bold text-neutral-700">+3 Days</Text>
        </Pressable>

        <Pressable
          onPress={applyPresetIn7Days}
          className="mx-1 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200/80 active:bg-neutral-200 flex-row items-center"
        >
          <Text className="text-xs font-bold text-neutral-700">+7 Days (Next Week)</Text>
        </Pressable>
      </ScrollView>

      {/* Web vs Native Picker Implementation */}
      {Platform.OS === 'web' ? (
        /* Web Safe Fallback Input UI */
        <View className="space-y-2">
          <View className="flex-row items-center space-x-2">
            {/* Date Input */}
            <View className="flex-1">
              <Text className="text-[10px] font-bold text-neutral-400 mb-1">Calendar Date (YYYY-MM-DD)</Text>
              <TextInput
                value={customWebDate}
                onChangeText={handleWebDateChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                className="bg-neutral-50 border border-neutral-200/80 rounded-2xl px-3.5 py-2.5 font-mono text-xs font-bold text-neutral-900"
              />
            </View>

            {/* Time Input */}
            <View className="w-36">
              <Text className="text-[10px] font-bold text-neutral-400 mb-1">Due Time (24h HH:mm)</Text>
              <TextInput
                value={customWebTime}
                onChangeText={handleWebTimeChange}
                placeholder="23:59"
                placeholderTextColor="#94A3B8"
                className="bg-neutral-50 border border-neutral-200/80 rounded-2xl px-3.5 py-2.5 font-mono text-xs font-bold text-neutral-900"
              />
            </View>
          </View>

          {/* Quick Time Buttons */}
          <View className="flex-row items-center mt-2 -mx-1">
            {['11:59 PM', '05:00 PM', '02:00 PM', '09:00 AM'].map((timeLabel) => {
              const [hStr, rest] = timeLabel.split(':');
              const [mStr, ampm] = rest.split(' ');
              let hour = parseInt(hStr, 10);
              if (ampm === 'PM' && hour < 12) hour += 12;
              if (ampm === 'AM' && hour === 12) hour = 0;
              const formatted24 = `${hour.toString().padStart(2, '0')}:${mStr}`;

              const isSelected = customWebTime === formatted24;

              return (
                <Pressable
                  key={timeLabel}
                  onPress={() => handleWebTimeChange(formatted24)}
                  className={`mx-1 px-2.5 py-1 rounded-xl border ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-neutral-50 border-neutral-200/60'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      isSelected ? 'text-white' : 'text-neutral-600'
                    }`}
                  >
                    {timeLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        /* Native iOS & Android Pickers */
        <View className="flex-row items-center space-x-2">
          {/* Native Date Trigger Button */}
          <Pressable
            onPress={() => setShowNativeDatePicker(true)}
            className="flex-1 bg-neutral-50 border border-neutral-200/80 rounded-2xl px-4 py-3 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Calendar size={16} color="#475569" />
              <Text className="text-xs font-bold text-neutral-800 ml-2">
                {formatDisplayDate(value)}
              </Text>
            </View>
            <ChevronDown size={14} color="#94A3B8" />
          </Pressable>

          {/* Native Time Trigger Button */}
          <Pressable
            onPress={() => setShowNativeTimePicker(true)}
            className="w-36 bg-neutral-50 border border-neutral-200/80 rounded-2xl px-4 py-3 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Clock size={16} color="#475569" />
              <Text className="text-xs font-bold text-neutral-800 ml-2">
                {formatDisplayTime(value)}
              </Text>
            </View>
            <ChevronDown size={14} color="#94A3B8" />
          </Pressable>

          {/* Native Date Picker Modal */}
          {showNativeDatePicker && NativeDateTimePicker && (
            <NativeDateTimePicker
              value={value}
              mode="date"
              minimumDate={minimumDate}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event: any, selectedDate?: Date) => {
                setShowNativeDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  const updated = new Date(value);
                  updated.setFullYear(selectedDate.getFullYear());
                  updated.setMonth(selectedDate.getMonth());
                  updated.setDate(selectedDate.getDate());
                  onChange(updated);
                }
              }}
            />
          )}

          {/* Native Time Picker Modal */}
          {showNativeTimePicker && NativeDateTimePicker && (
            <NativeDateTimePicker
              value={value}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event: any, selectedTime?: Date) => {
                setShowNativeTimePicker(Platform.OS === 'ios');
                if (selectedTime) {
                  const updated = new Date(value);
                  updated.setHours(selectedTime.getHours());
                  updated.setMinutes(selectedTime.getMinutes());
                  onChange(updated);
                }
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
