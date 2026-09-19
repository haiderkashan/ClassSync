import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {
  Copy,
  ArrowRight,
  AlertTriangle,
  Check,
  X,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';
import { useAppStore } from '@/store/useAppStore';
import { useBaseSchedule } from '@/hooks/useBaseSchedule';
import { getDayName } from '@/lib/schedule/timeUtils';

const DAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

export interface CloneDayModalProps {
  visible: boolean;
  onClose: () => void;
  initialSourceDay?: number;
  onSuccess?: (targetDay: number) => void;
}

export function CloneDayModal({
  visible,
  onClose,
  initialSourceDay = 1,
  onSuccess,
}: CloneDayModalProps) {
  const { baseSchedules } = useAppStore();
  const { cloneDay, isCloning } = useBaseSchedule();

  const [sourceDay, setSourceDay] = useState<number>(initialSourceDay);
  const [targetDay, setTargetDay] = useState<number>(
    initialSourceDay === 1 ? 2 : 1
  );
  const [overrideExisting, setOverrideExisting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initialSourceDay when modal opens
  React.useEffect(() => {
    if (visible) {
      setSourceDay(initialSourceDay);
      setTargetDay(initialSourceDay === 1 ? 2 : 1);
      setOverrideExisting(false);
      setErrorMessage(null);
    }
  }, [visible, initialSourceDay]);

  // Compute counts for source and target days
  const sourceBlocksCount = useMemo(() => {
    return baseSchedules.filter((b) => b.day_of_week === sourceDay).length;
  }, [baseSchedules, sourceDay]);

  const targetBlocksCount = useMemo(() => {
    return baseSchedules.filter((b) => b.day_of_week === targetDay).length;
  }, [baseSchedules, targetDay]);

  const isSameDay = sourceDay === targetDay;
  const isSourceEmpty = sourceBlocksCount === 0;
  const isSubmitDisabled = isCloning || isSameDay || isSourceEmpty;

  const handleClone = async () => {
    if (isSubmitDisabled) return;
    setErrorMessage(null);

    try {
      await cloneDay({
        source_day: sourceDay,
        target_day: targetDay,
        override_existing: overrideExisting,
      });

      onSuccess?.(targetDay);
      onClose();
    } catch (err: any) {
      console.error('[CloneDayModal] Error cloning day:', err);
      setErrorMessage(
        err?.message || 'Failed to clone schedule. Please try again.'
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-center items-center px-4">
        <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-gray-100">
            <View className="flex-row items-center space-x-2.5">
              <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center">
                <Copy size={18} color="#4f46e5" strokeWidth={2.5} />
              </View>
              <View>
                <Text className="text-base font-extrabold text-gray-900 tracking-tight">
                  Clone Day Timetable
                </Text>
                <Text className="text-xs text-gray-500 font-medium">
                  Replicate recurring schedule blocks
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
              accessibilityLabel="Close"
            >
              <X size={16} color="#4b5563" />
            </Pressable>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex-row items-center space-x-2">
              <AlertCircle size={15} color="#dc2626" />
              <Text className="text-xs text-red-700 font-semibold flex-1">
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Source Day Selector */}
          <View className="mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                1. SOURCE DAY (COPY FROM)
              </Text>
              <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-gray-600">
                  {sourceBlocksCount} session{sourceBlocksCount === 1 ? '' : 's'}
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-1 flex-row"
            >
              {DAYS.map((d) => {
                const isSelected = sourceDay === d.id;
                const count = baseSchedules.filter((b) => b.day_of_week === d.id).length;

                return (
                  <Pressable
                    key={`src-${d.id}`}
                    onPress={() => setSourceDay(d.id)}
                    className={`mx-1 px-3 py-2 rounded-xl flex-row items-center space-x-1.5 border transition-all ${
                      isSelected
                        ? 'bg-brand-600 border-brand-700 shadow-xs'
                        : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {d.short}
                    </Text>
                    {count > 0 && (
                      <View
                        className={`px-1 rounded-full ${
                          isSelected ? 'bg-brand-500' : 'bg-gray-200'
                        }`}
                      >
                        <Text
                          className={`text-[9px] font-extrabold ${
                            isSelected ? 'text-white' : 'text-gray-600'
                          }`}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {isSourceEmpty && (
              <View className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex-row items-center space-x-2">
                <AlertTriangle size={14} color="#d97706" />
                <Text className="text-[11px] font-semibold text-amber-800 flex-1">
                  {getDayName(sourceDay)} has no classes scheduled. Choose a day with classes to clone.
                </Text>
              </View>
            )}
          </View>

          {/* Direction Divider */}
          <View className="my-3 flex-row items-center justify-center">
            <View className="h-px bg-gray-100 flex-1" />
            <View className="mx-3 w-7 h-7 rounded-full bg-gray-100 items-center justify-center">
              <ArrowRight size={14} color="#6b7280" />
            </View>
            <View className="h-px bg-gray-100 flex-1" />
          </View>

          {/* Target Day Selector */}
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                2. TARGET DAY (COPY TO)
              </Text>
              <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-gray-600">
                  {targetBlocksCount} current
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-1 flex-row"
            >
              {DAYS.map((d) => {
                const isSelected = targetDay === d.id;
                const isSource = sourceDay === d.id;

                return (
                  <Pressable
                    key={`tgt-${d.id}`}
                    onPress={() => setTargetDay(d.id)}
                    disabled={isSource}
                    className={`mx-1 px-3 py-2 rounded-xl flex-row items-center space-x-1.5 border transition-all ${
                      isSource
                        ? 'bg-gray-100 border-gray-200 opacity-40'
                        : isSelected
                        ? 'bg-purple-600 border-purple-700 shadow-xs'
                        : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {d.short}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Overwrite Toggle */}
          <View className="mt-5 p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-bold text-gray-900">
                Overwrite Existing Classes
              </Text>
              <Text className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                {overrideExisting
                  ? `Replace all ${targetBlocksCount} current classes on ${getDayName(targetDay)}.`
                  : `Add cloned classes alongside existing ones on ${getDayName(targetDay)}.`}
              </Text>
            </View>
            <Switch
              value={overrideExisting}
              onValueChange={setOverrideExisting}
              trackColor={{ false: '#e5e7eb', true: '#c084fc' }}
              thumbColor={overrideExisting ? '#9333ea' : '#ffffff'}
            />
          </View>

          {/* Overwrite Warning Banner if Target Has Classes */}
          {targetBlocksCount > 0 && overrideExisting && (
            <View className="mt-2.5 p-2.5 bg-red-50 border border-red-200 rounded-xl flex-row items-center space-x-2">
              <AlertTriangle size={14} color="#dc2626" />
              <Text className="text-[11px] font-semibold text-red-700 flex-1">
                Warning: {targetBlocksCount} class{targetBlocksCount === 1 ? '' : 'es'} on {getDayName(targetDay)} will be permanently replaced.
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row items-center space-x-3 mt-6">
            <Pressable
              onPress={onClose}
              className="flex-1 py-3 rounded-2xl border border-gray-200 items-center justify-center active:bg-gray-50"
            >
              <Text className="text-xs font-bold text-gray-700">Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleClone}
              disabled={isSubmitDisabled}
              className={`flex-1 py-3 rounded-2xl flex-row items-center justify-center space-x-2 ${
                isSubmitDisabled
                  ? 'bg-gray-200 opacity-60'
                  : 'bg-brand-600 active:bg-brand-700 shadow-sm shadow-brand-600/30'
              }`}
            >
              {isCloning ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Copy size={15} color="#ffffff" strokeWidth={2.5} />
                  <Text className="text-xs font-bold text-white tracking-wide">
                    Clone Schedule
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
