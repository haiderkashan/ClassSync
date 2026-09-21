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
import { useUser } from '@clerk/expo';
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
              {/* Top Navigation Bar */}
              <View className="flex-row items-center justify-between pb-3 border-b border-neutral-200/60">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center mr-3">
                    <PlusCircle size={18} color="#18181b" strokeWidth={2.2} />
                  </View>
                  <Text className="text-xl font-black text-neutral-900">Create Section</Text>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
                >
                  <X size={18} color="#18181b" />
                </Pressable>
              </View>

              {/* Role Badge & Explainer */}
              <View className="mt-5 p-4 bg-purple-50/70 border border-purple-100/80 rounded-3xl flex-row items-center shadow-2xs">
                <View className="w-9 h-9 rounded-full bg-purple-100 items-center justify-center mr-3">
                  <ShieldCheck size={18} color="#7c3aed" />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                    Genesis Class Representative
                  </Text>
                  <Text className="text-xs text-purple-700 mt-0.5 leading-4">
                    You will have administrative rights to build timetables and broadcast status alerts.
                  </Text>
                </View>
              </View>

              {/* Form Fields */}
              <View className="mt-6 space-y-4">
                {/* Section Name */}
                <View>
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Section / Cohort Name <Text className="text-rose-500">*</Text>
                  </Text>
                  <View className="border border-neutral-200/90 rounded-2xl bg-white px-4 py-3.5 shadow-2xs">
                    <TextInput
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. BS Software Engineering 2026 - A"
                      placeholderTextColor="#a1a1aa"
                      autoCapitalize="words"
                      returnKeyType="next"
                      className="text-base text-neutral-900 font-medium"
                    />
                  </View>
                </View>

                {/* University / Institution */}
                <View className="mt-4">
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Institution / University (Optional)
                  </Text>
                  <View className="border border-neutral-200/90 rounded-2xl bg-white px-4 py-3.5 flex-row items-center shadow-2xs">
                    <School size={16} color="#71717a" className="mr-2" />
                    <TextInput
                      value={institution}
                      onChangeText={setInstitution}
                      placeholder="e.g. Stanford University"
                      placeholderTextColor="#a1a1aa"
                      autoCapitalize="words"
                      returnKeyType="done"
                      className="text-base text-neutral-900 font-medium flex-1 ml-2"
                    />
                  </View>
                </View>

                {/* Timezone Info */}
                <View className="mt-4 p-3.5 bg-white rounded-2xl border border-neutral-100 shadow-2xs flex-row items-center">
                  <Globe size={16} color="#71717a" className="mr-2" />
                  <View className="flex-1 ml-2">
                    <Text className="text-xs text-neutral-500">
                      Workspace Timezone: <Text className="font-semibold text-neutral-800">{localTimezone}</Text>
                    </Text>
                  </View>
                </View>
              </View>

              {/* Error Feedback */}
              {errorMessage && (
                <View className="mt-4 p-3.5 bg-rose-50 border border-rose-200/70 rounded-2xl flex-row items-start">
                  <AlertCircle size={16} color="#e11d48" className="mt-0.5 mr-2 flex-shrink-0" />
                  <Text className="text-xs text-rose-800 font-semibold flex-1 ml-2 leading-tight">
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Success Feedback with Code */}
              {createdCode && (
                <View className="mt-5 p-5 bg-emerald-50/80 border border-emerald-200/80 rounded-3xl shadow-xs">
                  <View className="flex-row items-center mb-2">
                    <CheckCircle2 size={18} color="#059669" />
                    <Text className="text-base font-bold text-emerald-900 ml-2">
                      Section Created!
                    </Text>
                  </View>
                  <Text className="text-xs text-emerald-700 mb-3">
                    Share this code with your classmates to join:
                  </Text>
                  <View className="bg-white border border-emerald-200 py-3 px-4 rounded-2xl items-center shadow-2xs">
                    <Text className="text-2xl font-mono font-black text-emerald-800 tracking-widest">
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
                className={`w-full py-4 rounded-full flex-row items-center justify-center shadow-md transition-all ${
                  isButtonDisabled
                    ? 'bg-neutral-200 shadow-none'
                    : 'bg-neutral-900 active:bg-neutral-800 shadow-neutral-900/20 active:scale-[0.99]'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : createdCode ? (
                  <Text className="text-white text-sm font-bold">Created Successfully!</Text>
                ) : (
                  <>
                    <Sparkles size={16} color={isButtonDisabled ? '#a1a1aa' : '#ffffff'} />
                    <Text
                      className={`text-sm font-bold ml-2 ${
                        isButtonDisabled ? 'text-neutral-400' : 'text-white'
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
