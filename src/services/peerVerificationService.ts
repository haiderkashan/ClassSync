import NetInfo from '@react-native-community/netinfo';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export interface CastPeerVoteParams {
  baseScheduleId: string;
  reportDate: string;
  vote: 'affirm' | 'deny';
}

export interface VetoPeerReportParams {
  reportId: string;
  reason?: string;
}

export interface PeerVotingWindowResult {
  isOpen: boolean;
  isBefore: boolean;
  isAfter: boolean;
  minutesUntilOpen: number;
  minutesUntilClose: number;
}

/**
 * Checks whether the device has active internet connectivity.
 */
export async function checkIsOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Evaluates whether current wall-clock time falls within the temporal reporting gate:
 * [-10 minutes before class start, +30 minutes after class start].
 *
 * @param targetDate 'YYYY-MM-DD'
 * @param startTime 'HH:MM:SS' or 'HH:MM'
 * @param timezone IANA timezone string (e.g. 'America/New_York', defaults to 'UTC')
 */
export function isPeerVotingWindowOpen(
  targetDate: string,
  startTime: string,
  timezone: string = 'UTC'
): PeerVotingWindowResult {
  try {
    const [year, month, day] = targetDate.split('-').map(Number);
    const [hours, minutes] = startTime.split(':').map(Number);

    // Approximate ISO string in UTC or relative time
    const sessionDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    const now = new Date();

    const diffMs = now.getTime() - sessionDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    const isBefore = diffMinutes < -10;
    const isAfter = diffMinutes > 30;
    const isOpen = !isBefore && !isAfter;

    return {
      isOpen,
      isBefore,
      isAfter,
      minutesUntilOpen: isBefore ? Math.abs(diffMinutes + 10) : 0,
      minutesUntilClose: isOpen ? 30 - diffMinutes : 0,
    };
  } catch {
    return {
      isOpen: false,
      isBefore: false,
      isAfter: true,
      minutesUntilOpen: 0,
      minutesUntilClose: 0,
    };
  }
}

/**
 * Submits an online-only peer vote.
 * CRITICAL REQUIREMENT: Strictly bypasses the Phase 7 offline mutation queue.
 * Rejects immediately if the user is offline to prevent stale timestamp corruption.
 */
export async function castPeerVoteOnline(
  supabase: SupabaseClient<Database>,
  params: CastPeerVoteParams
) {
  const isOnline = await checkIsOnline();
  if (!isOnline) {
    throw new Error(
      'OFFLINE_PEER_VOTE_BLOCKED: Peer verification requires an active internet connection to prevent stale votes.'
    );
  }

  const { data, error } = await supabase.rpc('cast_peer_vote', {
    p_base_schedule_id: params.baseScheduleId,
    p_report_date: params.reportDate,
    p_vote: params.vote,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Executes a CR administrative veto on an active peer report.
 * Strictly online-only.
 */
export async function vetoPeerReportOnline(
  supabase: SupabaseClient<Database>,
  params: VetoPeerReportParams
) {
  const isOnline = await checkIsOnline();
  if (!isOnline) {
    throw new Error(
      'OFFLINE_PEER_VETO_BLOCKED: Vetoing requires an active internet connection.'
    );
  }

  const { data, error } = await supabase.rpc('veto_peer_report', {
    p_report_id: params.reportId,
    p_reason: params.reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
