import React, { useState } from 'react';
import {
  View,
  Text,
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
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import {
  LogOut,
  Mail,
  ShieldCheck,
  User as UserIcon,
  School,
  BookOpen,
  Plus,
  LogIn,
  Hash,
  Crown,
  Bell,
  BellOff,
  Copy,
  Check,
  Users,
  Archive,
  UserMinus,
  Layers,
  Trash2,
  Calendar,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useSupabase } from '@/hooks/useSupabase';
import { useAppStore } from '@/store/useAppStore';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const supabase = useSupabase();

  const { sections, courses, activeSection, isLoading: isWorkspaceLoading } = useWorkspaces();
  const { setActiveCourses, setActiveSectionId } = useAppStore();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  const isGenesisCR = activeSection?.role === 'genesis_cr';
  const isCR = isGenesisCR || activeSection?.role === 'co_admin';

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('[Settings] Error signing out:', error);
    } finally {
      setIsSigningOut(false);
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

    // 1. Optimistically update local Zustand store
    const previousCourses = courses;
    const updatedCourses = courses.map((course) =>
      course.id === courseId ? { ...course, is_active: nextStatus } : course
    );
    setActiveCourses(updatedCourses);
    setTogglingCourseId(courseId);

    try {
      // 2. Silently update Supabase course_enrollments
      const { error } = await supabase
        .from('course_enrollments')
        .update({ is_active: nextStatus })
        .match({ course_id: courseId, user_id: user.id });

      if (error) {
        console.error('[Settings] Failed to toggle course enrollment:', error.message);
        // Rollback optimistic update on error
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

  const handleDropGuestCourse = (courseId: string, courseName: string) => {
    Alert.alert(
      'Drop Guest Course',
      `Are you sure you want to drop "${courseName}"? You will no longer receive timetable updates for this course.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Drop Course',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('leave_course_guest', {
                p_course_id: courseId,
              });

              if (error) {
                Alert.alert('Error', error.message);
                return;
              }

              await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            } catch (err) {
              console.error('[Settings] Error dropping course:', err);
            }
          },
        },
      ]
    );
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
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-5">
          <Text className="text-2xl font-black text-gray-900 tracking-tight">
            Account & Settings
          </Text>
          <Text className="text-xs font-medium text-gray-500 mt-0.5">
            Manage your student profile, cohort enrollments, and course alerts
          </Text>
        </View>

        {/* Profile Card */}
        <View className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm mb-5">
          <View className="flex-row items-center">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                className="w-16 h-16 rounded-2xl bg-gray-100"
              />
            ) : (
              <View className="w-16 h-16 rounded-2xl bg-brand-100 items-center justify-center">
                <UserIcon size={30} color="#4f46e5" />
              </View>
            )}

            <View className="ml-4 flex-1">
              <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
                {displayName}
              </Text>
              <View className="flex-row items-center mt-1">
                <Mail size={13} color="#6b7280" />
                <Text className="text-xs text-gray-500 ml-1.5 flex-1" numberOfLines={1}>
                  {email}
                </Text>
              </View>
            </View>
          </View>

          {/* Verification Chips */}
          <View className="flex-row items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <View className="flex-row items-center">
              <ShieldCheck size={16} color="#10b981" />
              <Text className="text-xs font-semibold text-emerald-700 ml-1.5">
                Clerk & Supabase Synced
              </Text>
            </View>
            <Text className="text-[11px] font-mono text-gray-400">
              ID: {user?.id ? `${user.id.slice(0, 10)}...` : 'Active'}
            </Text>
          </View>
        </View>

        {/* Section / Cohort Workspace Card */}
        <View className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-brand-50 items-center justify-center mr-2.5">
                <School size={18} color="#4f46e5" />
              </View>
              <Text className="text-sm font-bold text-gray-900">
                Enrolled Section
              </Text>
            </View>

            {activeSection?.role === 'genesis_cr' && (
              <View className="flex-row items-center bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                <Crown size={12} color="#d97706" />
                <Text className="text-[10px] font-bold text-amber-800 ml-1">
                  Genesis CR
                </Text>
              </View>
            )}

            {activeSection?.role === 'co_admin' && (
              <View className="flex-row items-center bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                <ShieldCheck size={12} color="#4f46e5" />
                <Text className="text-[10px] font-bold text-indigo-800 ml-1">
                  Co-Admin
                </Text>
              </View>
            )}
          </View>

          {/* Multi-Section Workspace Selector */}
          {sections.length > 1 && (
            <View className="mb-3 p-2.5 bg-gray-50 rounded-2xl border border-gray-200">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Switch Active Workspace
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {sections.map((sec) => {
                  const isSelected = sec.id === activeSection?.id;
                  return (
                    <Pressable
                      key={sec.id}
                      onPress={() => setActiveSectionId(sec.id)}
                      className={`mr-2 px-3 py-1.5 rounded-xl border flex-row items-center ${
                        isSelected
                          ? 'bg-brand-600 border-brand-600'
                          : 'bg-white border-gray-200 active:bg-gray-100'
                      }`}
                    >
                      <Layers
                        size={12}
                        color={isSelected ? '#ffffff' : '#6b7280'}
                        className="mr-1.5"
                      />
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {sec.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {activeSection ? (
            <View className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
              <Text className="text-base font-bold text-gray-900">
                {activeSection.name}
              </Text>
              {activeSection.institution_tag && (
                <Text className="text-xs text-gray-500 mt-0.5">
                  {activeSection.institution_tag}
                </Text>
              )}

              <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-gray-200/70">
                <View className="flex-row items-center">
                  <Hash size={13} color="#6b7280" />
                  <Text className="text-xs font-mono font-semibold text-gray-700 ml-1">
                    Code: {activeSection.join_code}
                  </Text>
                </View>
                <Text className="text-xs text-gray-400">
                  {activeSection.timezone}
                </Text>
              </View>

              {/* Roster and Section Management Actions */}
              <View className="mt-3 pt-3 border-t border-gray-200 flex-row flex-wrap gap-2">
                {isCR && (
                  <>
                    <Pressable
                      onPress={() => router.push('/schedule/builder')}
                      className="bg-brand-50 border border-brand-200 px-3 py-2 rounded-xl flex-row items-center active:bg-brand-100 shadow-xs"
                    >
                      <Calendar size={14} color="#4f46e5" />
                      <Text className="text-xs font-bold text-brand-800 ml-1.5">
                        Manage Timetable
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => router.push('/section-members')}
                      className="bg-white border border-gray-200 px-3 py-2 rounded-xl flex-row items-center active:bg-gray-100 shadow-xs"
                    >
                      <Users size={14} color="#4f46e5" />
                      <Text className="text-xs font-bold text-gray-800 ml-1.5">
                        Manage Roster
                      </Text>
                    </Pressable>
                  </>
                )}

                {isGenesisCR ? (
                  <Pressable
                    onPress={handleArchiveSection}
                    disabled={isPerformingAction}
                    className="bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl flex-row items-center active:bg-rose-100"
                  >
                    <Archive size={14} color="#e11d48" />
                    <Text className="text-xs font-bold text-rose-700 ml-1.5">
                      Archive Section
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleLeaveSection}
                    disabled={isPerformingAction}
                    className="bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl flex-row items-center active:bg-gray-200"
                  >
                    <UserMinus size={14} color="#6b7280" />
                    <Text className="text-xs font-bold text-gray-700 ml-1.5">
                      Leave Section
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <Text className="text-xs text-gray-500 leading-relaxed mb-3">
              You are not enrolled in an active section. Join or create a section to access timetables and course alerts.
            </Text>
          )}

          {/* Quick Workspace Switcher / Join Actions */}
          <View className="flex-row space-x-2 mt-3 pt-3 border-t border-gray-100">
            <Pressable
              onPress={() => router.push('/join-section')}
              className="flex-1 bg-gray-50 border border-gray-200 py-2.5 px-3 rounded-xl flex-row items-center justify-center active:bg-gray-100"
            >
              <LogIn size={15} color="#4f46e5" />
              <Text className="text-xs font-bold text-brand-700 ml-1.5">
                Join Code
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/create-section')}
              className="flex-1 bg-gray-50 border border-gray-200 py-2.5 px-3 rounded-xl flex-row items-center justify-center active:bg-gray-100"
            >
              <Plus size={15} color="#4f46e5" />
              <Text className="text-xs font-bold text-brand-700 ml-1.5">
                Create Section
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Course Subscriptions & CR Course Management Card */}
        <View className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm mb-6">
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-brand-50 items-center justify-center mr-2.5">
                <BookOpen size={18} color="#4f46e5" />
              </View>
              <Text className="text-sm font-bold text-gray-900">
                Course Subscriptions
              </Text>
            </View>

            {/* CR Add Course Button */}
            {isCR ? (
              <Pressable
                onPress={() => router.push('/add-course')}
                className="bg-brand-600 px-3 py-1.5 rounded-xl flex-row items-center active:bg-brand-700 shadow-sm shadow-brand-600/30"
              >
                <Plus size={13} color="#ffffff" strokeWidth={2.5} />
                <Text className="text-xs font-bold text-white ml-1">
                  Add Course
                </Text>
              </Pressable>
            ) : (
              <Text className="text-xs font-bold text-gray-400">
                {courses.filter((c) => c.is_active !== false).length}/{courses.length} Active
              </Text>
            )}
          </View>

          <Text className="text-xs text-gray-500 mb-4 leading-relaxed">
            Toggle off courses you do not attend. Share Guest Codes with irregular or retake students.
          </Text>

          {isWorkspaceLoading && courses.length === 0 ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#4f46e5" />
              <Text className="text-xs text-gray-400 mt-2">Loading courses...</Text>
            </View>
          ) : courses.length === 0 ? (
            <View className="py-6 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 items-center">
              <Text className="text-xs font-semibold text-gray-500 text-center">
                No courses added to this section yet.
              </Text>
              {isCR ? (
                <Pressable
                  onPress={() => router.push('/add-course')}
                  className="mt-3 bg-brand-600 px-4 py-2 rounded-xl flex-row items-center active:bg-brand-700"
                >
                  <Plus size={14} color="#ffffff" strokeWidth={2.5} />
                  <Text className="text-xs font-bold text-white ml-1.5">
                    Add First Course
                  </Text>
                </Pressable>
              ) : (
                <Text className="text-[11px] text-gray-400 text-center mt-1">
                  Your Class Representative can add courses for your timetable.
                </Text>
              )}
            </View>
          ) : (
            <View className="space-y-2.5">
              {courses.map((course) => {
                const isActive = course.is_active !== false;
                const isToggling = togglingCourseId === course.id;
                const isThisCopied = copiedCode === course.join_code;

                return (
                  <View
                    key={course.id}
                    className={`p-3.5 rounded-2xl border flex-row items-center justify-between transition-all ${
                      isActive
                        ? 'bg-white border-gray-200/80 shadow-xs'
                        : 'bg-gray-50/70 border-gray-100 opacity-60'
                    }`}
                  >
                    <View className="flex-row items-center flex-1 mr-3">
                      {/* Color Accent Indicator */}
                      <View
                        style={{ backgroundColor: course.color_hex || '#4F46E5' }}
                        className="w-3.5 h-12 rounded-full mr-3"
                      />

                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text
                            className="text-sm font-bold text-gray-900"
                            numberOfLines={1}
                          >
                            {course.name}
                          </Text>
                          {course.is_guest && (
                            <View className="ml-2 flex-row items-center">
                              <View className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">
                                <Text className="text-[9px] font-bold text-amber-800">
                                  Guest
                                </Text>
                              </View>
                              <Pressable
                                onPress={() => handleDropGuestCourse(course.id, course.name)}
                                hitSlop={8}
                                className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 active:bg-rose-100"
                              >
                                <Text className="text-[9px] font-bold text-rose-700">Drop</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>

                        {/* Guest Code Copy Badge */}
                        {course.join_code && (
                          <Pressable
                            onPress={() => handleCopyGuestCode(course.join_code!)}
                            hitSlop={8}
                            className="mt-1.5 flex-row items-center bg-gray-100/90 border border-gray-200/80 px-2 py-0.5 rounded-md self-start active:bg-gray-200"
                          >
                            {isThisCopied ? (
                              <>
                                <Check size={11} color="#059669" />
                                <Text className="text-[10px] font-bold text-emerald-700 ml-1">
                                  Copied!
                                </Text>
                              </>
                            ) : (
                              <>
                                <Copy size={10} color="#6b7280" />
                                <Text className="text-[10px] font-mono font-medium text-gray-600 ml-1">
                                  Guest Code: <Text className="font-bold text-brand-700">{course.join_code}</Text>
                                </Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>

                    {/* Native Toggle Switch */}
                    <View className="flex-row items-center">
                      {isActive ? (
                        <Bell size={14} color="#4f46e5" className="mr-2" />
                      ) : (
                        <BellOff size={14} color="#9ca3af" className="mr-2" />
                      )}
                      <Switch
                        value={isActive}
                        onValueChange={() => handleToggleCourse(course.id, isActive)}
                        disabled={isToggling}
                        trackColor={{ false: '#e5e7eb', true: '#4f46e5' }}
                        thumbColor={
                          Platform.OS === 'android'
                            ? isActive
                              ? '#ffffff'
                              : '#f4f3f4'
                            : undefined
                        }
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Sign Out Button */}
        <Pressable
          onPress={handleSignOut}
          disabled={isSigningOut || !isLoaded}
          className="w-full flex-row items-center justify-center py-3.5 px-4 bg-rose-50 border border-rose-200 rounded-2xl active:bg-rose-100 mb-6"
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color="#e11d48" />
          ) : (
            <>
              <LogOut size={18} color="#e11d48" />
              <Text className="text-sm font-semibold text-rose-600 ml-2.5">
                Sign Out of ClassSync
              </Text>
            </>
          )}
        </Pressable>

        {/* Build Metadata */}
        <Text className="text-[11px] text-gray-400 text-center mb-8">
          ClassSync v1.0.0 • Mobile Architecture Phase 2
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
