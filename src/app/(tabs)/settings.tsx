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
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'left', 'right']}>
      <ScrollView className="flex-1 px-5 pt-3" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-black text-neutral-900 tracking-tight">
            Account & Settings
          </Text>
          <Text className="text-xs font-medium text-neutral-500 mt-0.5">
            Manage your student profile, cohort enrollments, and course alerts
          </Text>
        </View>

        {/* Profile Card */}
        <View className="bg-white rounded-3xl p-5 border border-neutral-100/90 shadow-xs mb-4">
          <View className="flex-row items-center">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                className="w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200/50"
              />
            ) : (
              <View className="w-16 h-16 rounded-2xl bg-neutral-100 items-center justify-center border border-neutral-200/50">
                <UserIcon size={30} color="#18181b" />
              </View>
            )}

            <View className="ml-4 flex-1">
              <Text className="text-lg font-black text-neutral-900" numberOfLines={1}>
                {displayName}
              </Text>
              <View className="flex-row items-center mt-1">
                <Mail size={13} color="#71717a" />
                <Text className="text-xs text-neutral-500 ml-1.5 flex-1" numberOfLines={1}>
                  {email}
                </Text>
              </View>
            </View>
          </View>

          {/* Verification Chips */}
          <View className="flex-row items-center justify-between mt-4 pt-3.5 border-t border-neutral-100">
            <View className="flex-row items-center bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/60">
              <ShieldCheck size={14} color="#059669" />
              <Text className="text-[11px] font-bold text-emerald-800 ml-1.5">
                Clerk & Supabase Synced
              </Text>
            </View>
            <View className="bg-neutral-100 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-mono font-medium text-neutral-500">
                ID: {user?.id ? `${user.id.slice(0, 10)}...` : 'Active'}
              </Text>
            </View>
          </View>
        </View>

        {/* Section / Cohort Workspace Card */}
        <View className="bg-white rounded-3xl p-5 border border-neutral-100/90 shadow-xs mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-neutral-100 items-center justify-center mr-2.5">
                <School size={16} color="#18181b" />
              </View>
              <Text className="text-sm font-bold text-neutral-900">
                Enrolled Section
              </Text>
            </View>

            {activeSection?.role === 'genesis_cr' && (
              <View className="flex-row items-center bg-amber-50 border border-amber-200/70 px-2.5 py-0.5 rounded-full">
                <Crown size={12} color="#d97706" />
                <Text className="text-[10px] font-bold text-amber-800 ml-1">
                  Genesis CR
                </Text>
              </View>
            )}

            {activeSection?.role === 'co_admin' && (
              <View className="flex-row items-center bg-purple-50 border border-purple-200/70 px-2.5 py-0.5 rounded-full">
                <ShieldCheck size={12} color="#7c3aed" />
                <Text className="text-[10px] font-bold text-purple-800 ml-1">
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
            <View className="p-4 bg-neutral-50/70 rounded-2xl border border-neutral-100">
              <Text className="text-base font-black text-neutral-900">
                {activeSection.name}
              </Text>
              {activeSection.institution_tag && (
                <Text className="text-xs text-neutral-500 mt-0.5">
                  {activeSection.institution_tag}
                </Text>
              )}

              <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-neutral-200/60">
                <View className="flex-row items-center bg-white px-2.5 py-1 rounded-full border border-neutral-200/60 shadow-2xs">
                  <Hash size={12} color="#71717a" />
                  <Text className="text-xs font-mono font-bold text-neutral-800 ml-1">
                    {activeSection.join_code}
                  </Text>
                </View>
                <View className="bg-neutral-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] text-neutral-500 font-medium">
                    {activeSection.timezone}
                  </Text>
                </View>
              </View>

              {/* Roster and Section Management Actions */}
              <View className="mt-3 pt-3 border-t border-neutral-200/60 flex-row flex-wrap gap-2">
                {isCR && (
                  <>
                    <Pressable
                      onPress={() => router.push('/schedule/builder')}
                      className="bg-neutral-900 px-3.5 py-2 rounded-full flex-row items-center active:bg-neutral-800 shadow-xs"
                    >
                      <Calendar size={13} color="#ffffff" strokeWidth={2.2} />
                      <Text className="text-xs font-bold text-white ml-1.5">
                        Manage Timetable
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => router.push('/section-members')}
                      className="bg-white border border-neutral-200 px-3.5 py-2 rounded-full flex-row items-center active:bg-neutral-50 shadow-xs"
                    >
                      <Users size={13} color="#18181b" strokeWidth={2.2} />
                      <Text className="text-xs font-bold text-neutral-800 ml-1.5">
                        Manage Roster
                      </Text>
                    </Pressable>
                  </>
                )}

                {isGenesisCR ? (
                  <Pressable
                    onPress={handleArchiveSection}
                    disabled={isPerformingAction}
                    className="bg-rose-50 border border-rose-100 px-3.5 py-2 rounded-full flex-row items-center active:bg-rose-100"
                  >
                    <Archive size={13} color="#e11d48" strokeWidth={2.2} />
                    <Text className="text-xs font-bold text-rose-700 ml-1.5">
                      Archive
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleLeaveSection}
                    disabled={isPerformingAction}
                    className="bg-neutral-100 px-3.5 py-2 rounded-full flex-row items-center active:bg-neutral-200"
                  >
                    <UserMinus size={13} color="#71717a" strokeWidth={2.2} />
                    <Text className="text-xs font-bold text-neutral-700 ml-1.5">
                      Leave
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <Text className="text-xs text-neutral-500 leading-relaxed mb-3">
              You are not enrolled in an active section. Join or create a section to access timetables and course alerts.
            </Text>
          )}

          {/* Quick Workspace Switcher / Join Actions */}
          <View className="flex-row space-x-2.5 mt-3 pt-3 border-t border-neutral-100">
            <Pressable
              onPress={() => router.push('/join-section')}
              className="flex-1 bg-neutral-50 border border-neutral-200/70 py-3 px-3 rounded-full flex-row items-center justify-center active:bg-neutral-100"
            >
              <LogIn size={14} color="#18181b" />
              <Text className="text-xs font-bold text-neutral-800 ml-1.5">
                Join Code
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/create-section')}
              className="flex-1 bg-neutral-900 py-3 px-3 rounded-full flex-row items-center justify-center active:bg-neutral-800 shadow-xs"
            >
              <Plus size={14} color="#ffffff" strokeWidth={2.5} />
              <Text className="text-xs font-bold text-white ml-1.5">
                Create Section
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Course Subscriptions & CR Course Management Card */}
        <View className="bg-white rounded-3xl p-5 border border-neutral-100/90 shadow-xs mb-5">
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-neutral-100 items-center justify-center mr-2.5">
                <BookOpen size={16} color="#18181b" />
              </View>
              <Text className="text-sm font-bold text-neutral-900">
                Course Subscriptions
              </Text>
            </View>

            {/* CR Add Course Button */}
            {isCR ? (
              <Pressable
                onPress={() => router.push('/add-course')}
                className="bg-neutral-900 px-3.5 py-1.5 rounded-full flex-row items-center active:bg-neutral-800 shadow-xs"
              >
                <Plus size={12} color="#ffffff" strokeWidth={2.5} />
                <Text className="text-xs font-bold text-white ml-1">
                  Add Course
                </Text>
              </Pressable>
            ) : (
              <Text className="text-xs font-bold text-neutral-400">
                {courses.filter((c) => c.is_active !== false).length}/{courses.length} Active
              </Text>
            )}
          </View>

          <Text className="text-xs text-neutral-500 mb-4 leading-relaxed">
            Toggle off courses you do not attend. Share Guest Codes with irregular or retake students.
          </Text>

          {isWorkspaceLoading && courses.length === 0 ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#18181b" />
              <Text className="text-xs text-neutral-400 mt-2">Loading courses...</Text>
            </View>
          ) : courses.length === 0 ? (
            <View className="py-6 px-4 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 items-center">
              <Text className="text-xs font-semibold text-neutral-500 text-center">
                No courses added to this section yet.
              </Text>
              {isCR ? (
                <Pressable
                  onPress={() => router.push('/add-course')}
                  className="mt-3 bg-neutral-900 px-4 py-2 rounded-full flex-row items-center active:bg-neutral-800"
                >
                  <Plus size={14} color="#ffffff" strokeWidth={2.5} />
                  <Text className="text-xs font-bold text-white ml-1.5">
                    Add First Course
                  </Text>
                </Pressable>
              ) : (
                <Text className="text-[11px] text-neutral-400 text-center mt-1">
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
                        ? 'bg-neutral-50/50 border-neutral-200/60 shadow-2xs'
                        : 'bg-neutral-100/40 border-neutral-100 opacity-60'
                    }`}
                  >
                    <View className="flex-row items-center flex-1 mr-3">
                      {/* Color Accent Indicator */}
                      <View
                        style={{ backgroundColor: course.color_hex || '#18181B' }}
                        className="w-3 h-11 rounded-full mr-3"
                      />

                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text
                            className="text-sm font-bold text-neutral-900"
                            numberOfLines={1}
                          >
                            {course.name}
                          </Text>
                          {course.is_guest && (
                            <View className="ml-2 flex-row items-center">
                              <View className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/70">
                                <Text className="text-[9px] font-bold text-amber-800">
                                  Guest
                                </Text>
                              </View>
                              <Pressable
                                onPress={() => handleDropGuestCourse(course.id, course.name)}
                                hitSlop={8}
                                className="ml-1.5 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200/70 active:bg-rose-100"
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
                            className="mt-1.5 flex-row items-center bg-white border border-neutral-200 px-2.5 py-0.5 rounded-full self-start active:bg-neutral-100 shadow-2xs"
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
                                <Copy size={10} color="#71717a" />
                                <Text className="text-[10px] font-mono font-medium text-neutral-600 ml-1">
                                  Guest Code: <Text className="font-bold text-neutral-900">{course.join_code}</Text>
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
                        <Bell size={14} color="#18181b" className="mr-2" />
                      ) : (
                        <BellOff size={14} color="#a1a1aa" className="mr-2" />
                      )}
                      <Switch
                        value={isActive}
                        onValueChange={() => handleToggleCourse(course.id, isActive)}
                        disabled={isToggling}
                        trackColor={{ false: '#e4e4e7', true: '#18181b' }}
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
          className="w-full flex-row items-center justify-center py-4 px-5 bg-rose-50 border border-rose-100 rounded-full active:bg-rose-100 mb-6 shadow-2xs"
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color="#e11d48" />
          ) : (
            <>
              <LogOut size={16} color="#e11d48" />
              <Text className="text-sm font-bold text-rose-600 ml-2">
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
