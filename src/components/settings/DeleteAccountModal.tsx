import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Trash2,
  Crown,
  X,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react-native';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';

export interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ visible, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const {
    isGenesisCrOfAnySection,
    genesisSections,
    isDeleting,
    error,
    deleteAccount,
    clearError,
  } = useDeleteAccount();

  const [confirmationInput, setConfirmationInput] = useState('');

  // Handle Android hardware back press gracefully
  useModalBackHandler(visible, onClose);

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (visible) {
      setConfirmationInput('');
      clearError();
    }
  }, [visible]);

  const isConfirmed = confirmationInput.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    const success = await deleteAccount();
    if (success) {
      onClose();
    }
  };

  const handleNavigateToMembers = () => {
    onClose();
    router.push('/section-members');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <SafeAreaView edges={['bottom']} className="bg-white rounded-t-3xl max-h-[90%] overflow-hidden">
          {/* Header */}
          <View className="px-5 pt-3 pb-3 border-b border-neutral-100 flex-row items-center justify-between">
            <View className="w-10 h-1 bg-neutral-200 rounded-full mx-auto absolute left-1/2 -ml-5 top-2" />
            <View className="flex-row items-center space-x-2 pt-2">
              <View className={`w-8 h-8 rounded-full items-center justify-center ${isGenesisCrOfAnySection ? 'bg-amber-100' : 'bg-rose-100'}`}>
                {isGenesisCrOfAnySection ? (
                  <Crown size={16} color="#B45309" strokeWidth={2.5} />
                ) : (
                  <Trash2 size={16} color="#E11D48" strokeWidth={2.5} />
                )}
              </View>
              <Text className="text-base font-black text-neutral-900 tracking-tight">
                {isGenesisCrOfAnySection ? 'Ownership Transfer Required' : 'Delete Account'}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              disabled={isDeleting}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="btn-close-delete-modal"
              className="w-8 h-8 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200 mt-2"
            >
              <X size={16} color="#71717A" />
            </Pressable>
          </View>

          <ScrollView className="p-5" bounces={false}>
            {/* Condition A: Genesis CR Safeguard Active */}
            {isGenesisCrOfAnySection ? (
              <View className="space-y-4">
                <View className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex-row items-start space-x-3">
                  <ShieldAlert size={20} color="#B45309" className="mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-xs font-black text-amber-900 uppercase tracking-wide">
                      Genesis CR Protection Safeguard
                    </Text>
                    <Text className="text-xs text-amber-800 mt-1 leading-relaxed">
                      You are currently the Genesis Class Representative (CR) for active cohort section(s). Deleting your account now would leave your classmates without administrative access.
                    </Text>
                  </View>
                </View>

                {/* Section List */}
                <View className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80">
                  <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">
                    ACTIVE COHORT LEADERSHIP
                  </Text>
                  {genesisSections.map((sec) => (
                    <View key={sec.id} className="flex-row items-center justify-between py-1.5 border-b border-neutral-100 last:border-0">
                      <View className="flex-row items-center space-x-2">
                        <Crown size={13} color="#EAB308" />
                        <Text className="text-xs font-bold text-neutral-800">{sec.name}</Text>
                      </View>
                      <Text className="text-[10px] font-mono text-neutral-500">#{sec.join_code}</Text>
                    </View>
                  ))}
                </View>

                <Text className="text-xs text-neutral-600 leading-relaxed">
                  Before deleting your account, you must transfer cohort ownership to an existing Co-Admin or archive the section.
                </Text>

                {/* Direct Transfer CTA */}
                <Pressable
                  onPress={handleNavigateToMembers}
                  accessibilityRole="button"
                  testID="btn-transfer-ownership"
                  className="w-full py-3.5 bg-[#FACC15] rounded-2xl items-center justify-center flex-row space-x-2 active:bg-yellow-400 shadow-sm"
                >
                  <Text className="text-xs font-black text-neutral-950">
                    Transfer Ownership in Members Roster
                  </Text>
                  <ArrowRight size={14} color="#18181B" strokeWidth={2.5} />
                </Pressable>

                <Pressable
                  onPress={onClose}
                  className="w-full py-3 items-center justify-center"
                >
                  <Text className="text-xs font-bold text-neutral-500">Cancel</Text>
                </Pressable>
              </View>
            ) : (
              /* Condition B: Eligible Member Deletion */
              <View className="space-y-4">
                <View className="p-4 bg-rose-50 border border-rose-200/90 rounded-2xl">
                  <Text className="text-xs font-black text-rose-900 mb-1.5">
                    Permanent Account Deletion Warning
                  </Text>
                  <Text className="text-xs text-rose-700 leading-relaxed mb-3">
                    In compliance with Apple Privacy Guidelines, this action permanently purges your personal profile, credentials, and local data. This cannot be undone.
                  </Text>

                  <View className="space-y-1.5">
                    <View className="flex-row items-center space-x-2">
                      <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <Text className="text-[11px] text-rose-800 font-medium">
                        All section enrollments and guest links will be revoked.
                      </Text>
                    </View>
                    <View className="flex-row items-center space-x-2">
                      <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <Text className="text-[11px] text-rose-800 font-medium">
                        Private attendance records and personal tasks will be erased.
                      </Text>
                    </View>
                    <View className="flex-row items-center space-x-2">
                      <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <Text className="text-[11px] text-rose-800 font-medium">
                        Clerk authentication credentials will be destroyed.
                      </Text>
                    </View>
                  </View>
                </View>

                {error && (
                  <View className="p-3 bg-red-100 border border-red-300 rounded-xl">
                    <Text className="text-xs font-semibold text-red-900">{error}</Text>
                  </View>
                )}

                {/* Explicit Type-to-Confirm Safeguard */}
                <View>
                  <Text className="text-[11px] font-bold text-neutral-700 mb-1.5">
                    To confirm, please type <Text className="font-mono font-black text-rose-600">DELETE</Text> below:
                  </Text>
                  <TextInput
                    value={confirmationInput}
                    onChangeText={setConfirmationInput}
                    placeholder="Type DELETE"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    testID="input-confirm-delete"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 text-xs font-mono font-bold text-neutral-900"
                  />
                </View>

                {/* Destructive Deletion Action */}
                <Pressable
                  onPress={handleDelete}
                  disabled={!isConfirmed || isDeleting}
                  accessibilityRole="button"
                  testID="btn-confirm-delete-account"
                  className={`w-full py-3.5 rounded-2xl items-center justify-center flex-row space-x-2 ${
                    isConfirmed && !isDeleting
                      ? 'bg-rose-600 active:bg-rose-700'
                      : 'bg-neutral-200'
                  }`}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Trash2 size={15} color={isConfirmed ? '#ffffff' : '#A1A1AA'} />
                      <Text
                        className={`text-xs font-black ${
                          isConfirmed ? 'text-white' : 'text-neutral-400'
                        }`}
                      >
                        Permanently Delete Account
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={onClose}
                  disabled={isDeleting}
                  className="w-full py-2.5 items-center justify-center"
                >
                  <Text className="text-xs font-bold text-neutral-500">Cancel and Keep Account</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
