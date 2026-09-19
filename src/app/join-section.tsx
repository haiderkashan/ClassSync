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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { X, KeyRound, ArrowRight, AlertCircle, CheckCircle2, BookOpen, Users } from 'lucide-react-native';
import { useSupabase } from '@/hooks/useSupabase';
import { useAppStore } from '@/store/useAppStore';
import { normalizeJoinCode } from '@/lib/utils/codeGenerator';

export default function JoinSectionModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { setActiveSectionId } = useAppStore();

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        // Successfully joined Section cohort
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

      console.log(`ℹ️ [UnifiedJoin] Section RPC failed/unmatched (${sectionError?.message ?? 'no match'}), attempting guest course RPC...`);

      // 2. Fallback: Attempt Guest Course Join
      const { data: courseId, error: courseError } = await supabase.rpc(
        'join_course_guest',
        { p_join_code: trimmed }
      );

      if (!courseError && courseId) {
        console.log(`✅ [UnifiedJoin] Guest course join RPC succeeded: courseId=${courseId}`);
        // Successfully joined course as guest
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
      console.warn(`❌ [UnifiedJoin] Both join RPCs failed for code "${trimmed}". SectionErr: ${sectionError?.message}, CourseErr: ${courseError?.message}`);
      setErrorMessage('Invalid code. No active section or course matches this 6-character code.');
      setIsLoading(false);
    } catch (err) {
      console.error('[UnifiedJoin] Unexpected exception:', err);
      setErrorMessage('An unexpected network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const isButtonDisabled = code.length !== 6 || isLoading || !!successMessage;

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 px-6 pt-3 pb-6 justify-between">
            {/* Top Navigation Bar */}
            <View>
              <View className="flex-row items-center justify-between pb-3 border-b border-neutral-200/60">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center mr-3">
                    <KeyRound size={18} color="#18181b" strokeWidth={2.2} />
                  </View>
                  <Text className="text-xl font-black text-neutral-900">Join with Code</Text>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
                >
                  <X size={18} color="#18181b" />
                </Pressable>
              </View>

              {/* Instructional Context */}
              <View className="mt-5">
                <Text className="text-sm text-neutral-500 leading-relaxed">
                  Enter any 6-character code to join your entire cohort section or enroll in an individual course as a Guest student.
                </Text>
              </View>

              {/* Join Code Input Form */}
              <View className="mt-6">
                <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  6-Character Join Code
                </Text>

                <View className="border border-neutral-200/90 rounded-3xl bg-white px-4 py-4 shadow-xs">
                  <TextInput
                    value={code}
                    onChangeText={handleCodeChange}
                    placeholder="e.g. K7M9P2"
                    placeholderTextColor="#a1a1aa"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={handleJoin}
                    className="text-center font-mono text-3xl font-black text-neutral-900 tracking-widest"
                  />
                </View>

                {/* Progress Indicators */}
                <View className="flex-row justify-between items-center mt-2 px-1">
                  <Text className="text-[11px] text-neutral-400">
                    Supports Section & Course Guest codes
                  </Text>
                  <View className="bg-neutral-100 px-2 py-0.5 rounded-full">
                    <Text
                      className={`text-[10px] font-mono font-bold ${
                        code.length === 6 ? 'text-neutral-900' : 'text-neutral-500'
                      }`}
                    >
                      {code.length}/6
                    </Text>
                  </View>
                </View>

                {/* Feedback Alerts */}
                {errorMessage && (
                  <View className="mt-3.5 p-3.5 bg-rose-50 border border-rose-200/70 rounded-2xl flex-row items-start">
                    <AlertCircle size={16} color="#e11d48" className="mt-0.5 mr-2 flex-shrink-0" />
                    <Text className="text-xs text-rose-800 font-semibold flex-1 leading-tight ml-2">
                      {errorMessage}
                    </Text>
                  </View>
                )}

                {successMessage && (
                  <View className="mt-3.5 p-3.5 bg-emerald-50 border border-emerald-200/70 rounded-2xl flex-row items-center">
                    <CheckCircle2 size={16} color="#059669" className="mr-2 flex-shrink-0" />
                    <Text className="text-xs font-bold text-emerald-800 ml-2">
                      {successMessage}
                    </Text>
                  </View>
                )}
              </View>

              {/* Code Types Guide */}
              <View className="mt-6 p-4 bg-white rounded-3xl border border-neutral-100 shadow-2xs space-y-2.5">
                <View className="flex-row items-center">
                  <View className="w-6 h-6 rounded-full bg-neutral-100 items-center justify-center mr-2.5">
                    <Users size={13} color="#18181b" />
                  </View>
                  <Text className="text-xs text-neutral-600 flex-1">
                    <Text className="font-bold text-neutral-900">Section Code:</Text> Enrolls you in the cohort and all of its scheduled courses.
                  </Text>
                </View>
                <View className="flex-row items-center mt-2">
                  <View className="w-6 h-6 rounded-full bg-amber-50 items-center justify-center mr-2.5">
                    <BookOpen size={13} color="#d97706" />
                  </View>
                  <Text className="text-xs text-neutral-600 flex-1">
                    <Text className="font-bold text-neutral-900">Guest Course Code:</Text> Enrolls you only in that specific retake or elective course.
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom Actions */}
            <View className="w-full pt-4">
              <Pressable
                onPress={handleJoin}
                disabled={isButtonDisabled}
                className={`w-full py-4 rounded-full flex-row items-center justify-center shadow-md transition-all ${
                  isButtonDisabled
                    ? 'bg-neutral-200 shadow-none'
                    : 'bg-neutral-900 active:bg-neutral-800 shadow-neutral-900/20 active:scale-[0.99]'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : successMessage ? (
                  <Text className="text-white text-sm font-bold">Joined!</Text>
                ) : (
                  <>
                    <Text
                      className={`text-sm font-bold mr-2 ${
                        isButtonDisabled ? 'text-neutral-400' : 'text-white'
                      }`}
                    >
                      Join with Code
                    </Text>
                    <ArrowRight
                      size={16}
                      color={isButtonDisabled ? '#a1a1aa' : '#ffffff'}
                      strokeWidth={2.4}
                    />
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
