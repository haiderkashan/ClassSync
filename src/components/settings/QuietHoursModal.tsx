// ============================================================================
// ClassSync Quiet Hours Settings Modal Component
// File: src/components/settings/QuietHoursModal.tsx
// Description: Soft, glassmorphic settings modal for Smart Quiet Hours with
//              master switch, web-safe time pickers, and urgent bypass toggle.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Switch,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Moon,
  Clock,
  BellRing,
  ShieldAlert,
  X,
  Check,
  Globe,
  Sparkles,
  ChevronDown,
} from 'lucide-react-native';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@clerk/expo';

// Dynamic import of native DateTimePicker with strict web guard
let NativeDateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    NativeDateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (e) {
    console.warn('[QuietHoursModal] Native datetimepicker not available:', e);
  }
}

export interface QuietHoursModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function QuietHoursModal({ visible, onClose, onSaved }: QuietHoursModalProps) {
  const supabase = useSupabase();
  const { user } = useUser();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Settings State
  const [quietHoursEnabled, setQuietHoursEnabled] = useState<boolean>(true);
  const [startTimeStr, setStartTimeStr] = useState<string>('22:00');
  const [endTimeStr, setEndTimeStr] = useState<string>('07:00');
  const [bypassForUrgent, setBypassForUrgent] = useState<boolean>(true);
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  // Native Picker Modal State
  const [showNativeStartPicker, setShowNativeStartPicker] = useState<boolean>(false);
  const [showNativeEndPicker, setShowNativeEndPicker] = useState<boolean>(false);

  // Fetch student's existing settings from Supabase
  useEffect(() => {
    if (!visible || !user?.id) return;

    let isMounted = true;
    async function loadSettings() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_notification_settings')
          .select('*')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (error) {
          console.error('[QuietHoursModal] Error loading settings:', error.message);
        } else if (data && isMounted) {
          setQuietHoursEnabled(data.quiet_hours_enabled);
          // Parse "HH:mm:ss" or "HH:mm" to "HH:mm"
          if (data.quiet_hours_start) {
            setStartTimeStr(data.quiet_hours_start.slice(0, 5));
          }
          if (data.quiet_hours_end) {
            setEndTimeStr(data.quiet_hours_end.slice(0, 5));
          }
          setBypassForUrgent(data.bypass_for_urgent);
          if (data.timezone) {
            setTimezone(data.timezone);
          }
        }
      } catch (err) {
        console.error('[QuietHoursModal] Unexpected error loading settings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadSettings();
    return () => {
      isMounted = false;
    };
  }, [visible, user?.id, supabase]);

  // Convert "HH:mm" to a Date object for the native picker
  const getTimeAsDate = (timeStr: string): Date => {
    const d = new Date();
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(isNaN(h) ? 22 : h, isNaN(m) ? 0 : m, 0, 0);
    return d;
  };

  // Convert Date object to "HH:mm"
  const formatDateToTimeString = (d: Date): string => {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Save Settings via Supabase RPC
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const startParam = `${startTimeStr}:00`;
      const endParam = `${endTimeStr}:00`;

      const { data, error } = await supabase.rpc('update_notification_settings', {
        p_quiet_hours_enabled: quietHoursEnabled,
        p_quiet_hours_start: startParam,
        p_quiet_hours_end: endParam,
        p_bypass_for_urgent: bypassForUrgent,
        p_timezone: timezone,
      });

      if (error) {
        Alert.alert('Error Saving Settings', error.message);
        return;
      }

      console.log('✅ [QuietHoursModal] Settings updated successfully:', data);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('[QuietHoursModal] Failed to save settings:', err);
      Alert.alert('Save Failed', err.message || 'Could not update notification settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-[36px] p-6 max-h-[90%] border-t border-neutral-100 shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-neutral-100 mb-4">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center mr-3 border border-indigo-100/60">
                <Moon size={20} color="#4F46E5" />
              </View>
              <View>
                <Text className="text-lg font-black text-neutral-900 tracking-tight">
                  Smart Quiet Hours
                </Text>
                <Text className="text-xs font-medium text-neutral-500">
                  Silence alerts during sleep & study
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="w-8 h-8 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200 transition-colors"
            >
              <X size={16} color="#71717a" />
            </Pressable>
          </View>

          {isLoading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text className="text-xs text-neutral-400 font-medium mt-3">
                Loading preferences...
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
              {/* 1. Master Toggle */}
              <View className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100/80 flex-row items-center justify-between mb-3">
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center">
                    <BellRing size={16} color={quietHoursEnabled ? '#4F46E5' : '#71717a'} />
                    <Text className="text-sm font-bold text-neutral-900 ml-2">
                      Enable Quiet Hours
                    </Text>
                  </View>
                  <Text className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Non-urgent notifications will be held in queue and dispatched at your morning wake time.
                  </Text>
                </View>

                <Switch
                  value={quietHoursEnabled}
                  onValueChange={setQuietHoursEnabled}
                  trackColor={{ false: '#e4e4e7', true: '#818CF8' }}
                  thumbColor={quietHoursEnabled ? '#4F46E5' : '#f4f4f5'}
                />
              </View>

              {quietHoursEnabled && (
                <>
                  {/* 2. Quiet Hours Interval Pickers */}
                  <View className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/60 mb-3">
                    <Text className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3">
                      Quiet Hours Window
                    </Text>

                    <View className="flex-row items-center justify-between gap-3 mb-3">
                      {/* Start Time */}
                      <View className="flex-1 bg-white p-3.5 rounded-2xl border border-neutral-200/70 shadow-xs">
                        <Text className="text-[11px] font-bold text-neutral-500 uppercase">
                          Sleep / Starts
                        </Text>
                        <Pressable
                          onPress={() => {
                            if (Platform.OS !== 'web') {
                              setShowNativeStartPicker(true);
                            }
                          }}
                          className="flex-row items-center justify-between mt-1.5"
                        >
                          <Text className="text-lg font-black text-neutral-900">
                            {startTimeStr}
                          </Text>
                          <Clock size={16} color="#6366F1" />
                        </Pressable>

                        {/* Web Fallback Input */}
                        {Platform.OS === 'web' && (
                          <View className="mt-2 pt-2 border-t border-neutral-100">
                            <TextInput
                              value={startTimeStr}
                              onChangeText={setStartTimeStr}
                              placeholder="22:00"
                              maxLength={5}
                              className="text-xs font-mono font-bold bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200 text-neutral-800"
                            />
                            <View className="flex-row gap-1 mt-1.5 flex-wrap">
                              {['21:00', '22:00', '23:00'].map((preset) => (
                                <Pressable
                                  key={preset}
                                  onPress={() => setStartTimeStr(preset)}
                                  className={`px-2 py-0.5 rounded-md border ${
                                    startTimeStr === preset
                                      ? 'bg-indigo-600 border-indigo-600'
                                      : 'bg-neutral-100 border-neutral-200'
                                  }`}
                                >
                                  <Text
                                    className={`text-[10px] font-bold ${
                                      startTimeStr === preset ? 'text-white' : 'text-neutral-700'
                                    }`}
                                  >
                                    {preset}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>

                      {/* End Time */}
                      <View className="flex-1 bg-white p-3.5 rounded-2xl border border-neutral-200/70 shadow-xs">
                        <Text className="text-[11px] font-bold text-neutral-500 uppercase">
                          Wake / Ends
                        </Text>
                        <Pressable
                          onPress={() => {
                            if (Platform.OS !== 'web') {
                              setShowNativeEndPicker(true);
                            }
                          }}
                          className="flex-row items-center justify-between mt-1.5"
                        >
                          <Text className="text-lg font-black text-neutral-900">
                            {endTimeStr}
                          </Text>
                          <Clock size={16} color="#10B981" />
                        </Pressable>

                        {/* Web Fallback Input */}
                        {Platform.OS === 'web' && (
                          <View className="mt-2 pt-2 border-t border-neutral-100">
                            <TextInput
                              value={endTimeStr}
                              onChangeText={setEndTimeStr}
                              placeholder="07:00"
                              maxLength={5}
                              className="text-xs font-mono font-bold bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200 text-neutral-800"
                            />
                            <View className="flex-row gap-1 mt-1.5 flex-wrap">
                              {['06:00', '07:00', '08:00'].map((preset) => (
                                <Pressable
                                  key={preset}
                                  onPress={() => setEndTimeStr(preset)}
                                  className={`px-2 py-0.5 rounded-md border ${
                                    endTimeStr === preset
                                      ? 'bg-emerald-600 border-emerald-600'
                                      : 'bg-neutral-100 border-neutral-200'
                                  }`}
                                >
                                  <Text
                                    className={`text-[10px] font-bold ${
                                      endTimeStr === preset ? 'text-white' : 'text-neutral-700'
                                    }`}
                                  >
                                    {preset}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text className="text-[11px] text-neutral-500 italic">
                      ✨ Interval spans overnight past midnight automatically.
                    </Text>
                  </View>

                  {/* 3. Urgent Overrides Toggle */}
                  <View className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/60 flex-row items-center justify-between mb-3">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center">
                        <ShieldAlert size={16} color="#D97706" />
                        <Text className="text-sm font-bold text-amber-950 ml-2">
                          Allow Urgent Overrides
                        </Text>
                      </View>
                      <Text className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                        Class cancellations, same-day delays, and room changes bypass Quiet Hours so you never walk to an empty room.
                      </Text>
                    </View>

                    <Switch
                      value={bypassForUrgent}
                      onValueChange={setBypassForUrgent}
                      trackColor={{ false: '#e4e4e7', true: '#FCD34D' }}
                      thumbColor={bypassForUrgent ? '#D97706' : '#f4f4f5'}
                    />
                  </View>
                </>
              )}

              {/* 4. Timezone Info Banner */}
              <View className="flex-row items-center p-3 bg-neutral-100/70 rounded-xl mb-4">
                <Globe size={14} color="#71717a" />
                <Text className="text-xs text-neutral-600 ml-2 flex-1 font-medium">
                  Active Timezone:{' '}
                  <Text className="font-bold text-neutral-800">{timezone}</Text>
                </Text>
              </View>

              {/* Native Date Picker Components (Native Only) */}
              {showNativeStartPicker && NativeDateTimePicker && (
                <NativeDateTimePicker
                  value={getTimeAsDate(startTimeStr)}
                  mode="time"
                  is24Hour={true}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_event: any, selectedDate?: Date) => {
                    setShowNativeStartPicker(false);
                    if (selectedDate) {
                      setStartTimeStr(formatDateToTimeString(selectedDate));
                    }
                  }}
                />
              )}

              {showNativeEndPicker && NativeDateTimePicker && (
                <NativeDateTimePicker
                  value={getTimeAsDate(endTimeStr)}
                  mode="time"
                  is24Hour={true}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_event: any, selectedDate?: Date) => {
                    setShowNativeEndPicker(false);
                    if (selectedDate) {
                      setEndTimeStr(formatDateToTimeString(selectedDate));
                    }
                  }}
                />
              )}

              {/* Save CTA */}
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                className="w-full bg-indigo-600 rounded-2xl py-3.5 items-center justify-center flex-row active:bg-indigo-700 shadow-md shadow-indigo-200 mt-2 mb-4"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Check size={18} color="#ffffff" />
                    <Text className="text-white font-bold text-sm ml-2">
                      Save Quiet Hours Settings
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
