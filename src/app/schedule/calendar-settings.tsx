import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Clock,
  Info,
  CheckCircle,
  PauseCircle,
  PlayCircle,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useSupabase } from '@/hooks/useSupabase';
import {
  getLocalDateString,
  calculateWeekParity,
  formatAcademicWeekLabel,
  getInstructionalWeekNumber,
  CalendarBreak,
  CycleNamingConvention,
} from '@/lib/schedule/calendarUtils';

export default function CalendarSettingsModal() {
  const router = useRouter();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { activeSection } = useWorkspaces();

  const isGenesisCR = activeSection?.role === 'genesis_cr';
  const isCR = isGenesisCR || activeSection?.role === 'co_admin';

  // Cycle Configuration State
  const [cycleMode, setCycleMode] = useState<'standard_weekly' | 'alternating_ab'>('standard_weekly');
  const [namingConvention, setNamingConvention] = useState<CycleNamingConvention>('week_ab');
  const [anchorDate, setAnchorDate] = useState<string>('');
  const [semesterStart, setSemesterStart] = useState<string>('');
  const [totalWeeks, setTotalWeeks] = useState<string>('16');
  const [isSavingCycle, setIsSavingCycle] = useState(false);

  // Breaks Management State
  const [breaks, setBreaks] = useState<CalendarBreak[]>([]);
  const [isLoadingBreaks, setIsLoadingBreaks] = useState(true);
  const [isAddingBreak, setIsAddingBreak] = useState(false);
  const [newBreakName, setNewBreakName] = useState('');
  const [newBreakStart, setNewBreakStart] = useState('');
  const [newBreakEnd, setNewBreakEnd] = useState('');
  const [newBreakFreeze, setNewBreakFreeze] = useState(true);
  const [isSavingBreak, setIsSavingBreak] = useState(false);

  // Hydrate initial state from active section
  useEffect(() => {
    if (activeSection) {
      setCycleMode(
        (activeSection.cycle_mode as any) === 'alternating_ab'
          ? 'alternating_ab'
          : 'standard_weekly'
      );
      setNamingConvention(
        ((activeSection as any).cycle_naming_convention as CycleNamingConvention) || 'week_ab'
      );
      setAnchorDate(activeSection.week_a_anchor_date || '');
      setSemesterStart((activeSection as any).semester_start_date || '');
      setTotalWeeks(String((activeSection as any).total_instructional_weeks || 16));
    }
  }, [activeSection]);

  // Fetch breaks from Supabase
  useEffect(() => {
    if (!activeSection?.id) return;

    async function fetchBreaks() {
      setIsLoadingBreaks(true);
      try {
        const { data, error } = await supabase
          .from('section_calendar_breaks')
          .select('*')
          .eq('section_id', activeSection!.id)
          .order('start_date', { ascending: true });

        if (error) {
          console.warn('⚠️ [CalendarSettings] Failed to fetch calendar breaks:', error.message);
        } else if (data) {
          setBreaks(data as CalendarBreak[]);
        }
      } catch (err) {
        console.error('❌ [CalendarSettings] Unexpected error fetching breaks:', err);
      } finally {
        setIsLoadingBreaks(false);
      }
    }

    void fetchBreaks();
  }, [activeSection?.id, supabase]);

  const handleSaveCycle = async () => {
    if (!activeSection?.id) return;

    if (cycleMode === 'alternating_ab' && !anchorDate.trim()) {
      Alert.alert('Required Field', 'Please provide a Week A anchor date (e.g. 2026-08-24).');
      return;
    }

    setIsSavingCycle(true);
    try {
      const parsedWeeks = parseInt(totalWeeks, 10);
      const { error } = await supabase.rpc('update_section_cycle_settings', {
        p_section_id: activeSection.id,
        p_cycle_mode: cycleMode,
        p_week_a_anchor_date: cycleMode === 'alternating_ab' ? anchorDate.trim() : undefined,
        p_cycle_naming_convention: namingConvention,
        p_semester_start_date: semesterStart.trim() || undefined,
        p_total_instructional_weeks: isNaN(parsedWeeks) ? 16 : parsedWeeks,
      });

      if (error) {
        Alert.alert('Save Failed', error.message);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      Alert.alert('Success', 'Academic calendar settings updated successfully.');
    } catch (err: any) {
      console.error('[CalendarSettings] Error updating cycle settings:', err);
      Alert.alert('Error', err.message || 'Failed to update cycle settings');
    } finally {
      setIsSavingCycle(false);
    }
  };

  const handleAddBreak = async () => {
    if (!activeSection?.id) return;
    if (!newBreakName.trim()) {
      Alert.alert('Validation Error', 'Please enter a name for the break (e.g. Fall Reading Week).');
      return;
    }
    if (!newBreakStart.trim() || !newBreakEnd.trim()) {
      Alert.alert('Validation Error', 'Please specify both start and end dates (YYYY-MM-DD).');
      return;
    }
    if (newBreakStart.trim() > newBreakEnd.trim()) {
      Alert.alert('Validation Error', 'Start date must be before or equal to end date.');
      return;
    }

    setIsSavingBreak(true);
    try {
      const { data, error } = await supabase.rpc('upsert_calendar_break', {
        p_id: null as any,
        p_section_id: activeSection.id,
        p_break_name: newBreakName.trim(),
        p_start_date: newBreakStart.trim(),
        p_end_date: newBreakEnd.trim(),
        p_freeze_cycle: newBreakFreeze,
      });

      if (error) {
        Alert.alert('Failed to Add Break', error.message);
        return;
      }

      if (data) {
        setBreaks((prev) => [...prev, data as CalendarBreak].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      }

      setNewBreakName('');
      setNewBreakStart('');
      setNewBreakEnd('');
      setNewBreakFreeze(true);
      setIsAddingBreak(false);
      Alert.alert('Break Added', 'Academic break registered and synced.');
    } catch (err: any) {
      console.error('[CalendarSettings] Error creating break:', err);
      Alert.alert('Error', err.message || 'Failed to add break');
    } finally {
      setIsSavingBreak(false);
    }
  };

  const handleDeleteBreak = (breakItem: CalendarBreak) => {
    if (!breakItem.id) return;

    Alert.alert(
      'Delete Academic Break',
      `Are you sure you want to remove "${breakItem.break_name}"? Parity calculations will re-adjust immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_calendar_break', {
                p_break_id: breakItem.id!,
              });

              if (error) {
                Alert.alert('Error', error.message);
                return;
              }

              setBreaks((prev) => prev.filter((b) => b.id !== breakItem.id));
            } catch (err) {
              console.error('[CalendarSettings] Error deleting break:', err);
              Alert.alert('Error', 'Failed to delete break');
            }
          },
        },
      ]
    );
  };

  // Generate 4-week preview Mondays
  const previewMondays = React.useMemo(() => {
    const list: string[] = [];
    const base = anchorDate.trim() || getLocalDateString(new Date(), activeSection?.timezone || 'UTC');
    const [y, m, d] = base.slice(0, 10).split('-').map(Number);
    const baseUtc = Date.UTC(y, m - 1, d);

    // Normalize to Monday
    const dateObj = new Date(baseUtc);
    const day = dateObj.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const mondayMs = baseUtc + diffToMonday * 86400000;

    for (let i = 0; i < 4; i++) {
      const mon = new Date(mondayMs + i * 7 * 86400000);
      const str = `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}`;
      list.push(str);
    }
    return list;
  }, [anchorDate, activeSection?.timezone]);

  if (!isCR) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center p-6">
        <Info size={32} color="#94a3b8" />
        <Text className="text-base font-bold text-neutral-900 mt-3 mb-1">
          Administrator Access Required
        </Text>
        <Text className="text-xs text-neutral-500 text-center mb-6">
          Only the Genesis Class Representative or Co-Admins can configure the academic cycle and term breaks.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-neutral-900 px-6 py-2.5 rounded-full active:bg-neutral-800"
        >
          <Text className="text-xs font-bold text-white">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-[#F8F9FA]">
      {/* Header */}
      <View className="px-5 py-3.5 bg-white border-b border-neutral-100 flex-row items-center justify-between">
        <View className="flex-row items-center space-x-2">
          <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center">
            <Calendar size={16} color="#4F46E5" />
          </View>
          <View>
            <Text className="text-sm font-black text-neutral-900">Academic Calendar</Text>
            <Text className="text-[10px] font-medium text-neutral-400">
              {activeSection?.name || 'Section'} • Cycle & Breaks
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.back()}
          className="w-8 h-8 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
        >
          <X size={16} color="#71717a" />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Recurrence Mode Selector */}
        <View className="bg-white rounded-3xl p-5 border border-neutral-100/90 shadow-2xs mb-4">
          <Text className="text-xs font-black text-neutral-900 uppercase tracking-wider mb-1">
            Timetable Recurrence Mode
          </Text>
          <Text className="text-[11px] text-neutral-500 mb-3.5 leading-relaxed">
            Choose whether classes repeat identically each week or follow an alternating multi-week cycle.
          </Text>

          <View className="flex-row p-1 bg-neutral-100/90 rounded-full mb-2">
            <Pressable
              onPress={() => setCycleMode('standard_weekly')}
              className={`flex-1 py-2 rounded-full items-center justify-center ${
                cycleMode === 'standard_weekly' ? 'bg-white shadow-2xs' : ''
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  cycleMode === 'standard_weekly' ? 'text-neutral-900' : 'text-neutral-500'
                }`}
              >
                Standard Weekly
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setCycleMode('alternating_ab')}
              className={`flex-1 py-2 rounded-full items-center justify-center ${
                cycleMode === 'alternating_ab' ? 'bg-white shadow-2xs' : ''
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  cycleMode === 'alternating_ab' ? 'text-neutral-900' : 'text-neutral-500'
                }`}
              >
                Alternating Cycles
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Alternating Cycle Taxonomy & Anchor Configuration */}
        {cycleMode === 'alternating_ab' && (
          <View className="bg-white rounded-3xl p-5 border border-neutral-100/90 shadow-2xs mb-4">
            <Text className="text-xs font-black text-neutral-900 uppercase tracking-wider mb-1">
              Cycle Taxonomy & Anchor Date
            </Text>
            <Text className="text-[11px] text-neutral-500 mb-3.5 leading-relaxed">
              Match your institution's specific naming convention and designate the reference week.
            </Text>

            {/* Naming Taxonomy Pills */}
            <Text className="text-[11px] font-bold text-neutral-700 mb-2">Naming Convention</Text>
            <View className="flex-row space-x-2 mb-4">
              {[
                { key: 'week_ab', label: 'Week A / B' },
                { key: 'odd_even', label: 'Odd / Even' },
                { key: 'cycle_12', label: 'Cycle 1 / 2' },
              ].map((item) => {
                const isSelected = namingConvention === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setNamingConvention(item.key as CycleNamingConvention)}
                    className={`flex-1 py-2 rounded-xl border items-center justify-center ${
                      isSelected
                        ? 'bg-neutral-900 border-neutral-900'
                        : 'bg-neutral-50 border-neutral-200 active:bg-neutral-100'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-bold ${
                        isSelected ? 'text-white' : 'text-neutral-600'
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Anchor Date Input */}
            <Text className="text-[11px] font-bold text-neutral-700 mb-1">
              Anchor Week Date (Monday)
            </Text>
            <Text className="text-[10px] text-neutral-400 mb-2">
              The date of any Monday that corresponds to Week A / Odd Week / Cycle 1.
            </Text>
            <View className="flex-row items-center gap-2 mb-4">
              <TextInput
                value={anchorDate}
                onChangeText={setAnchorDate}
                placeholder="e.g. 2026-08-24"
                placeholderTextColor="#a1a1aa"
                className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-900"
              />
              <Pressable
                onPress={() => {
                  const todayStr = getLocalDateString(new Date(), activeSection?.timezone || 'UTC');
                  setAnchorDate(todayStr);
                }}
                className="bg-neutral-100 border border-neutral-200 px-3.5 py-2.5 rounded-xl active:bg-neutral-200"
              >
                <Text className="text-[11px] font-bold text-neutral-700">Set Today</Text>
              </Pressable>
            </View>

            {/* Optional Semester Start & Total Weeks */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-[11px] font-bold text-neutral-700 mb-1">Semester Start</Text>
                <TextInput
                  value={semesterStart}
                  onChangeText={setSemesterStart}
                  placeholder="e.g. 2026-08-24"
                  placeholderTextColor="#a1a1aa"
                  className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900"
                />
              </View>
              <View className="w-28">
                <Text className="text-[11px] font-bold text-neutral-700 mb-1">Total Weeks</Text>
                <TextInput
                  value={totalWeeks}
                  onChangeText={setTotalWeeks}
                  keyboardType="numeric"
                  placeholder="16"
                  placeholderTextColor="#a1a1aa"
                  className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 text-center"
                />
              </View>
            </View>
          </View>
        )}

        {/* Live 4-Week Preview Strip */}
        {cycleMode === 'alternating_ab' && anchorDate.trim().length >= 10 && (
          <View className="bg-white rounded-3xl p-5 border border-neutral-100/90 shadow-2xs mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                Live Calendar Preview
              </Text>
              <Sparkles size={14} color="#6366f1" />
            </View>
            <Text className="text-[11px] text-neutral-500 mb-3">
              Computed cycle projection factoring in configured term breaks:
            </Text>

            <View className="space-y-2">
              {previewMondays.map((mondayStr) => {
                const parity = calculateWeekParity(mondayStr, anchorDate, cycleMode, breaks);
                const weekNum = getInstructionalWeekNumber(mondayStr, semesterStart || anchorDate, breaks);
                const label = formatAcademicWeekLabel({
                  parity,
                  weekNumber: weekNum,
                  namingConvention,
                });
                return (
                  <View
                    key={mondayStr}
                    className="flex-row items-center justify-between p-2.5 bg-neutral-50 rounded-2xl border border-neutral-150"
                  >
                    <View className="flex-row items-center space-x-2">
                      <Clock size={12} color="#71717a" />
                      <Text className="text-xs font-bold text-neutral-800">{mondayStr}</Text>
                    </View>
                    <View
                      className={`px-2.5 py-0.5 rounded-full border ${
                        parity === 'biweekly_week_a'
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-indigo-50 border-indigo-200'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-black ${
                          parity === 'biweekly_week_a' ? 'text-emerald-700' : 'text-indigo-700'
                        }`}
                      >
                        {label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Save Cycle Settings Button */}
        <Pressable
          onPress={handleSaveCycle}
          disabled={isSavingCycle}
          className="w-full py-3.5 bg-neutral-900 rounded-full items-center justify-center active:bg-neutral-800 shadow-sm mb-6"
        >
          {isSavingCycle ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-xs font-bold text-white">Save Calendar Configuration</Text>
          )}
        </Pressable>

        {/* Academic Breaks & Reading Weeks Section */}
        <View className="bg-white rounded-3xl p-5 border border-neutral-100/90 shadow-2xs mb-8">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs font-black text-neutral-900 uppercase tracking-wider">
              Term Breaks & Reading Weeks
            </Text>
            <Pressable
              onPress={() => setIsAddingBreak(!isAddingBreak)}
              className="flex-row items-center bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full active:bg-indigo-100"
            >
              <Plus size={12} color="#4F46E5" />
              <Text className="text-[10px] font-bold text-indigo-700 ml-1">
                {isAddingBreak ? 'Cancel' : 'Add Break'}
              </Text>
            </Pressable>
          </View>
          <Text className="text-[11px] text-neutral-500 mb-4 leading-relaxed">
            Register breaks, reading weeks, and holidays. Pausing the cycle prevents parity drift across breaks.
          </Text>

          {/* Add Break Form */}
          {isAddingBreak && (
            <View className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 mb-4">
              <Text className="text-xs font-black text-indigo-950 mb-2">New Academic Break</Text>
              <TextInput
                value={newBreakName}
                onChangeText={setNewBreakName}
                placeholder="e.g. Fall Reading Week"
                placeholderTextColor="#a1a1aa"
                className="bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 mb-3"
              />

              <View className="flex-row gap-2 mb-3">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-neutral-600 mb-1">Start Date</Text>
                  <TextInput
                    value={newBreakStart}
                    onChangeText={setNewBreakStart}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#a1a1aa"
                    className="bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-neutral-600 mb-1">End Date</Text>
                  <TextInput
                    value={newBreakEnd}
                    onChangeText={setNewBreakEnd}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#a1a1aa"
                    className="bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900"
                  />
                </View>
              </View>

              <View className="flex-row items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 mb-3">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-bold text-neutral-900">Pause Alternating Cycle</Text>
                  <Text className="text-[10px] text-neutral-400">
                    Cycle parity freezes during this break and resumes where it left off.
                  </Text>
                </View>
                <Switch
                  value={newBreakFreeze}
                  onValueChange={setNewBreakFreeze}
                  trackColor={{ false: '#e4e4e7', true: '#4f46e5' }}
                  thumbColor="#ffffff"
                />
              </View>

              <Pressable
                onPress={handleAddBreak}
                disabled={isSavingBreak}
                className="w-full py-2.5 bg-indigo-600 rounded-full items-center justify-center active:bg-indigo-700"
              >
                {isSavingBreak ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-xs font-bold text-white">Save Academic Break</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* List of Configured Breaks */}
          {isLoadingBreaks ? (
            <ActivityIndicator size="small" color="#4f46e5" className="py-4" />
          ) : breaks.length === 0 ? (
            <View className="py-6 items-center justify-center">
              <CheckCircle size={24} color="#94a3b8" />
              <Text className="text-xs font-bold text-neutral-400 mt-2">
                No term breaks configured
              </Text>
              <Text className="text-[10px] text-neutral-400 text-center mt-0.5">
                The weekly schedule will run continuously across the semester.
              </Text>
            </View>
          ) : (
            <View className="space-y-2.5">
              {breaks.map((b) => (
                <View
                  key={b.id || b.break_name}
                  className="p-3 bg-neutral-50 rounded-2xl border border-neutral-150 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center space-x-1.5 mb-0.5">
                      <Text className="text-xs font-bold text-neutral-900">{b.break_name}</Text>
                      {b.freeze_cycle ? (
                        <View className="flex-row items-center bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded-full">
                          <PauseCircle size={10} color="#7c3aed" />
                          <Text className="text-[9px] font-bold text-purple-700 ml-0.5">Cycle Frozen</Text>
                        </View>
                      ) : (
                        <View className="flex-row items-center bg-neutral-200/80 px-1.5 py-0.2 rounded-full">
                          <PlayCircle size={10} color="#52525b" />
                          <Text className="text-[9px] font-bold text-neutral-600 ml-0.5">Continuous</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-[10px] font-semibold text-neutral-500">
                      {b.start_date} → {b.end_date}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleDeleteBreak(b)}
                    className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center active:bg-rose-100"
                  >
                    <Trash2 size={13} color="#e11d48" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
