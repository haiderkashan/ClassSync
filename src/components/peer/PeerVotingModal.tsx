import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import {
  X,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Ban,
  Sparkles,
} from 'lucide-react-native';
import type { PeerReportWithVotes } from '@/hooks/usePeerVerification';
import { formatTime12Hour } from '@/lib/schedule/timeUtils';

export interface PeerVotingModalProps {
  visible: boolean;
  onClose: () => void;
  block: any;
  report?: PeerReportWithVotes;
  isAdmin: boolean;
  onCastVote: (vote: 'affirm' | 'deny') => Promise<any>;
  onVetoReport: (reportId: string, reason?: string) => Promise<any>;
  isVoting?: boolean;
  isVetoing?: boolean;
  userVote?: 'affirm' | 'deny' | null;
  targetDate: string;
}

export function PeerVotingModal({
  visible,
  onClose,
  block,
  report,
  isAdmin,
  onCastVote,
  onVetoReport,
  isVoting = false,
  isVetoing = false,
  userVote,
  targetDate,
}: PeerVotingModalProps) {
  const [vetoReason, setVetoReason] = useState('');
  const [isVetoFormOpen, setIsVetoFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!block) return null;

  const courseTitle = block.course?.name || block.title || 'Class Session';
  const courseCode = block.course?.code || '';
  const startTime = block.start_time ? formatTime12Hour(block.start_time) : '';
  const endTime = block.end_time ? formatTime12Hour(block.end_time) : '';

  const affirms = report?.affirmation_count ?? 0;
  const denials = report?.denial_count ?? 0;
  const isConfirmed = report?.status === 'confirmed';
  const isVetoed = report?.status === 'vetoed';

  const handleVote = async (vote: 'affirm' | 'deny') => {
    setActionError(null);
    try {
      await onCastVote(vote);
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit vote.');
    }
  };

  const handleVeto = async () => {
    if (!report?.id) return;
    setActionError(null);
    try {
      await onVetoReport(report.id, vetoReason);
      setIsVetoFormOpen(false);
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Failed to veto report.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[85%] overflow-hidden shadow-2xl">
          {/* Header */}
          <View className="px-6 py-4 border-b border-neutral-100 flex-row items-center justify-between bg-neutral-50/70">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center">
                <ShieldAlert size={16} color="#d97706" />
              </View>
              <View>
                <Text className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Decentralized Consensus
                </Text>
                <Text className="text-base font-black text-neutral-900">
                  Peer Class Verification
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="w-8 h-8 rounded-full bg-neutral-200/80 items-center justify-center active:bg-neutral-300"
            >
              <X size={16} color="#18181b" />
            </Pressable>
          </View>

          <ScrollView className="p-6">
            {/* Session Info Card */}
            <View className="p-4 bg-neutral-50 border border-neutral-200/80 rounded-2xl mb-4">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-base font-black text-neutral-900" numberOfLines={1}>
                  {courseTitle}
                </Text>
                {courseCode ? (
                  <View className="bg-neutral-200/70 px-2 py-0.5 rounded-md">
                    <Text className="text-[10px] font-mono font-bold text-neutral-800">
                      {courseCode}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-center space-x-3 mt-2 text-neutral-500">
                <View className="flex-row items-center">
                  <Clock size={12} color="#71717a" />
                  <Text className="text-xs text-neutral-600 ml-1 font-medium">
                    {startTime} - {endTime}
                  </Text>
                </View>
                {block.room && (
                  <View className="flex-row items-center ml-3">
                    <MapPin size={12} color="#71717a" />
                    <Text className="text-xs text-neutral-600 ml-1 font-medium">
                      {block.room}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Status Alert Banner */}
            {isConfirmed ? (
              <View className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex-row items-start mb-5">
                <CheckCircle2 size={18} color="#e11d48" className="mt-0.5" />
                <View className="ml-2.5 flex-1">
                  <Text className="text-xs font-black text-rose-950">
                    Class Confirmed Cancelled
                  </Text>
                  <Text className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                    Cohort quorum verified that the instructor was absent or called off class. Timetable is updated.
                  </Text>
                </View>
              </View>
            ) : isVetoed ? (
              <View className="p-4 bg-neutral-100 border border-neutral-200 rounded-2xl flex-row items-start mb-5">
                <Ban size={18} color="#71717a" className="mt-0.5" />
                <View className="ml-2.5 flex-1">
                  <Text className="text-xs font-black text-neutral-900">
                    Report Vetoed by CR
                  </Text>
                  <Text className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed">
                    A Class Representative dismissed this cancellation report. Regular class remains in session.
                  </Text>
                </View>
              </View>
            ) : (
              <View className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-5">
                <View className="flex-row items-center space-x-1.5 mb-1">
                  <AlertTriangle size={14} color="#d97706" />
                  <Text className="text-xs font-black text-amber-950">
                    Active Verification Quorum
                  </Text>
                </View>
                <Text className="text-[11px] text-amber-800 leading-relaxed">
                  Is the instructor absent or class called off? 3 affirmative votes and a {'>'} 2x denial ratio are required to automatically cancel this session.
                </Text>

                {/* Live Vote Progress Bar */}
                <View className="mt-3 pt-3 border-t border-amber-200/60 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <ThumbsUp size={13} color="#d97706" />
                    <Text className="text-xs font-bold text-amber-900 ml-1">
                      {affirms} {affirms === 1 ? 'Vote' : 'Votes'} Cancelled
                    </Text>
                  </View>

                  <View className="flex-row items-center">
                    <ThumbsDown size={13} color="#71717a" />
                    <Text className="text-xs font-bold text-neutral-600 ml-1">
                      {denials} {denials === 1 ? 'Vote' : 'Votes'} In Session
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Error Message */}
            {actionError && (
              <View className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <Text className="text-xs font-semibold text-rose-800">{actionError}</Text>
              </View>
            )}

            {/* Voting Buttons (only when pending) */}
            {!isConfirmed && !isVetoed && (
              <View className="space-y-3 mb-6">
                <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Cast Your Vote
                </Text>

                {/* Confirm Cancelled Button */}
                <Pressable
                  onPress={() => handleVote('affirm')}
                  disabled={isVoting}
                  className={`w-full py-3.5 px-4 rounded-2xl flex-row items-center justify-center border shadow-xs mb-2.5 ${
                    userVote === 'affirm'
                      ? 'bg-rose-600 border-rose-600'
                      : 'bg-rose-50 border-rose-200 active:bg-rose-100'
                  }`}
                >
                  {isVoting ? (
                    <ActivityIndicator size="small" color="#e11d48" />
                  ) : (
                    <>
                      <ThumbsUp
                        size={16}
                        color={userVote === 'affirm' ? '#ffffff' : '#e11d48'}
                      />
                      <Text
                        className={`text-xs font-bold ml-2 ${
                          userVote === 'affirm' ? 'text-white font-black' : 'text-rose-700'
                        }`}
                      >
                        {userVote === 'affirm' ? '✓ You Voted: Class Cancelled' : 'Confirm Class Cancelled'}
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Deny / Class is On Button */}
                <Pressable
                  onPress={() => handleVote('deny')}
                  disabled={isVoting}
                  className={`w-full py-3.5 px-4 rounded-2xl flex-row items-center justify-center border shadow-xs ${
                    userVote === 'deny'
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'bg-emerald-50 border-emerald-200 active:bg-emerald-100'
                  }`}
                >
                  <ThumbsDown
                    size={16}
                    color={userVote === 'deny' ? '#ffffff' : '#059669'}
                  />
                  <Text
                    className={`text-xs font-bold ml-2 ${
                      userVote === 'deny' ? 'text-white font-black' : 'text-emerald-700'
                    }`}
                  >
                    {userVote === 'deny' ? '✓ You Voted: Class In Session' : 'Deny (Class Is In Session)'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* CR Administrative Veto Authority */}
            {isAdmin && report && !isVetoed && (
              <View className="mt-4 pt-4 border-t border-neutral-200">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    CR Administrative Authority
                  </Text>
                  <View className="bg-purple-100 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-bold text-purple-800">CR Veto</Text>
                  </View>
                </View>

                {isVetoFormOpen ? (
                  <View className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mt-2">
                    <Text className="text-xs font-bold text-rose-950 mb-1">
                      Dismiss Peer Report & Restore Class
                    </Text>
                    <TextInput
                      value={vetoReason}
                      onChangeText={setVetoReason}
                      placeholder="Optional reason (e.g. Professor arrived 15m late)"
                      placeholderTextColor="#a1a1aa"
                      className="bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs text-neutral-800 mb-3"
                    />

                    <View className="flex-row space-x-2">
                      <Pressable
                        onPress={() => setIsVetoFormOpen(false)}
                        className="flex-1 py-2.5 bg-white border border-neutral-200 rounded-xl items-center"
                      >
                        <Text className="text-xs font-bold text-neutral-700">Cancel</Text>
                      </Pressable>

                      <Pressable
                        onPress={handleVeto}
                        disabled={isVetoing}
                        className="flex-1 py-2.5 bg-rose-600 rounded-xl items-center ml-2"
                      >
                        {isVetoing ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text className="text-xs font-bold text-white">Execute Veto</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setIsVetoFormOpen(true)}
                    className="w-full py-3 bg-neutral-900 rounded-2xl flex-row items-center justify-center active:bg-neutral-800 shadow-sm"
                  >
                    <Ban size={15} color="#ffffff" />
                    <Text className="text-xs font-bold text-white ml-2">
                      Veto & Squash Report (CR Override)
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
