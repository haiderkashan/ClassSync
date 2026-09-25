import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Users,
  QrCode,
  Sparkles,
} from 'lucide-react-native';
import { useSupabase } from '@/hooks/useSupabase';
import { useAppStore } from '@/store/useAppStore';
import { normalizeJoinCode } from '@/lib/utils/codeGenerator';

export default function JoinSectionModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { setActiveSectionId, pendingJoinCode, setPendingJoinCode } = useAppStore();

  const [code, setCode] = useState(() => {
    if (params.code) {
      return normalizeJoinCode(params.code).slice(0, 6);
    }
    if (pendingJoinCode) {
      return normalizeJoinCode(pendingJoinCode).slice(0, 6);
    }
    return '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pre-fill from route parameters or Zustand OAuth pending state and clear
  useEffect(() => {
    if (params.code) {
      setCode(normalizeJoinCode(params.code).slice(0, 6));
      if (pendingJoinCode) {
        setPendingJoinCode(null);
      }
    } else if (pendingJoinCode) {
      setCode(normalizeJoinCode(pendingJoinCode).slice(0, 6));
      setPendingJoinCode(null);
    }
  }, [params.code, pendingJoinCode, setPendingJoinCode]);

  const handleCodeChange = (text: string) => {
    const normalized = normalizeJoinCode(text).slice(0, 6);
    setCode(normalized);
    if (errorMessage) setErrorMessage(null);
  };

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setErrorMessage('Please enter the full 6-character code.');
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      console.log(`🔍 [UnifiedJoin] Attempting join with code: ${trimmed}`);

      // 1. Attempt Section Join first
      const { data: sectionId, error: sectionError } = await supabase.rpc(
        'join_section_via_code',
        { p_join_code: trimmed }
      );

      if (!sectionError && sectionId) {
        console.log(`✅ [UnifiedJoin] Section join RPC succeeded: sectionId=${sectionId}`);
        const { data: sectionData } = await supabase
          .from('sections')
          .select('name')
          .eq('id', sectionId)
          .maybeSingle();

        const sectionName = sectionData?.name || 'Section';
        setActiveSectionId(sectionId);
        await queryClient.invalidateQueries({ queryKey: ['workspaces'] });

        setSuccessMessage(`Joined "${sectionName}" successfully!`);
        setIsLoading(false);

        setTimeout(() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }, 800);
        return;
      }

      console.log(
        `ℹ️ [UnifiedJoin] Section RPC failed/unmatched (${sectionError?.message ?? 'no match'}), attempting guest course RPC...`
      );

      // 2. Fallback: Attempt Guest Course Join
      const { data: courseId, error: courseError } = await supabase.rpc(
        'join_course_guest',
        { p_join_code: trimmed }
      );

      if (!courseError && courseId) {
        console.log(`✅ [UnifiedJoin] Guest course join RPC succeeded: courseId=${courseId}`);
        const { data: courseData } = await supabase
          .from('courses')
          .select('name, section_id')
          .eq('id', courseId)
          .maybeSingle();

        const courseName = courseData?.name || 'Course';
        if (courseData?.section_id) {
          setActiveSectionId(courseData.section_id);
        }
        await queryClient.invalidateQueries({ queryKey: ['workspaces'] });

        setSuccessMessage(`Joined "${courseName}" as Guest!`);
        setIsLoading(false);

        setTimeout(() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }, 800);
        return;
      }

      // 3. Both attempts failed: Code not found
      console.warn(
        `❌ [UnifiedJoin] Both join RPCs failed for code "${trimmed}". SectionErr: ${sectionError?.message}, CourseErr: ${courseError?.message}`
      );
      setErrorMessage('Invalid code. No active section or course matches this 6-character code.');
      setIsLoading(false);
    } catch (err) {
      console.error('[UnifiedJoin] Unexpected exception:', err);
      setErrorMessage('An unexpected network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const isButtonDisabled = code.length !== 6 || isLoading || !!successMessage;

  // Render 6 segmented boxes for code input
  const codeSlots = Array.from({ length: 6 }).map((_, i) => {
    const char = code[i] || '';
    const isCurrent = i === code.length;
    return (
      <View
        key={i}
        className={`w-12 h-14 rounded-2xl items-center justify-center border-2 ${
          char
            ? 'bg-white border-[#FACC15] shadow-xs'
            : isCurrent
            ? 'bg-white border-neutral-900 shadow-xs'
            : 'bg-neutral-100 border-neutral-200'
        }`}
      >
        <Text className="text-2xl font-black font-mono text-neutral-900">
          {char}
        </Text>
      </View>
    );
  });

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 px-6 pt-3 pb-6 justify-between max-w-md mx-auto w-full">
            <View>
              {/* Top Header */}
              <View className="flex-row items-center justify-between pb-4 border-b border-neutral-200/60">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-10 h-10 rounded-2xl bg-[#FACC15] items-center justify-center shadow-xs">
                    <KeyRound size={20} color="#18181B" strokeWidth={2.4} />
                  </View>
                  <View>
                    <Text className="text-xl font-black text-neutral-900 tracking-tight">
                      Join a Section
                    </Text>
                    <Text className="text-[11px] font-semibold text-neutral-500">
                      Cohort & Course Enrollment
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  className="w-9 h-9 rounded-full bg-neutral-200/70 items-center justify-center active:bg-neutral-300"
                >
                  <X size={18} color="#18181B" strokeWidth={2.4} />
                </Pressable>
              </View>

              {/* Subtitle / Context */}
              <Text className="text-sm text-neutral-600 mt-4 leading-relaxed">
                Enter the 6-character code from your Class Representative or scan the classroom projector QR code.
              </Text>

              {/* Quick Scan Presenter QR Action */}
              <Pressable
                onPress={() => router.push('/cohort/scan-qr')}
                className="w-full mt-4 p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex-row items-center justify-between active:bg-amber-100/90 shadow-2xs"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-9 h-9 rounded-xl bg-[#FACC15] items-center justify-center">
                    <QrCode size={18} color="#18181B" strokeWidth={2.4} />
                  </View>
                  <View>
                    <Text className="text-xs font-bold text-neutral-900">
                      Scan Presenter QR Code
                    </Text>
                    <Text className="text-[11px] text-neutral-600">
                      Instantly sync via classroom screen
                    </Text>
                  </View>
                </View>
                <ArrowRight size={16} color="#18181B" strokeWidth={2.4} />
              </Pressable>

              {/* 6-Character Segmented Display Form */}
              <View className="mt-6">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    6-Character Code
                  </Text>
                  <Text className="text-[11px] font-mono font-bold text-neutral-500">
                    {code.length}/6
                  </Text>
                </View>

                {/* Segmented Boxes container */}
                <View className="relative">
                  <View className="flex-row justify-between w-full">
                    {codeSlots}
                  </View>

                  {/* Hidden absolute TextInput overlay for typing */}
                  <TextInput
                    value={code}
                    onChangeText={handleCodeChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={handleJoin}
                    className="absolute inset-0 opacity-0 text-center"
                    autoFocus
                  />
                </View>

                {/* Feedback Alerts */}
                {errorMessage && (
                  <View className="mt-3.5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex-row items-center">
                    <AlertCircle size={16} color="#E11D48" className="shrink-0" />
                    <Text className="text-xs text-rose-800 font-semibold ml-2.5 flex-1">
                      {errorMessage}
                    </Text>
                  </View>
                )}

                {successMessage && (
                  <View className="mt-3.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex-row items-center">
                    <CheckCircle2 size={16} color="#059669" className="shrink-0" />
                    <Text className="text-xs font-bold text-emerald-800 ml-2.5 flex-1">
                      {successMessage}
                    </Text>
                  </View>
                )}
              </View>

              {/* Code Types Explanation Cards */}
              <View className="mt-6 p-4 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2.5">
                <View className="flex-row items-start">
                  <View className="w-6 h-6 rounded-lg bg-neutral-100 items-center justify-center mr-2.5 mt-0.5 shrink-0">
                    <Users size={13} color="#18181B" strokeWidth={2.4} />
                  </View>
                  <Text className="text-xs text-neutral-600 flex-1 leading-snug">
                    <Text className="font-bold text-neutral-900">Section Code:</Text> Enrolls you in the entire cohort timetable and broadcasts.
                  </Text>
                </View>

                <View className="flex-row items-start mt-2">
                  <View className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200 items-center justify-center mr-2.5 mt-0.5 shrink-0">
                    <BookOpen size={13} color="#D97706" strokeWidth={2.4} />
                  </View>
                  <Text className="text-xs text-neutral-600 flex-1 leading-snug">
                    <Text className="font-bold text-neutral-900">Guest Course Code:</Text> Enrolls you only in a specific retake or elective course.
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom Actions */}
            <View className="w-full pt-4 space-y-3">
              {/* Join Button */}
              <Pressable
                onPress={handleJoin}
                disabled={isButtonDisabled}
                className={`w-full h-13 rounded-2xl flex-row items-center justify-center shadow-xs transition-all ${
                  isButtonDisabled
                    ? 'bg-neutral-200'
                    : 'bg-[#FACC15] active:bg-[#EAB308]'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#18181B" />
                ) : successMessage ? (
                  <Text className="text-neutral-900 text-sm font-bold">Joined!</Text>
                ) : (
                  <>
                    <Text
                      className={`text-sm font-bold mr-2 ${
                        isButtonDisabled ? 'text-neutral-400' : 'text-neutral-900'
                      }`}
                    >
                      Join Cohort
                    </Text>
                    <ArrowRight
                      size={16}
                      color={isButtonDisabled ? '#a1a1aa' : '#18181B'}
                      strokeWidth={2.4}
                    />
                  </>
                )}
              </Pressable>

              {/* CR Role Switcher Link */}
              <View className="items-center pt-2">
                <Pressable
                  onPress={() => {
                    router.replace('/create-section');
                  }}
                  className="flex-row items-center gap-1.5 py-1"
                >
                  <Sparkles size={14} color="#A16207" />
                  <Text className="text-xs text-neutral-600">
                    Are you a Class Representative?{' '}
                    <Text className="font-bold text-neutral-900 underline">
                      Create a Section
                    </Text>
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
