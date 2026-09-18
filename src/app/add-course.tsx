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
  SafeAreaView,
  ScrollView,
} from 'react-native';
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
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 px-6 pt-4 pb-8 justify-between">
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between pb-4 border-b border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-xl bg-brand-50 items-center justify-center mr-3">
                    <BookOpen size={20} color="#4f46e5" strokeWidth={2.2} />
                  </View>
                  <Text className="text-xl font-bold text-gray-900">Add Course</Text>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
                >
                  <X size={20} color="#4b5563" />
                </Pressable>
              </View>

              {/* Active Section Info Card */}
              {activeSection && (
                <View className="mt-5 p-3.5 bg-gray-50 border border-gray-200 rounded-2xl flex-row items-center">
                  <School size={18} color="#4f46e5" className="mr-2.5" />
                  <View className="flex-1 ml-2">
                    <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Target Cohort Section
                    </Text>
                    <Text className="text-sm font-bold text-gray-900">
                      {activeSection.name}
                    </Text>
                  </View>
                </View>
              )}

              {/* Form Input */}
              <View className="mt-6">
                <Text className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                  Course Title <Text className="text-red-500">*</Text>
                </Text>
                <View className="border border-gray-200 rounded-xl bg-gray-50/60 px-4 py-3.5 focus:border-brand-600 focus:bg-white transition-all">
                  <TextInput
                    value={title}
                    onChangeText={(t) => {
                      setTitle(t);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. Web Engineering, Data Structures"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleCreateCourse}
                    className="text-base text-gray-900"
                  />
                </View>
              </View>

              {/* Automatic Enrollment Explainer */}
              <View className="mt-5 p-3.5 bg-brand-50/60 border border-brand-100 rounded-2xl">
                <View className="flex-row items-center mb-1">
                  <Users size={16} color="#4f46e5" className="mr-2" />
                  <Text className="text-xs font-bold text-brand-900">
                    Automatic Cohort Enrollment
                  </Text>
                </View>
                <Text className="text-xs text-brand-700 leading-relaxed">
                  All current students in this section will instantly receive this course. A unique 6-character Guest code will be generated for irregular/retake students.
                </Text>
              </View>

              {/* Error Alert */}
              {errorMessage && (
                <View className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
                  <AlertCircle size={18} color="#dc2626" className="mt-0.5 mr-2.5 flex-shrink-0" />
                  <Text className="text-sm text-red-700 flex-1 ml-2 leading-tight">
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Success Feedback with Guest Code */}
              {createdJoinCode && (
                <View className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <View className="flex-row items-center mb-2">
                    <CheckCircle2 size={20} color="#059669" />
                    <Text className="text-base font-bold text-emerald-900 ml-2">
                      Course Added Successfully!
                    </Text>
                  </View>
                  <Text className="text-xs text-emerald-700 mb-2">
                    Guest Join Code for Irregular Students:
                  </Text>
                  <View className="bg-white border border-emerald-300 py-2.5 px-4 rounded-xl items-center flex-row justify-center">
                    <KeyRound size={16} color="#059669" className="mr-2" />
                    <Text className="text-2xl font-mono font-extrabold text-emerald-800 tracking-widest ml-2">
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
                className={`w-full py-4 rounded-2xl flex-row items-center justify-center shadow-md transition-all ${
                  isButtonDisabled
                    ? 'bg-gray-200 shadow-none'
                    : 'bg-brand-600 active:bg-brand-700 shadow-brand-600/30 active:scale-[0.99]'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : createdJoinCode ? (
                  <Text className="text-white text-base font-bold">Course Added!</Text>
                ) : (
                  <>
                    <Plus size={18} color={isButtonDisabled ? '#9ca3af' : '#ffffff'} strokeWidth={2.4} />
                    <Text
                      className={`text-base font-bold ml-2 ${
                        isButtonDisabled ? 'text-gray-400' : 'text-white'
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
