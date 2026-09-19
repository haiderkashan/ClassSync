import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import {
  X,
  Users,
  Crown,
  ShieldCheck,
  Shield,
  User as UserIcon,
  ArrowUpRight,
  ArrowDownRight,
  UserMinus,
  KeyRound,
  AlertCircle,
  Sparkles,
} from 'lucide-react-native';
import { useSupabase } from '@/hooks/useSupabase';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import type { Tables } from '@/types/database.types';

export default function SectionMembersModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = useSupabase();
  const { activeSection } = useWorkspaces();

  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isGenesisCR = activeSection?.role === 'genesis_cr';

  // Fetch all members joined to this section with profile info
  const {
    data: members,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['section-members', activeSection?.id],
    enabled: !!activeSection?.id,
    queryFn: async () => {
      if (!activeSection?.id) return [];

      const { data, error } = await supabase
        .from('section_members')
        .select('id, role, joined_at, user_id, profile:profiles(*)')
        .eq('section_id', activeSection.id)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('[SectionMembers] Error fetching members:', error.message);
        throw error;
      }

      return data ?? [];
    },
  });

  const coAdminsCount = (members ?? []).filter((m) => m.role === 'co_admin').length;

  const handleRoleChange = async (targetUserId: string, newRole: 'co_admin' | 'member') => {
    if (!activeSection?.id) return;
    setProcessingUserId(targetUserId);
    setActionError(null);

    try {
      const { error } = await supabase.rpc('update_member_role', {
        p_section_id: activeSection.id,
        p_target_user_id: targetUserId,
        p_new_role: newRole,
      });

      if (error) {
        setActionError(error.message);
        return;
      }

      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
      ]);
    } catch (err) {
      console.error('[SectionMembers] Unexpected error updating role:', err);
      setActionError('Failed to update member role.');
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleTransferOwnership = (targetUserId: string, targetName: string) => {
    if (!activeSection?.id) return;

    Alert.alert(
      'Transfer Genesis CR Ownership',
      `Are you sure you want to transfer ownership of "${activeSection.name}" to ${targetName}? You will become a regular member.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            setProcessingUserId(targetUserId);
            setActionError(null);

            try {
              const { error } = await supabase.rpc('transfer_section_ownership', {
                p_section_id: activeSection.id,
                p_new_cr_user_id: targetUserId,
              });

              if (error) {
                setActionError(error.message);
                return;
              }

              await Promise.all([
                refetch(),
                queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
              ]);

              Alert.alert('Ownership Transferred', `${targetName} is now the Genesis CR.`);
            } catch (err) {
              console.error('[SectionMembers] Error transferring ownership:', err);
              setActionError('Failed to transfer ownership.');
            } finally {
              setProcessingUserId(null);
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = (targetUserId: string, targetName: string) => {
    if (!activeSection?.id) return;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${targetName} from the section? They will lose access to all section timetables and courses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setProcessingUserId(targetUserId);
            setActionError(null);

            try {
              const { error } = await supabase.rpc('remove_section_member', {
                p_section_id: activeSection.id,
                p_target_user_id: targetUserId,
              });

              if (error) {
                setActionError(error.message);
                return;
              }

              await Promise.all([
                refetch(),
                queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
              ]);
            } catch (err) {
              console.error('[SectionMembers] Error removing member:', err);
              setActionError('Failed to remove member.');
            } finally {
              setProcessingUserId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'bottom', 'left', 'right']}>
      {/* Header Bar */}
      <View className="flex-row items-center justify-between px-6 pt-3 pb-3 border-b border-neutral-200/60 bg-white">
        <View className="flex-row items-center">
          <View className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center mr-3">
            <Users size={18} color="#18181b" strokeWidth={2.2} />
          </View>
          <View>
            <Text className="text-xl font-black text-neutral-900">Section Roster</Text>
            <Text className="text-xs text-neutral-500">
              {activeSection?.name || 'Class Roster'} • {members?.length ?? 0} members
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
        >
          <X size={18} color="#18181b" />
        </Pressable>
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Co-Admin Delegation Capacity Badge */}
        {isGenesisCR && (
          <View className="mb-4 p-4 bg-purple-50/70 border border-purple-100/80 rounded-3xl flex-row items-center justify-between shadow-2xs">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center mr-2.5">
                <ShieldCheck size={16} color="#7c3aed" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-purple-900">
                  Co-Admin Delegation ({coAdminsCount}/2)
                </Text>
                <Text className="text-[11px] text-purple-700 leading-4">
                  You can appoint up to 2 classmates to help broadcast timetable changes.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Error Banner */}
        {actionError && (
          <View className="mb-4 p-3 bg-rose-50 border border-rose-200/70 rounded-2xl flex-row items-start">
            <AlertCircle size={16} color="#e11d48" className="mt-0.5 mr-2 flex-shrink-0" />
            <Text className="text-xs text-rose-700 flex-1 ml-1">{actionError}</Text>
          </View>
        )}

        {/* Members List */}
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="small" color="#18181b" />
            <Text className="text-xs text-neutral-400 mt-2">Loading member roster...</Text>
          </View>
        ) : (members ?? []).length === 0 ? (
          <View className="py-12 items-center">
            <Text className="text-sm font-semibold text-neutral-500">No members found</Text>
          </View>
        ) : (
          <View className="space-y-2.5 pb-8">
            {members!.map((member) => {
              const profile = member.profile as Tables<'profiles'> | null;
              const isCaller = member.user_id === user?.id;
              const isMemberGenesisCR = member.role === 'genesis_cr';
              const isMemberCoAdmin = member.role === 'co_admin';
              const isProcessing = processingUserId === member.user_id;

              const memberName = profile?.display_name || 'Student';
              const memberEmail = profile?.email || 'No email';
              const memberAvatar = profile?.avatar_url;

              return (
                <View
                  key={member.id}
                  className="p-4 bg-white border border-neutral-100/90 rounded-3xl shadow-2xs"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 mr-2">
                      {memberAvatar ? (
                        <Image
                          source={{ uri: memberAvatar }}
                          className="w-11 h-11 rounded-full bg-neutral-100 mr-3 border border-neutral-200/60"
                        />
                      ) : (
                        <View className="w-11 h-11 rounded-full bg-neutral-100 items-center justify-center mr-3 border border-neutral-200/60">
                          <UserIcon size={18} color="#18181b" />
                        </View>
                      )}

                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text
                            className="text-sm font-bold text-neutral-900 mr-1.5"
                            numberOfLines={1}
                          >
                            {memberName}
                          </Text>
                          {isCaller && (
                            <View className="bg-neutral-100 px-2 py-0.5 rounded-full">
                              <Text className="text-[10px] font-bold text-neutral-800">
                                You
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs text-neutral-500 mt-0.5" numberOfLines={1}>
                          {memberEmail}
                        </Text>
                      </View>
                    </View>

                    {/* Role Pill */}
                    {isMemberGenesisCR ? (
                      <View className="flex-row items-center bg-amber-50 border border-amber-200/70 px-2.5 py-1 rounded-full">
                        <Crown size={12} color="#d97706" />
                        <Text className="text-[10px] font-bold text-amber-800 ml-1">
                          Genesis CR
                        </Text>
                      </View>
                    ) : isMemberCoAdmin ? (
                      <View className="flex-row items-center bg-purple-50 border border-purple-200/70 px-2.5 py-1 rounded-full">
                        <ShieldCheck size={12} color="#7c3aed" />
                        <Text className="text-[10px] font-bold text-purple-800 ml-1">
                          Co-Admin
                        </Text>
                      </View>
                    ) : (
                      <View className="bg-neutral-100 px-2.5 py-1 rounded-full">
                        <Text className="text-[10px] font-semibold text-neutral-600">Member</Text>
                      </View>
                    )}
                  </View>

                  {/* Genesis CR Management Actions for Other Members */}
                  {isGenesisCR && !isCaller && (
                    <View className="mt-3 pt-3 border-t border-neutral-100 flex-row flex-wrap gap-2 items-center justify-end">
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#18181b" />
                      ) : (
                        <>
                          {/* Promote / Demote Co-Admin */}
                          {isMemberCoAdmin ? (
                            <Pressable
                              onPress={() => handleRoleChange(member.user_id, 'member')}
                              className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-full flex-row items-center active:bg-neutral-100"
                            >
                              <ArrowDownRight size={12} color="#71717a" />
                              <Text className="text-[11px] font-semibold text-neutral-700 ml-1">
                                Demote to Member
                              </Text>
                            </Pressable>
                          ) : (
                            coAdminsCount < 2 && (
                              <Pressable
                                onPress={() => handleRoleChange(member.user_id, 'co_admin')}
                                className="px-3 py-1.5 bg-purple-50 border border-purple-200/70 rounded-full flex-row items-center active:bg-purple-100"
                              >
                                <ArrowUpRight size={12} color="#7c3aed" />
                                <Text className="text-[11px] font-bold text-purple-700 ml-1">
                                  Make Co-Admin
                                </Text>
                              </Pressable>
                            )
                          )}

                          {/* Transfer Ownership */}
                          <Pressable
                            onPress={() => handleTransferOwnership(member.user_id, memberName)}
                            className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex-row items-center active:bg-amber-100"
                          >
                            <Crown size={12} color="#d97706" />
                            <Text className="text-[11px] font-bold text-amber-800 ml-1">
                              Transfer Ownership
                            </Text>
                          </Pressable>

                          {/* Remove Member */}
                          <Pressable
                            onPress={() => handleRemoveMember(member.user_id, memberName)}
                            className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg flex-row items-center active:bg-rose-100"
                          >
                            <UserMinus size={12} color="#e11d48" />
                            <Text className="text-[11px] font-bold text-rose-600 ml-1">
                              Remove
                            </Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
