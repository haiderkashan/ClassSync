import { useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { useAuth } from '@clerk/expo';
import type { Tables } from '@/types/database.types';
import {
  castPeerVoteOnline,
  vetoPeerReportOnline,
  isPeerVotingWindowOpen,
  type PeerVotingWindowResult,
} from '@/services/peerVerificationService';

export type PeerReportWithVotes = Tables<'peer_schedule_reports'> & {
  votes?: Tables<'peer_report_votes'>[];
};

export interface UsePeerVerificationOptions {
  sectionId?: string | null;
  targetDate: string; // YYYY-MM-DD
  enabled?: boolean;
}

/**
 * Reactive hook for crowd-sourced peer verification.
 * 1. Fetches active reports and student votes for a section and calendar date.
 * 2. Connects live Supabase Realtime WebSockets to update quorum counts and status changes.
 * 3. Provides online-only voting and CR administrative veto actions.
 */
export function usePeerVerification(options: UsePeerVerificationOptions) {
  const { sectionId, targetDate, enabled = true } = options;
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  const queryKey = useMemo(
    () => ['peer_schedule_reports', sectionId, targetDate],
    [sectionId, targetDate]
  );

  // 1. Fetch peer reports for section and date
  const {
    data: reports = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey,
    enabled: enabled && !!sectionId && !!targetDate,
    queryFn: async () => {
      if (!sectionId || !targetDate) return [];

      const { data, error } = await supabase
        .from('peer_schedule_reports')
        .select('*, votes:peer_report_votes(*)')
        .eq('section_id', sectionId)
        .eq('report_date', targetDate);

      if (error) {
        console.warn('⚠️ [usePeerVerification] Error loading reports:', error.message);
        return [];
      }

      return (data || []) as PeerReportWithVotes[];
    },
  });

  // 2. Realtime WebSocket listener for live consensus updates
  useEffect(() => {
    if (!enabled || !sectionId || !targetDate) return;

    const channelName = `realtime_peer_verification_${sectionId}_${targetDate}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'peer_schedule_reports',
          filter: `section_id=eq.${sectionId}`,
        },
        (payload) => {
          console.log('⚡ [PeerVerification] Live report change received:', payload.eventType);
          queryClient.invalidateQueries({ queryKey });
          // If a report was confirmed or vetoed, invalidate schedule overrides to update timetable
          queryClient.invalidateQueries({ queryKey: ['schedule_overrides'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'peer_report_votes',
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, sectionId, targetDate, supabase, queryClient, queryKey]);

  // 3. Online-Only Vote Mutation
  const castVoteMutation = useMutation({
    mutationFn: async ({
      baseScheduleId,
      vote,
    }: {
      baseScheduleId: string;
      vote: 'affirm' | 'deny';
    }) => {
      return castPeerVoteOnline(supabase, {
        baseScheduleId,
        reportDate: targetDate,
        vote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['schedule_overrides'] });
    },
  });

  // 4. Online-Only CR Veto Mutation
  const vetoMutation = useMutation({
    mutationFn: async ({
      reportId,
      reason,
    }: {
      reportId: string;
      reason?: string;
    }) => {
      return vetoPeerReportOnline(supabase, {
        reportId,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['schedule_overrides'] });
    },
  });

  // Helper: Find report for a given base schedule block
  const getReportForBlock = useCallback(
    (baseScheduleId: string): PeerReportWithVotes | undefined => {
      return reports.find((r) => r.base_schedule_id === baseScheduleId);
    },
    [reports]
  );

  // Helper: Find current user's vote on a report
  const getUserVoteForBlock = useCallback(
    (baseScheduleId: string): 'affirm' | 'deny' | null => {
      if (!userId) return null;
      const report = reports.find((r) => r.base_schedule_id === baseScheduleId);
      if (!report || !report.votes) return null;
      const userVote = report.votes.find((v) => v.user_id === userId);
      return (userVote?.vote as 'affirm' | 'deny') ?? null;
    },
    [reports, userId]
  );

  return {
    reports,
    isLoading,
    isRefetching,
    refetch,
    castVote: castVoteMutation.mutateAsync,
    isCastingVote: castVoteMutation.isPending,
    castVoteError: castVoteMutation.error,
    vetoReport: vetoMutation.mutateAsync,
    isVetoing: vetoMutation.isPending,
    vetoError: vetoMutation.error,
    getReportForBlock,
    getUserVoteForBlock,
    checkVotingWindow: isPeerVotingWindowOpen,
  };
}
