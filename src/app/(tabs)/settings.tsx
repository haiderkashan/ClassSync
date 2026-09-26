import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser, useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import {
  LogOut,
  Mail,
  ShieldCheck,
  User as UserIcon,
  School,
  BookOpen,
  Plus,
  LogIn,
  Crown,
  Bell,
  Copy,
  Check,
  Users,
  Archive,
  Trash2,
  Calendar,
  Calculator,
  ChevronRight,
  Moon,
  Clock,
  QrCode,
  Sparkles,
  RefreshCw,
  TrendingUp,
  HelpCircle,
  FileText,
  ExternalLink,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useSupabase } from '@/hooks/useSupabase';
import { useAppStore } from '@/store/useAppStore';
import { useAttendance } from '@/hooks/useAttendance';
import { QuietHoursModal } from '@/components/settings/QuietHoursModal';
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal';
import { resetLocalDatabase } from '@/lib/db/localDatabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const supabase = useSupabase();

  const { sections, courses, activeSection, isLoading: isWorkspaceLoading, refetch: refetchWorkspaces } = useWorkspaces();
  const { setActiveCourses, setActiveSectionId, reset } = useAppStore();
  const { overallMetrics, getCourseMetrics } = useAttendance();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [isSyncingDb, setIsSyncingDb] = useState(false);

  // Cycle Mode & Week A Anchor Date State for Genesis CR
  const [cycleMode, setCycleMode] = useState<'standard_weekly' | 'alternating_ab'>('standard_weekly');
  const [weekAAnchorDate, setWeekAAnchorDate] = useState<string>('');
  const [isSavingCycleSettings, setIsSavingCycleSettings] = useState(false);

  // Quiet Hours Modal & Settings State
  const [isQuietHoursModalOpen, setIsQuietHoursModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [quietHoursSettings, setQuietHoursSettings] = useState<{
    enabled: boolean;
    start: string;
    end: string;
    bypass: boolean;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    async function fetchQuietSettings() {
      const { data } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (data) {
        setQuietHoursSettings({
          enabled: data.quiet_hours_enabled,
          start: data.quiet_hours_start ? data.quiet_hours_start.slice(0, 5) : '22:00',
          end: data.quiet_hours_end ? data.quiet_hours_end.slice(0, 5) : '07:00',
          bypass: data.bypass_for_urgent,
        });
      }
    }
    void fetchQuietSettings();
  }, [user?.id, supabase]);

  const isGenesisCR = activeSection?.role === 'genesis_cr';
  const isCR = isGenesisCR || activeSection?.role === 'co_admin';

  useEffect(() => {
    if (activeSection) {
      setCycleMode(
        (activeSection.cycle_mode as any) === 'alternating_ab'
          ? 'alternating_ab'
          : 'standard_weekly'
      );
      setWeekAAnchorDate(activeSection.week_a_anchor_date || '');
    }
  }, [activeSection?.id, activeSection?.cycle_mode, activeSection?.week_a_anchor_date]);

  const handleSaveCycleSettings = async () => {
    if (!activeSection?.id) return;
    if (cycleMode === 'alternating_ab' && !weekAAnchorDate.trim()) {
      Alert.alert('Required Field', 'Please provide a Week A anchor date (e.g. 2026-08-24).');
      return;
    }

    setIsSavingCycleSettings(true);
    try {
      const { error } = await supabase.rpc('update_section_cycle_settings', {
        p_section_id: activeSection.id,
        p_cycle_mode: cycleMode,
        p_week_a_anchor_date: cycleMode === 'alternating_ab' ? weekAAnchorDate.trim() : undefined,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      Alert.alert('Success', 'Semester cycle settings updated successfully.');
    } catch (err: any) {
      console.error('[Settings] Error updating cycle settings:', err);
      Alert.alert('Error', err.message || 'Failed to update cycle settings');
    } finally {
      setIsSavingCycleSettings(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      resetLocalDatabase();
      reset();
      try {
        if (useAppStore.persist?.clearStorage) {
          useAppStore.persist.clearStorage();
        }
        await AsyncStorage.removeItem('classsync-app-storage');
      } catch (storageErr) {
        console.warn('⚠️ [Settings] Failed to clear AsyncStorage on logout:', storageErr);
      }
      queryClient.clear();
      await signOut();
    } catch (error) {
      console.error('[Settings] Error signing out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleOpenSupport = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://classsync.app/support');
    } catch (e) {
      console.warn('Unable to open Support URL', e);
    }
  };

  const handleOpenPrivacy = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://classsync.app/privacy');
    } catch (e) {
      console.warn('Unable to open Privacy Policy URL', e);
    }
  };

  const handleOpenTerms = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://classsync.app/terms');
    } catch (e) {
      console.warn('Unable to open Terms URL', e);
    }
  };

  const handleCopyGuestCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('[Settings] Failed to copy code:', err);
    }
  };

  const handleToggleCourse = async (courseId: string, currentStatus: boolean) => {
    if (!user?.id) return;
    const nextStatus = !currentStatus;

    const previousCourses = courses;
    const updatedCourses = courses.map((course) =>
      course.id === courseId ? { ...course, is_active: nextStatus } : course
    );
    setActiveCourses(updatedCourses);
    setTogglingCourseId(courseId);

    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ is_active: nextStatus })
        .match({ course_id: courseId, user_id: user.id });

      if (error) {
        console.error('[Settings] Failed to toggle course enrollment:', error.message);
        setActiveCourses(previousCourses);
      }
    } catch (err) {
      console.error('[Settings] Unexpected error toggling course enrollment:', err);
      setActiveCourses(previousCourses);
    } finally {
      setTogglingCourseId(null);
    }
  };

  const handleLeaveSection = () => {
    if (!activeSection?.id) return;

    Alert.alert(
      'Leave Section',
      `Are you sure you want to leave "${activeSection.name}"? You will be unenrolled from this section and its courses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setIsPerformingAction(true);
            try {
              const { error } = await supabase.rpc('leave_section', {
                p_section_id: activeSection.id,
              });

              if (error) {
                Alert.alert('Cannot Leave', error.message);
                setIsPerformingAction(false);
                return;
              }

              await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
              Alert.alert('Left Section', `You have left "${activeSection.name}".`);
            } catch (err) {
              console.error('[Settings] Error leaving section:', err);
              Alert.alert('Error', 'Failed to leave section.');
            } finally {
              setIsPerformingAction(false);
            }
          },
        },
      ]
    );
  };

  const handleArchiveSection = () => {
    if (!activeSection?.id) return;

    Alert.alert(
      'Archive Section',
      `Are you sure you want to archive "${activeSection.name}"? This dismantles the section and removes active access for all members.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive Section',
          style: 'destructive',
          onPress: async () => {
            setIsPerformingAction(true);
            try {
              const { error } = await supabase.rpc('archive_section', {
                p_section_id: activeSection.id,
              });

              if (error) {
                Alert.alert('Cannot Archive', error.message);
                setIsPerformingAction(false);
                return;
              }

              await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
              Alert.alert('Section Archived', `"${activeSection.name}" has been archived.`);
            } catch (err) {
              console.error('[Settings] Error archiving section:', err);
              Alert.alert('Error', 'Failed to archive section.');
            } finally {
              setIsPerformingAction(false);
            }
          },
        },
      ]
    );
  };

  const handleSyncDatabase = async () => {
    setIsSyncingDb(true);
    try {
      await queryClient.invalidateQueries();
      await refetchWorkspaces();
      Alert.alert('Database Synchronized', 'All local schedules, courses, and section profiles are up-to-date.');
    } catch (err) {
      console.warn('Sync warning:', err);
    } finally {
      setIsSyncingDb(false);
    }
  };

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Student';

  const email = user?.primaryEmailAddress?.emailAddress || 'No email attached';
  const avatarUrl = user?.imageUrl;

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'left', 'right']}>
      {/* 1. Header */}
      <View className="px-5 pt-2 pb-3 bg-white border-b border-neutral-200/80">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xl font-black text-neutral-900 tracking-tight">
              Settings & Profile
            </Text>
            <View className="flex-row items-center space-x-1.5 mt-0.5">
              <View className="w-1.5 h-1.5 rounded-full bg-[#FACC15]" />
              <Text className="text-xs text-neutral-500 font-semibold" numberOfLines={1}>
                {activeSection?.name || 'Academic Cohort'} • {activeSection?.institution_tag || 'Campus'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleSyncDatabase}
            disabled={isSyncingDb}
            className="w-9 h-9 rounded-full bg-neutral-100 border border-neutral-200/80 items-center justify-center active:bg-neutral-200"
            accessibilityLabel="Sync Database"
          >
            {isSyncingDb ? (
              <ActivityIndicator size="small" color="#18181B" />
            ) : (
              <RefreshCw size={16} color="#18181B" />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* 2. User Profile Hero Card */}
        <View className="mb-4 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
          <View className="flex-row items-center space-x-3">
            <View className="relative">
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  className="w-14 h-14 rounded-2xl bg-neutral-100"
                />
              ) : (
                <View className="w-14 h-14 rounded-2xl bg-[#FACC15] items-center justify-center shadow-xs">
                  <UserIcon size={26} color="#18181B" strokeWidth={2.4} />
                </View>
              )}
              {/* Online Synced Indicator Dot */}
              <View className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white items-center justify-center" />
            </View>

            <View className="flex-1 ml-1.5">
              <Text className="text-base font-black text-neutral-900 tracking-tight" numberOfLines={1}>
                {displayName}
              </Text>
              <Text className="text-xs text-neutral-500 font-medium" numberOfLines={1}>
                {email}
              </Text>

              <View className="flex-row items-center space-x-1.5 mt-1.5">
                {isCR ? (
                  <View className="px-2 py-0.5 rounded-full bg-[#FACC15]/20 border border-[#FACC15]/60 flex-row items-center space-x-1">
                    <Crown size={10} color="#854D0E" strokeWidth={2.5} />
                    <Text className="text-[10px] font-black text-amber-950 uppercase ml-0.5">
                      {isGenesisCR ? 'Genesis CR' : 'Co-Admin'}
                    </Text>
                  </View>
                ) : (
                  <View className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200 flex-row items-center space-x-1">
                    <ShieldCheck size={10} color="#71717A" />
                    <Text className="text-[10px] font-bold text-neutral-600 uppercase ml-0.5">
                      Verified Student
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* 3. Cohort & Section Management Card */}
        <View className="mb-4 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
          <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2.5">
            COHORT & SECTION CONTROL
          </Text>

          {activeSection ? (
            <View>
              <View className="flex-row items-center justify-between p-3 rounded-2xl bg-neutral-50 border border-neutral-200/70 mb-3">
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-black text-neutral-900" numberOfLines={1}>
                    {activeSection.name}
                  </Text>
                  <Text className="text-[11px] text-neutral-500 font-medium">
                    Timezone: {activeSection.timezone || 'UTC'}
                  </Text>
                </View>

                {activeSection.join_code && (
                  <Pressable
                    onPress={() => handleCopyGuestCode(activeSection.join_code!)}
                    className="flex-row items-center space-x-1 bg-[#FACC15]/20 border border-[#FACC15]/60 px-3 py-1.5 rounded-xl active:bg-[#FACC15]/30"
                  >
                    <Text className="text-xs font-mono font-black text-neutral-900">
                      #{activeSection.join_code}
                    </Text>
                    {copiedCode === activeSection.join_code ? (
                      <Check size={12} color="#059669" />
                    ) : (
                      <Copy size={12} color="#854D0E" />
                    )}
                  </Pressable>
                )}
              </View>

              {/* Presenter QR HUD Primary Action Button */}
              <Pressable
                onPress={() => router.push('/cohort/presenter-hud')}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FACC15] items-center justify-center flex-row space-x-2 shadow-sm active:bg-yellow-400 mb-3"
              >
                <QrCode size={18} color="#18181B" strokeWidth={2.5} />
                <Text className="text-sm font-black text-neutral-950 tracking-wide ml-1.5">
                  Launch Presenter QR HUD
                </Text>
              </Pressable>

              {/* Section Sub-actions */}
              <View className="flex-row items-center space-x-2">
                {isCR && (
                  <Pressable
                    onPress={() => router.push('/section-members')}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-100 border border-neutral-200/80 items-center justify-center active:bg-neutral-200"
                  >
                    <Text className="text-xs font-bold text-neutral-800">
                      Manage Roster
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => router.push('/join-section')}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-100 border border-neutral-200/80 items-center justify-center active:bg-neutral-200"
                >
                  <Text className="text-xs font-bold text-neutral-800">
                    Switch Section
                  </Text>
                </Pressable>
              </View>

              {/* Leave Section */}
              <Pressable
                onPress={handleLeaveSection}
                disabled={isPerformingAction}
                className="mt-2.5 py-2 items-center justify-center"
              >
                <Text className="text-xs font-bold text-rose-600">
                  Leave This Section
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="py-4 items-center justify-center">
              <Text className="text-xs text-neutral-500 font-medium mb-3">
                You are not currently enrolled in any class section.
              </Text>
              <View className="flex-row items-center space-x-2">
                <Pressable
                  onPress={() => router.push('/join-section')}
                  className="px-4 py-2.5 bg-[#FACC15] rounded-xl active:bg-yellow-400"
                >
                  <Text className="text-xs font-black text-neutral-950">Join Section</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/create-section')}
                  className="px-4 py-2.5 bg-neutral-900 rounded-xl active:bg-neutral-800"
                >
                  <Text className="text-xs font-bold text-white">Create Section</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* 4. Academic Attendance & Analytics Quick Card */}
        <View className="mb-4 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
              ATTENDANCE & BUNK ANALYTICS
            </Text>
            <View className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 flex-row items-center space-x-1">
              <TrendingUp size={10} color="#059669" />
              <Text className="text-[10px] font-black text-emerald-800 ml-0.5">
                {overallMetrics.percentage}% Overall
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between py-2">
            <View>
              <Text className="text-xs font-black text-neutral-900">
                {overallMetrics.skipsAllowed > 0
                  ? `${overallMetrics.skipsAllowed} safe skip(s) available`
                  : overallMetrics.recoveryNeeded > 0
                  ? `${overallMetrics.recoveryNeeded} recovery classes needed`
                  : 'Target 75% threshold maintained'}
              </Text>
              <Text className="text-[11px] text-neutral-500 font-medium mt-0.5">
                {overallMetrics.attended} of {overallMetrics.totalHeld} held sessions attended
              </Text>
            </View>

            <Pressable
              onPress={() => router.push('/attendance/course-metrics')}
              className="px-3 py-2 bg-neutral-100 rounded-xl active:bg-neutral-200 flex-row items-center space-x-1"
            >
              <Text className="text-xs font-bold text-neutral-800">Simulator</Text>
              <ChevronRight size={13} color="#18181B" />
            </Pressable>
          </View>
        </View>

        {/* 5. Semester Configuration (CR Only) */}
        {isCR && activeSection && (
          <View className="mb-4 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
            <View className="flex-row items-center space-x-1.5 mb-2.5">
              <Crown size={12} color="#B45309" />
              <Text className="text-[10px] font-black text-amber-950 uppercase tracking-wider">
                CR ADMIN PANEL • SEMESTER CONFIG
              </Text>
            </View>

            {/* Alternating Week Mode Switch */}
            <View className="flex-row items-center justify-between py-2 border-b border-neutral-100">
              <View className="flex-1 mr-3">
                <Text className="text-xs font-bold text-neutral-900">
                  Alternating Week Parity (Week A / B)
                </Text>
                <Text className="text-[11px] text-neutral-500 font-medium">
                  {cycleMode === 'alternating_ab'
                    ? 'Active: Alternating fortnightly timetable'
                    : 'Standard single-week recurring timetable'}
                </Text>
              </View>
              <Switch
                value={cycleMode === 'alternating_ab'}
                onValueChange={(val) =>
                  setCycleMode(val ? 'alternating_ab' : 'standard_weekly')
                }
                trackColor={{ false: '#e4e4e7', true: '#FACC15' }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Week A Anchor Date Input */}
            {cycleMode === 'alternating_ab' && (
              <View className="py-2.5">
                <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-1">
                  WEEK A ANCHOR DATE (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={weekAAnchorDate}
                  onChangeText={setWeekAAnchorDate}
                  placeholder="2026-08-24"
                  placeholderTextColor="#A1A1AA"
                  className="bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs font-mono font-bold text-neutral-900"
                />
              </View>
            )}

            <Pressable
              onPress={handleSaveCycleSettings}
              disabled={isSavingCycleSettings}
              className="mt-2.5 py-2.5 bg-neutral-900 rounded-xl items-center justify-center active:bg-neutral-800"
            >
              {isSavingCycleSettings ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-xs font-bold text-white">
                  Save Semester Settings
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.push('/schedule/calendar-settings')}
              className="mt-2 py-2.5 bg-neutral-100 border border-neutral-200/80 rounded-xl items-center justify-center active:bg-neutral-200"
            >
              <Text className="text-xs font-bold text-neutral-800">
                Manage Term Breaks & Calendar
              </Text>
            </Pressable>
          </View>
        )}

        {/* 6. Alerts & Quiet Hours */}
        <View className="mb-4 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
          <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2.5">
            ALERTS & QUIET HOURS
          </Text>

          <View className="flex-row items-center justify-between py-2 border-b border-neutral-100">
            <View className="flex-row items-center space-x-2.5 flex-1 mr-2">
              <Moon size={16} color="#71717A" />
              <View className="flex-1">
                <Text className="text-xs font-bold text-neutral-900">
                  Quiet Hours
                </Text>
                <Text className="text-[11px] text-neutral-500 font-medium">
                  {quietHoursSettings?.enabled
                    ? `Active (${quietHoursSettings.start} - ${quietHoursSettings.end})`
                    : 'Disabled (All alerts permitted)'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setIsQuietHoursModalOpen(true)}
              className="px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-xl active:bg-neutral-200"
            >
              <Text className="text-xs font-bold text-neutral-800">Configure</Text>
            </Pressable>
          </View>

          <View className="flex-row items-center justify-between pt-2.5">
            <View className="flex-1 mr-2">
              <Text className="text-xs font-bold text-neutral-900">
                Urgent Cancellation Bypass
              </Text>
              <Text className="text-[11px] text-neutral-500 font-medium">
                Always allow notifications for urgent cancellations & room changes
              </Text>
            </View>
            <Switch
              value={quietHoursSettings?.bypass ?? true}
              disabled
              trackColor={{ false: '#e4e4e7', true: '#FACC15' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* 7. Course Subscriptions */}
        <View className="mb-5 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
              COURSE SUBSCRIPTIONS ({courses.length})
            </Text>
            <Pressable
              onPress={() => router.push('/add-course')}
              className="flex-row items-center space-x-1"
            >
              <Plus size={13} color="#18181B" strokeWidth={2.5} />
              <Text className="text-xs font-black text-neutral-950 ml-0.5">Add Course</Text>
            </Pressable>
          </View>

          {courses.map((course) => (
            <View
              key={course.id}
              className="py-2.5 border-b border-neutral-100 flex-row items-center justify-between"
            >
              <View className="flex-1 mr-3">
                <View className="flex-row items-center space-x-1.5">
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: course.color_hex || '#FACC15' }}
                  />
                  <Text className="text-xs font-black text-neutral-900 font-mono">
                    {course.code || 'COURSE'}
                  </Text>
                  {course.guest_invite_token && (
                    <Pressable
                      onPress={() => handleCopyGuestCode(course.guest_invite_token!)}
                      className="px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200 flex-row items-center space-x-1"
                    >
                      <Text className="text-[9px] font-mono text-neutral-600">
                        #{course.guest_invite_token.slice(0, 6)}
                      </Text>
                      <Copy size={9} color="#71717A" />
                    </Pressable>
                  )}
                </View>
                <Text className="text-xs font-medium text-neutral-700 mt-0.5" numberOfLines={1}>
                  {course.name}
                </Text>
              </View>

              <Switch
                value={course.is_active !== false}
                onValueChange={() => handleToggleCourse(course.id, course.is_active !== false)}
                disabled={togglingCourseId === course.id}
                trackColor={{ false: '#e4e4e7', true: '#FACC15' }}
                thumbColor="#ffffff"
              />
            </View>
          ))}
        </View>

        {/* 7. Legal, Compliance & Support */}
        <View className="mb-5 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
          <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2.5">
            LEGAL & SUPPORT
          </Text>

          <Pressable
            testID="btn-open-support"
            onPress={handleOpenSupport}
            className="py-2.5 border-b border-neutral-100 flex-row items-center justify-between active:opacity-70"
          >
            <View className="flex-row items-center space-x-2.5">
              <View className="w-7 h-7 rounded-lg bg-indigo-50 items-center justify-center">
                <HelpCircle size={15} color="#4F46E5" />
              </View>
              <Text className="text-xs font-bold text-neutral-800 ml-2">
                Help Center & Support
              </Text>
            </View>
            <ExternalLink size={13} color="#A1A1AA" />
          </Pressable>

          <Pressable
            testID="btn-open-privacy"
            onPress={handleOpenPrivacy}
            className="py-2.5 border-b border-neutral-100 flex-row items-center justify-between active:opacity-70"
          >
            <View className="flex-row items-center space-x-2.5">
              <View className="w-7 h-7 rounded-lg bg-emerald-50 items-center justify-center">
                <ShieldCheck size={15} color="#059669" />
              </View>
              <Text className="text-xs font-bold text-neutral-800 ml-2">
                Privacy Policy
              </Text>
            </View>
            <ExternalLink size={13} color="#A1A1AA" />
          </Pressable>

          <Pressable
            testID="btn-open-terms"
            onPress={handleOpenTerms}
            className="py-2.5 flex-row items-center justify-between active:opacity-70"
          >
            <View className="flex-row items-center space-x-2.5">
              <View className="w-7 h-7 rounded-lg bg-amber-50 items-center justify-center">
                <FileText size={15} color="#D97706" />
              </View>
              <Text className="text-xs font-bold text-neutral-800 ml-2">
                Terms of Service
              </Text>
            </View>
            <ExternalLink size={13} color="#A1A1AA" />
          </Pressable>
        </View>

        {/* 8. Destructive Actions / Sign Out & Delete Account */}
        <View className="mb-8 space-y-2">
          <Pressable
            onPress={handleSignOut}
            disabled={isSigningOut}
            className="w-full py-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl items-center justify-center flex-row space-x-2 active:bg-rose-100"
          >
            {isSigningOut ? (
              <ActivityIndicator size="small" color="#E11D48" />
            ) : (
              <>
                <LogOut size={16} color="#E11D48" />
                <Text className="text-xs font-bold text-rose-700 ml-1.5">
                  Sign Out of ClassSync
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            testID="btn-open-delete-modal"
            onPress={() => setIsDeleteModalOpen(true)}
            className="w-full py-3.5 bg-neutral-50 border border-neutral-200/80 rounded-2xl items-center justify-center flex-row space-x-2 active:bg-neutral-100 mt-2"
          >
            <Trash2 size={16} color="#71717A" />
            <Text className="text-xs font-bold text-neutral-600 ml-1.5">
              Delete Account & Data
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Quiet Hours Configuration Modal */}
      <QuietHoursModal
        visible={isQuietHoursModalOpen}
        onClose={() => setIsQuietHoursModalOpen(false)}
        onSaved={async () => {
          if (!user?.id) return;
          const { data } = await supabase
            .from('user_notification_settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (data) {
            setQuietHoursSettings({
              enabled: data.quiet_hours_enabled,
              start: data.quiet_hours_start ? data.quiet_hours_start.slice(0, 5) : '22:00',
              end: data.quiet_hours_end ? data.quiet_hours_end.slice(0, 5) : '07:00',
              bypass: data.bypass_for_urgent,
            });
          }
        }}
      />

      {/* Account Deletion Compliance Modal */}
      <DeleteAccountModal
        visible={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </SafeAreaView>
  );
}
