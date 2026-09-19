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
} from 'lucide-react-native';
import { useSupabase } from '@/hooks/useSupabase';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { generateJoinCode } from '@/lib/utils/codeGenerator';

export default function AddCourseModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { activeSection } = useWorkspaces();

  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdJoinCode, setCreatedJoinCode] = useState<string | null>(null);

  const handleCreateCourse = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter a course title.');
      return;
    }

    if (!activeSection?.id) {
      setErrorMessage('No active section selected. Please select a section first.');
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Generate unique 6-character guest join code
      const joinCode = generateJoinCode(6);

      // 2. Execute atomic course creation RPC
      const { data: courseId, error } = await supabase.rpc('create_course', {
        p_section_id: activeSection.id,
        p_title: trimmedTitle,
        p_join_code: joinCode,
      });

      if (error) {
        console.error('[AddCourse] RPC error:', error.message);
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setCreatedJoinCode(joinCode);

      // 3. Invalidate workspace queries so active courses refresh
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });

      setIsLoading(false);
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/settings');
        }
      }, 900);
    } catch (err) {
      console.error('[AddCourse] Unexpected error:', err);
      setErrorMessage('Failed to add course due to an unexpected error.');
      setIsLoading(false);
    }
  };

  const isButtonDisabled = !title.trim() || isLoading || !!createdJoinCode;

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 px-6 pt-3 pb-6 justify-between">
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between pb-3 border-b border-neutral-200/60">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center mr-3">
                    <BookOpen size={18} color="#18181b" strokeWidth={2.2} />
                  </View>
                  <Text className="text-xl font-black text-neutral-900">Add Course</Text>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
                >
                  <X size={18} color="#18181b" />
                </Pressable>
              </View>

              {/* Active Section Info Card */}
              {activeSection && (
                <View className="mt-5 p-4 bg-white border border-neutral-100 rounded-2xl flex-row items-center shadow-2xs">
                  <View className="w-8 h-8 rounded-full bg-neutral-100 items-center justify-center mr-3">
                    <School size={16} color="#18181b" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Target Cohort Section
                    </Text>
                    <Text className="text-sm font-bold text-neutral-900">
                      {activeSection.name}
                    </Text>
                  </View>
                </View>
              )}

              {/* Form Input */}
              <View className="mt-6">
                <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Course Title <Text className="text-rose-500">*</Text>
                </Text>
                <View className="border border-neutral-200/90 rounded-2xl bg-white px-4 py-3.5 shadow-2xs">
                  <TextInput
                    value={title}
                    onChangeText={(t) => {
                      setTitle(t);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. Web Engineering, Data Structures"
                    placeholderTextColor="#a1a1aa"
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleCreateCourse}
                    className="text-base text-neutral-900 font-medium"
                  />
                </View>
              </View>

              {/* Automatic Enrollment Explainer */}
              <View className="mt-5 p-4 bg-emerald-50/70 border border-emerald-100/80 rounded-3xl shadow-2xs">
                <View className="flex-row items-center mb-1">
                  <Users size={15} color="#059669" className="mr-2" />
                  <Text className="text-xs font-bold text-emerald-900">
                    Automatic Cohort Enrollment
                  </Text>
                </View>
                <Text className="text-xs text-emerald-700 leading-relaxed">
                  All current students in this section will instantly receive this course. A unique 6-character Guest code will be generated for irregular/retake students.
                </Text>
              </View>

              {/* Error Alert */}
              {errorMessage && (
                <View className="mt-4 p-3.5 bg-rose-50 border border-rose-200/70 rounded-2xl flex-row items-start">
                  <AlertCircle size={16} color="#e11d48" className="mt-0.5 mr-2 flex-shrink-0" />
                  <Text className="text-xs text-rose-800 font-semibold flex-1 ml-2 leading-tight">
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Success Feedback with Guest Code */}
              {createdJoinCode && (
                <View className="mt-5 p-5 bg-emerald-50/80 border border-emerald-200/80 rounded-3xl shadow-xs">
                  <View className="flex-row items-center mb-2">
                    <CheckCircle2 size={18} color="#059669" />
                    <Text className="text-base font-bold text-emerald-900 ml-2">
                      Course Added Successfully!
                    </Text>
                  </View>
                  <Text className="text-xs text-emerald-700 mb-3">
                    Guest Join Code for Irregular Students:
                  </Text>
                  <View className="bg-white border border-emerald-200 py-3 px-4 rounded-2xl items-center flex-row justify-center shadow-2xs">
                    <KeyRound size={16} color="#059669" className="mr-2" />
                    <Text className="text-2xl font-mono font-black text-emerald-800 tracking-widest ml-2">
                      {createdJoinCode}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Submit Action */}
            <View className="w-full pt-4">
              <Pressable
                onPress={handleCreateCourse}
                disabled={isButtonDisabled}
                className={`w-full py-4 rounded-full flex-row items-center justify-center shadow-md transition-all ${
                  isButtonDisabled
                    ? 'bg-neutral-200 shadow-none'
                    : 'bg-neutral-900 active:bg-neutral-800 shadow-neutral-900/20 active:scale-[0.99]'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : createdJoinCode ? (
                  <Text className="text-white text-sm font-bold">Course Added!</Text>
                ) : (
                  <>
                    <Plus size={16} color={isButtonDisabled ? '#a1a1aa' : '#ffffff'} strokeWidth={2.4} />
                    <Text
                      className={`text-sm font-bold ml-2 ${
                        isButtonDisabled ? 'text-neutral-400' : 'text-white'
                      }`}
                    >
                      Add Course to Section
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
