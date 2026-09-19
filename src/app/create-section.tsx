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
import { useUser } from '@clerk/clerk-expo';
import {
  X,
  PlusCircle,
  School,
  Globe,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react-native';
import { useSupabase } from '@/hooks/useSupabase';
import { useAppStore } from '@/store/useAppStore';
import { generateJoinCode, generateUUID } from '@/lib/utils/codeGenerator';

export default function CreateSectionModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = useSupabase();
  const { setActiveSectionId } = useAppStore();

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const localTimezone =
    typeof Intl !== 'undefined' && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      : 'UTC';

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter a name for your section.');
      return;
    }

    if (!user?.id) {
      setErrorMessage('User session not found. Please log in again.');
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Generate unique 6-character uppercase join code and section ID
      const joinCode = generateJoinCode(6);
      const sectionId = generateUUID();
      console.log(`🚀 [CreateSection] Initiating section creation: "${trimmedName}" (id: ${sectionId}, code: ${joinCode})`);

      // 2. Insert new section (without returning row to avoid SELECT RLS before membership is inserted)
      const { error: sectionError } = await supabase
        .from('sections')
        .insert({
          id: sectionId,
          name: trimmedName,
          institution_tag: institution.trim() || null,
          join_code: joinCode,
          timezone: localTimezone,
          created_by: user.id,
        });

      if (sectionError) {
        console.error('❌ [CreateSection] Error inserting section:', sectionError.message);
        setErrorMessage(sectionError.message);
        setIsLoading(false);
        return;
      }

      console.log(`✅ [CreateSection] Section created: id=${sectionId}, name="${trimmedName}", code=${joinCode}`);

      // 3. Immediately enroll current user as Genesis CR
      const { error: memberError } = await supabase.from('section_members').insert({
        section_id: sectionId,
        user_id: user.id,
        role: 'genesis_cr',
      });

      if (memberError) {
        console.error('❌ [CreateSection] Error enrolling genesis_cr:', memberError.message);
        setErrorMessage(memberError.message);
        setIsLoading(false);
        return;
      }

      console.log(`👑 [CreateSection] Enrolled user ${user.id} as genesis_cr of section ${sectionId}`);

      // 4. Update active workspace and invalidate queries
      setActiveSectionId(sectionId);
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });

      setCreatedCode(joinCode);
      setIsLoading(false);

      // Brief delay to let the user see their generated code
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      }, 1000);
    } catch (err) {
      console.error('[CreateSection] Unexpected error:', err);
      setErrorMessage('Failed to create section due to an unexpected error.');
      setIsLoading(false);
    }
  };

  const isButtonDisabled = !name.trim() || isLoading || !!createdCode;

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
              {/* Top Navigation Bar */}
              <View className="flex-row items-center justify-between pb-4 border-b border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-xl bg-brand-50 items-center justify-center mr-3">
                    <PlusCircle size={20} color="#4f46e5" strokeWidth={2.2} />
                  </View>
                  <Text className="text-xl font-bold text-gray-900">Create Section</Text>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
                >
                  <X size={20} color="#4b5563" />
                </Pressable>
              </View>

              {/* Role Badge & Explainer */}
              <View className="mt-5 p-3.5 bg-brand-50/60 border border-brand-100 rounded-2xl flex-row items-center">
                <ShieldCheck size={20} color="#4f46e5" className="mr-2.5" />
                <View className="flex-1 ml-2">
                  <Text className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                    Genesis Class Representative
                  </Text>
                  <Text className="text-xs text-brand-700 mt-0.5">
                    You will have administrative rights to build timetables and broadcast status alerts.
                  </Text>
                </View>
              </View>

              {/* Form Fields */}
              <View className="mt-6 space-y-4">
                {/* Section Name */}
                <View>
                  <Text className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Section / Cohort Name <Text className="text-red-500">*</Text>
                  </Text>
                  <View className="border border-gray-200 rounded-xl bg-gray-50/60 px-4 py-3.5 focus:border-brand-600 focus:bg-white transition-all">
                    <TextInput
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. BS Software Engineering 2026 - A"
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="words"
                      returnKeyType="next"
                      className="text-base text-gray-900"
                    />
                  </View>
                </View>

                {/* University / Institution */}
                <View className="mt-4">
                  <Text className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Institution / University (Optional)
                  </Text>
                  <View className="border border-gray-200 rounded-xl bg-gray-50/60 px-4 py-3.5 flex-row items-center focus:border-brand-600 focus:bg-white transition-all">
                    <School size={18} color="#9ca3af" className="mr-2" />
                    <TextInput
                      value={institution}
                      onChangeText={setInstitution}
                      placeholder="e.g. Stanford University"
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="words"
                      returnKeyType="done"
                      className="text-base text-gray-900 flex-1 ml-2"
                    />
                  </View>
                </View>

                {/* Timezone Info */}
                <View className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 flex-row items-center">
                  <Globe size={16} color="#6b7280" className="mr-2" />
                  <View className="flex-1 ml-2">
                    <Text className="text-xs text-gray-500">
                      Workspace Timezone: <Text className="font-semibold text-gray-700">{localTimezone}</Text>
                    </Text>
                  </View>
                </View>
              </View>

              {/* Error Feedback */}
              {errorMessage && (
                <View className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
                  <AlertCircle size={18} color="#dc2626" className="mt-0.5 mr-2.5 flex-shrink-0" />
                  <Text className="text-sm text-red-700 flex-1 ml-2 leading-tight">
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Success Feedback with Code */}
              {createdCode && (
                <View className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <View className="flex-row items-center mb-2">
                    <CheckCircle2 size={20} color="#059669" />
                    <Text className="text-base font-bold text-emerald-900 ml-2">
                      Section Created!
                    </Text>
                  </View>
                  <Text className="text-xs text-emerald-700 mb-2">
                    Share this code with your classmates to join:
                  </Text>
                  <View className="bg-white border border-emerald-300 py-2.5 px-4 rounded-xl items-center">
                    <Text className="text-2xl font-mono font-extrabold text-emerald-800 tracking-widest">
                      {createdCode}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Bottom Actions */}
            <View className="w-full pt-4">
              <Pressable
                onPress={handleCreate}
                disabled={isButtonDisabled}
                className={`w-full py-4 rounded-2xl flex-row items-center justify-center shadow-md transition-all ${
                  isButtonDisabled
                    ? 'bg-gray-200 shadow-none'
                    : 'bg-brand-600 active:bg-brand-700 shadow-brand-600/30 active:scale-[0.99]'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : createdCode ? (
                  <Text className="text-white text-base font-bold">Created Successfully!</Text>
                ) : (
                  <>
                    <Sparkles size={18} color={isButtonDisabled ? '#9ca3af' : '#ffffff'} />
                    <Text
                      className={`text-base font-bold ml-2 ${
                        isButtonDisabled ? 'text-gray-400' : 'text-white'
                      }`}
                    >
                      Create Section
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
