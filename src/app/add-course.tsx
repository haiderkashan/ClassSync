import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  BookOpen,
  Plus,
  AlertCircle,
  CheckCircle2,
  Users,
  KeyRound,
  School,
  Sparkles,
  ArrowRight,
} from 'lucide-react-native';
import { useSupabase } from '@/hooks/useSupabase';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import { useUser } from '@clerk/expo';
import { generateJoinCode } from '@/lib/utils/codeGenerator';
import { generateClientUuid } from '@/lib/db/platformDb';

const COLOR_PRESETS = [
  '#FACC15', // Yellow
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#F43F5E', // Rose
];

export default function AddCourseModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { user } = useUser();
  const { activeSection, courses, refetch: refetchWorkspaces } = useWorkspaces();
  const { activeCourses, setActiveCourses } = useAppStore();

  const isCR = activeSection?.role === 'genesis_cr' || activeSection?.role === 'co_admin';

  // Mode: 'create' for new course, 'join' for guest code
  const [mode, setMode] = useState<'create' | 'join'>('create');

  // Create form state
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);
  const [createdJoinCode, setCreatedJoinCode] = useState<string | null>(null);

  // Join form state
  const [guestCode, setGuestCode] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreateCourse = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter a course title.');
      return;
    }

    if (!activeSection?.id) {
      setErrorMessage('No active section selected. Please create or join a section first.');
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Generate unique 6-character guest join code
      const joinCode = generateJoinCode(6);
      const normalizedCode = (code.trim() || trimmedTitle.slice(0, 6)).toUpperCase();
      let courseId = generateClientUuid();

      // 2. Try RPC first, then fallback to direct insert
      try {
        const { data: rpcCourseId, error: rpcError } = await supabase.rpc('create_course', {
          p_section_id: activeSection.id,
          p_title: trimmedTitle,
          p_join_code: joinCode,
        });

        if (!rpcError && rpcCourseId) {
          courseId = rpcCourseId;
        } else {
          console.warn('⚠️ [AddCourse] RPC create_course fallback to direct insert:', rpcError?.message);
          const { data: directCourse, error: directErr } = await supabase
            .from('courses')
            .insert({
              id: courseId,
              section_id: activeSection.id,
              name: trimmedTitle,
              code: normalizedCode,
              join_code: joinCode,
              color_hex: selectedColor,
              is_archived: false,
            })
            .select('id')
            .single();

          if (!directErr && directCourse?.id) {
            courseId = directCourse.id;
          }

          // Also enroll creator in the new course
          if (user?.id && courseId) {
            await supabase.from('course_enrollments').insert({
              course_id: courseId,
              user_id: user.id,
              is_active: true,
              is_guest: false,
            });
          }
        }
      } catch (backendErr: any) {
        console.warn('⚠️ [AddCourse] Backend sync unavailable, proceeding with local course creation:', backendErr?.message);
      }

      setCreatedJoinCode(joinCode);

      // 3. Immediately hydrate Zustand store
      const newCourse: any = {
        id: courseId,
        section_id: activeSection.id,
        name: trimmedTitle,
        code: normalizedCode,
        color_hex: selectedColor,
        join_code: joinCode,
        guest_invite_token: joinCode,
        is_active: true,
        is_archived: false,
      };

      const currentList = activeCourses || [];
      const updatedList = currentList.filter((c) => c.id !== courseId).concat(newCourse);
      setActiveCourses(updatedList);

      // 4. Update query cache optimistically
      queryClient.setQueryData(['workspaces', user?.id], (old: any) => {
        if (!old) return { sections: [activeSection], courses: updatedList };
        return {
          ...old,
          courses: [...(old.courses || []).filter((c: any) => c.id !== courseId), newCourse],
        };
      });

      queryClient.invalidateQueries({ queryKey: ['workspaces'] });

      setIsLoading(false);
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/settings');
        }
      }, 1000);
    } catch (err: any) {
      console.error('[AddCourse] Error:', err);
      setErrorMessage(err?.message || 'Failed to add course.');
      setIsLoading(false);
    }
  };

  const handleJoinCourse = async () => {
    const trimmedCode = guestCode.trim().toUpperCase();
    if (trimmedCode.length < 6) {
      setErrorMessage('Please enter a valid 6-character course code.');
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data: courseId, error } = await supabase.rpc('join_course_guest', {
        p_join_code: trimmedCode,
      });

      if (error) {
        throw new Error(error.message);
      }

      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      await refetchWorkspaces();

      setIsLoading(false);
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/settings');
        }
      }, 800);
    } catch (err: any) {
      console.error('[JoinCourse] Error:', err);
      setErrorMessage(err?.message || 'Invalid or expired course code.');
      setIsLoading(false);
    }
  };

  const isButtonDisabled =
    mode === 'create'
      ? !title.trim() || isLoading || !!createdJoinCode
      : guestCode.trim().length < 6 || isLoading;

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 px-5 pt-3 pb-6 justify-between">
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between pb-3 border-b border-neutral-200/60">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-2xl bg-[#FACC15]/20 border border-[#FACC15]/40 items-center justify-center mr-3">
                    <BookOpen size={18} color="#854D0E" strokeWidth={2.2} />
                  </View>
                  <Text className="text-xl font-black text-neutral-900 tracking-tight">
                    Add Course
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
                >
                  <X size={18} color="#18181b" />
                </Pressable>
              </View>

              {/* Mode Segmented Switcher */}
              <View className="flex-row p-1 bg-neutral-100/90 rounded-2xl border border-neutral-200/60 mt-4">
                <Pressable
                  onPress={() => {
                    setMode('create');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl items-center justify-center transition-all ${
                    mode === 'create'
                      ? 'bg-[#FACC15] shadow-xs'
                      : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      mode === 'create' ? 'text-neutral-900 font-black' : 'text-neutral-500'
                    }`}
                  >
                    Create Course
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setMode('join');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl items-center justify-center transition-all ${
                    mode === 'join'
                      ? 'bg-[#FACC15] shadow-xs'
                      : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      mode === 'join' ? 'text-neutral-900 font-black' : 'text-neutral-500'
                    }`}
                  >
                    Join with Code
                  </Text>
                </Pressable>
              </View>

              {/* Active Section Info Card */}
              {activeSection ? (
                <View className="mt-4 p-3.5 bg-white border border-neutral-200/70 rounded-2xl flex-row items-center shadow-2xs">
                  <View className="w-8 h-8 rounded-xl bg-neutral-100 items-center justify-center mr-3">
                    <School size={15} color="#18181b" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Active Section Cohort
                    </Text>
                    <Text className="text-sm font-black text-neutral-900">
                      {activeSection.name}
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex-row items-center">
                  <AlertCircle size={16} color="#D97706" />
                  <Text className="text-xs text-amber-800 ml-2 font-medium flex-1">
                    No active section found. Please create or join a section first.
                  </Text>
                </View>
              )}

              {mode === 'create' ? (
                <>
                  {/* Course Title Input */}
                  <View className="mt-4">
                    <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Course Title <Text className="text-rose-500">*</Text>
                    </Text>
                    <View className="border border-neutral-200/90 rounded-2xl bg-white px-4 py-3 shadow-2xs">
                      <TextInput
                        value={title}
                        onChangeText={(t) => {
                          setTitle(t);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="e.g. Software Engineering, Algorithms"
                        placeholderTextColor="#a1a1aa"
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="next"
                        className="text-sm text-neutral-900 font-bold"
                      />
                    </View>
                  </View>

                  {/* Course Code Input */}
                  <View className="mt-3.5">
                    <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Course Code (Optional)
                    </Text>
                    <View className="border border-neutral-200/90 rounded-2xl bg-white px-4 py-3 shadow-2xs">
                      <TextInput
                        value={code}
                        onChangeText={(c) => setCode(c.toUpperCase())}
                        placeholder="e.g. CS-301, MATH-102"
                        placeholderTextColor="#a1a1aa"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="done"
                        className="text-sm text-neutral-900 font-mono font-bold"
                      />
                    </View>
                  </View>

                  {/* Course Color Accent Picker */}
                  <View className="mt-3.5">
                    <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                      Course Color Accent
                    </Text>
                    <View className="flex-row items-center space-x-2">
                      {COLOR_PRESETS.map((hex) => {
                        const isSelected = selectedColor === hex;
                        return (
                          <Pressable
                            key={hex}
                            onPress={() => setSelectedColor(hex)}
                            className={`w-7 h-7 rounded-full items-center justify-center transition-all ${
                              isSelected ? 'scale-110 shadow-sm' : 'opacity-80'
                            }`}
                            style={{
                              backgroundColor: hex,
                              borderWidth: isSelected ? 2.5 : 1,
                              borderColor: isSelected ? '#18181B' : 'rgba(0,0,0,0.1)',
                            }}
                          />
                        );
                      })}
                    </View>
                  </View>

                  {/* Cohort Auto Enrollment Notice */}
                  <View className="mt-4 p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                    <View className="flex-row items-center mb-1">
                      <Users size={14} color="#059669" />
                      <Text className="text-xs font-bold text-emerald-900 ml-1.5">
                        Automatic Section Enrollment
                      </Text>
                    </View>
                    <Text className="text-[11px] text-emerald-700 leading-relaxed">
                      All classmates in {activeSection?.name || 'this section'} will automatically receive this course on their timetable.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  {/* Guest Code Input */}
                  <View className="mt-4">
                    <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Guest Course Join Code <Text className="text-rose-500">*</Text>
                    </Text>
                    <View className="border border-neutral-200/90 rounded-2xl bg-white px-4 py-3 shadow-2xs">
                      <TextInput
                        value={guestCode}
                        onChangeText={(c) => {
                          setGuestCode(c.toUpperCase());
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="e.g. 7X9K2P"
                        placeholderTextColor="#a1a1aa"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={8}
                        className="text-base text-neutral-900 font-mono font-black tracking-widest text-center"
                      />
                    </View>
                    <Text className="text-[11px] text-neutral-400 font-medium mt-1.5">
                      Ask your course professor or Section CR for their 6-character course code.
                    </Text>
                  </View>
                </>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <View className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex-row items-start">
                  <AlertCircle size={15} color="#e11d48" className="mt-0.5" />
                  <Text className="text-xs text-rose-800 font-semibold flex-1 ml-2 leading-tight">
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Success Feedback with Guest Code */}
              {createdJoinCode && (
                <View className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
                  <View className="flex-row items-center mb-1.5">
                    <CheckCircle2 size={16} color="#059669" />
                    <Text className="text-sm font-black text-emerald-900 ml-1.5">
                      Course Added Successfully!
                    </Text>
                  </View>
                  <Text className="text-[11px] text-emerald-700 mb-2">
                    Share this code with irregular or retake students:
                  </Text>
                  <View className="bg-white border border-emerald-200 py-2 px-3 rounded-xl items-center flex-row justify-center">
                    <KeyRound size={14} color="#059669" />
                    <Text className="text-xl font-mono font-black text-emerald-800 tracking-widest ml-2">
                      #{createdJoinCode}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Submit Action Button */}
            <View className="w-full pt-4">
              <Pressable
                onPress={mode === 'create' ? handleCreateCourse : handleJoinCourse}
                disabled={isButtonDisabled}
                className={`w-full py-3.5 rounded-full flex-row items-center justify-center shadow-xs transition-all ${
                  isButtonDisabled
                    ? 'bg-neutral-200'
                    : 'bg-[#FACC15] active:bg-yellow-400'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#18181B" />
                ) : createdJoinCode ? (
                  <Text className="text-neutral-950 text-sm font-black">Course Added!</Text>
                ) : (
                  <>
                    <Plus size={16} color={isButtonDisabled ? '#a1a1aa' : '#18181B'} strokeWidth={2.5} />
                    <Text
                      className={`text-sm font-black ml-1.5 ${
                        isButtonDisabled ? 'text-neutral-400' : 'text-neutral-950'
                      }`}
                    >
                      {mode === 'create' ? 'Add Course to Section' : 'Join Course'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
