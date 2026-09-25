// ============================================================================
// ClassSync Peer Class Verification Modal
// File: src/components/peer/PeerVotingModal.tsx
// Description: Overhauled decentralized consensus modal generated via Stitch UI.
//              Features visual quorum progress meter, Affirm/Deny actions,
//              and Class Representative Veto override controls.
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import {
  X,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Clock,
  MapPin,
  Check,
  AlertTriangle,
  Crown,
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

  const courseTitle = block.course?.name || block.title || 'Academic Session';
  const courseCode = block.course?.code || 'CLASS';
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
        <View className="bg-white rounded-t-3xl max-h-[85%] overflow-hidden shadow-2xl border-t border-neutral-200/80">
          {/* 1. Modal Grab Handle & Header */}
          <View className="px-6 pt-2 pb-3 border-b border-neutral-100 bg-[#FAFAF9]">
            <View className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-2.5" />
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center space-x-2.5 flex-1 mr-2">
                <View className="w-9 h-9 rounded-2xl bg-[#FACC15] items-center justify-center shadow-2xs">
                  <ShieldAlert size={18} color="#18181B" strokeWidth={2.4} />
                </View>
                <View className="ml-1.5 flex-1">
                  <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                    Decentralized Consensus
                  </Text>
                  <Text className="text-base font-black text-neutral-900 tracking-tight" numberOfLines={1}>
                    Peer Class Verification
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onClose}
                hitSlop={10}
                className="w-8 h-8 rounded-full bg-neutral-200/80 items-center justify-center active:bg-neutral-300"
                accessibilityLabel="Close Modal"
              >
                <X size={16} color="#18181B" />
              </Pressable>
            </View>
          </View>

          <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Error Message */}
            {actionError && (
              <View className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex-row items-center space-x-2">
                <AlertTriangle size={15} color="#E11D48" />
                <Text className="text-xs text-rose-700 font-bold flex-1 ml-1.5">
                  {actionError}
                </Text>
              </View>
            )}

            {/* 2. Academic Session Card */}
            <View className="p-4 bg-neutral-50 border border-neutral-200/80 rounded-2xl mb-4">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="bg-neutral-200/80 px-2 py-0.5 rounded-md">
                  <Text className="text-[10px] font-black font-mono text-neutral-800">
                    {courseCode}
                  </Text>
                </View>
                <Text className="text-xs font-semibold text-neutral-400">
                  {targetDate}
                </Text>
              </View>

              <Text className="text-base font-black text-neutral-900 tracking-tight" numberOfLines={2}>
                {courseTitle}
              </Text>

              <View className="flex-row items-center space-x-3 mt-2 text-neutral-500">
                <View className="flex-row items-center">
                  <Clock size={12} color="#71717A" />
                  <Text className="text-xs text-neutral-700 ml-1 font-bold">
                    {startTime} - {endTime}
                  </Text>
                </View>
                {block.room && (
                  <View className="flex-row items-center ml-2">
                    <MapPin size={12} color="#71717A" />
                    <Text className="text-xs text-neutral-700 ml-1 font-medium">
                      {block.room}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 3. Consensus Quorum Progress Meter */}
            <View className="p-4 bg-white border border-neutral-200/90 rounded-2xl mb-4 shadow-2xs">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">
                  Consensus Quorum Status
                </Text>
                {isConfirmed ? (
                  <View className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-200 flex-row items-center space-x-1">
                    <AlertTriangle size={10} color="#E11D48" />
                    <Text className="text-[10px] font-black text-rose-800 uppercase">Confirmed Cancelled</Text>
                  </View>
                ) : isVetoed ? (
                  <View className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                    <Text className="text-[10px] font-bold text-neutral-600 uppercase">Vetoed by CR</Text>
                  </View>
                ) : (
                  <View className="px-2 py-0.5 rounded-full bg-[#FACC15]/20 border border-[#FACC15]/50 flex-row items-center space-x-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
                    <Text className="text-[10px] font-black text-amber-950 uppercase ml-0.5">Voting Live</Text>
                  </View>
                )}
              </View>

              {/* Progress 3-Bar Segments */}
              <View className="flex-row space-x-1.5 my-2">
                {[1, 2, 3].map((step) => {
                  const isFilled = step <= Math.min(affirms, 3);
                  return (
                    <View
                      key={step}
                      className={`h-2 flex-1 rounded-full ${
                        isFilled
                          ? isConfirmed
                            ? 'bg-rose-500'
                            : 'bg-[#FACC15]'
                          : 'bg-neutral-200'
                      }`}
                    />
                  );
                })}
              </View>

              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-xs font-bold text-neutral-800">
                  {affirms} of 3 affirmations verified
                </Text>
                <Text className="text-[11px] font-semibold text-neutral-400">
                  {denials} denial{denials === 1 ? '' : 's'}
                </Text>
              </View>
            </View>

            {/* 4. Student Voting Actions */}
            {!isConfirmed && !isVetoed && (
              <View className="space-y-2 mb-4">
                <Text className="text-[11px] font-black text-neutral-400 uppercase tracking-wider px-1">
                  Cast Your Verification Vote
                </Text>

                <View className="flex-row items-center space-x-2.5 mt-1">
                  {/* Affirm / Confirm Cancelled */}
                  <Pressable
                    onPress={() => handleVote('affirm')}
                    disabled={isVoting}
                    className={`flex-1 py-3.5 px-4 rounded-2xl flex-row items-center justify-center space-x-2 border transition-all ${
                      userVote === 'affirm'
                        ? 'bg-[#FACC15] border-[#EAB308] shadow-sm'
                        : 'bg-white border-neutral-200/80 active:bg-neutral-50'
                    }`}
                  >
                    <ThumbsUp
                      size={16}
                      color="#18181B"
                      strokeWidth={userVote === 'affirm' ? 2.5 : 2}
                    />
                    <Text className="text-xs font-black text-neutral-950 ml-1">
                      Confirm Cancelled
                    </Text>
                  </Pressable>

                  {/* Deny / Class In Session */}
                  <Pressable
                    onPress={() => handleVote('deny')}
                    disabled={isVoting}
                    className={`flex-1 py-3.5 px-4 rounded-2xl flex-row items-center justify-center space-x-2 border transition-all ${
                      userVote === 'deny'
                        ? 'bg-neutral-900 border-neutral-900 shadow-sm'
                        : 'bg-white border-neutral-200/80 active:bg-neutral-50'
                    }`}
                  >
                    <ThumbsDown
                      size={16}
                      color={userVote === 'deny' ? '#ffffff' : '#71717A'}
                      strokeWidth={userVote === 'deny' ? 2.5 : 2}
                    />
                    <Text
                      className={`text-xs ml-1 ${
                        userVote === 'deny'
                          ? 'font-black text-white'
                          : 'font-bold text-neutral-700'
                      }`}
                    >
                      Class In Session
                    </Text>
                  </Pressable>
                </View>

                {userVote && (
                  <View className="p-2.5 bg-neutral-100 rounded-xl flex-row items-center space-x-1.5 mt-2">
                    <Check size={13} color="#059669" strokeWidth={2.5} />
                    <Text className="text-[11px] font-semibold text-neutral-700 ml-1">
                      You voted: {userVote === 'affirm' ? 'Confirm Cancelled' : 'Class In Session'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 5. Class Representative Veto Panel */}
            {isAdmin && report && (
              <View className="mt-4 p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                <View className="flex-row items-center space-x-2 mb-1.5">
                  <Crown size={15} color="#B45309" />
                  <Text className="text-xs font-black text-amber-950 uppercase tracking-tight ml-1">
                    CR Override Authority
                  </Text>
                </View>
                <Text className="text-xs text-amber-900 leading-relaxed font-medium mb-3">
                  As the Class Representative, you have authoritative veto power to overturn fraudulent student reports.
                </Text>

                {isVetoFormOpen ? (
                  <View className="space-y-2.5">
                    <TextInput
                      value={vetoReason}
                      onChangeText={setVetoReason}
                      placeholder="Reason for veto (e.g. Instructor arrived 15m late)"
                      placeholderTextColor="#A1A1AA"
                      className="bg-white border border-amber-300 rounded-xl p-3 text-xs font-medium text-neutral-900"
                    />
                    <View className="flex-row items-center space-x-2">
                      <Pressable
                        onPress={handleVeto}
                        disabled={isVetoing}
                        className="flex-1 py-2.5 bg-rose-600 rounded-xl items-center justify-center active:bg-rose-700"
                      >
                        {isVetoing ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text className="text-xs font-bold text-white">
                            Confirm Veto
                          </Text>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => setIsVetoFormOpen(false)}
                        className="py-2.5 px-4 bg-white border border-neutral-200 rounded-xl items-center justify-center"
                      >
                        <Text className="text-xs font-bold text-neutral-700">Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setIsVetoFormOpen(true)}
                    className="py-2.5 px-4 bg-white border border-amber-300 rounded-xl items-center justify-center active:bg-amber-100/50"
                  >
                    <Text className="text-xs font-black text-amber-900">
                      Veto This Report
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
