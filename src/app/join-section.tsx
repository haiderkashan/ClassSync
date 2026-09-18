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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { X, KeyRound, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react-native';
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
  const [isSuccess, setIsSuccess] = useState(false);

  const handleCodeChange = (text: string) => {
    const normalized = normalizeJoinCode(text).slice(0, 6);
    setCode(normalized);
    if (errorMessage) setErrorMessage(null);
  };

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setErrorMessage('Please enter the full 6-character join code.');
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data: sectionId, error } = await supabase.rpc('join_section_via_code', {
        p_join_code: trimmed,
      });

      if (error) {
        console.error('[JoinSection] RPC error:', error.message);
        setErrorMessage(
          error.message.includes('Invalid or expired')
            ? 'No active section found with this code. Please verify and try again.'
            : error.message
        );
        setIsLoading(false);
        return;
      }

      if (sectionId) {
        setActiveSectionId(sectionId);
      }

      // Invalidate queries to refresh workspace & course lists
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });

      setIsSuccess(true);
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      }, 700);
    } catch (err) {
      console.error('[JoinSection] Unexpected exception:', err);
      setErrorMessage('An unexpected network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const isButtonDisabled = code.length !== 6 || isLoading || isSuccess;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 px-6 pt-4 pb-8 justify-between">
            {/* Top Navigation Bar */}
            <View>
              <View className="flex-row items-center justify-between pb-4 border-b border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-xl bg-brand-50 items-center justify-center mr-3">
                    <KeyRound size={20} color="#4f46e5" strokeWidth={2.2} />
                  </View>
                  <Text className="text-xl font-bold text-gray-900">Join Section</Text>
                </View>

                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
                >
                  <X size={20} color="#4b5563" />
                </Pressable>
              </View>

              {/* Instructional Context */}
              <View className="mt-6">
                <Text className="text-base text-gray-600 leading-relaxed">
                  Enter the 6-character alphanumeric code provided by your Class Representative to enroll in your cohort and courses.
                </Text>
              </View>

              {/* Join Code Input Form */}
              <View className="mt-8">
                <Text className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Section Join Code
                </Text>

                <View className="border-2 border-brand-200 rounded-2xl bg-gray-50/70 px-4 py-4 focus:border-brand-600 focus:bg-white transition-all">
                  <TextInput
                    value={code}
                    onChangeText={handleCodeChange}
                    placeholder="e.g. K7M9P2"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={handleJoin}
                    className="text-center font-mono text-3xl font-extrabold text-gray-900 tracking-widest"
                  />
                </View>

                {/* Progress Indicators */}
                <View className="flex-row justify-between items-center mt-2 px-1">
                  <Text className="text-xs text-gray-400">
                    Codes exclude confusing characters (0, O, 1, I, L)
                  </Text>
                  <Text
                    className={`text-xs font-semibold ${
                      code.length === 6 ? 'text-brand-600' : 'text-gray-400'
                    }`}
                  >
                    {code.length}/6
                  </Text>
                </View>

                {/* Feedback Alerts */}
                {errorMessage && (
                  <View className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
                    <AlertCircle size={18} color="#dc2626" className="mt-0.5 mr-2.5 flex-shrink-0" />
                    <Text className="text-sm text-red-700 flex-1 leading-tight ml-2">
                      {errorMessage}
                    </Text>
                  </View>
                )}

                {isSuccess && (
                  <View className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex-row items-center">
                    <CheckCircle2 size={18} color="#059669" className="mr-2.5 flex-shrink-0" />
                    <Text className="text-sm font-semibold text-emerald-800 ml-2">
                      Enrolled successfully! Redirecting...
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bottom Actions */}
            <View className="w-full pt-4">
              <Pressable
                onPress={handleJoin}
                disabled={isButtonDisabled}
                className={`w-full py-4 rounded-2xl flex-row items-center justify-center shadow-md transition-all ${
                  isButtonDisabled
                    ? 'bg-gray-200 shadow-none'
                    : 'bg-brand-600 active:bg-brand-700 shadow-brand-600/30 active:scale-[0.99]'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : isSuccess ? (
                  <Text className="text-white text-base font-bold">Joined!</Text>
                ) : (
                  <>
                    <Text
                      className={`text-base font-bold mr-2 ${
                        isButtonDisabled ? 'text-gray-400' : 'text-white'
                      }`}
                    >
                      Join Section
                    </Text>
                    <ArrowRight
                      size={18}
                      color={isButtonDisabled ? '#9ca3af' : '#ffffff'}
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
