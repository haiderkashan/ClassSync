import NetInfo from '@react-native-community/netinfo';
import {
  checkIsOnline,
  castPeerVoteOnline,
  vetoPeerReportOnline,
  isPeerVotingWindowOpen,
} from '@/services/peerVerificationService';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

describe('Phase 8.4: Decentralized Peer Verification & Quorum Consensus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Offline-Rejection Logic (Strict Mutation Queue Bypass)', () => {
    const mockSupabase: any = {
      rpc: jest.fn(),
    };

    it('rejects peer vote immediately when offline to prevent stale replay attacks', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      });

      await expect(
        castPeerVoteOnline(mockSupabase, {
          baseScheduleId: 'block-123',
          reportDate: '2026-09-24',
          vote: 'affirm',
        })
      ).rejects.toThrow(/OFFLINE_PEER_VOTE_BLOCKED/);

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('rejects CR veto immediately when device is offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      });

      await expect(
        vetoPeerReportOnline(mockSupabase, {
          reportId: 'rep-456',
          reason: 'Professor arrived 10m late',
        })
      ).rejects.toThrow(/OFFLINE_PEER_VETO_BLOCKED/);

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('successfully calls cast_peer_vote RPC when device is online', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: { report_id: 'rep-1', status: 'pending', affirmation_count: 1, denial_count: 0 },
        error: null,
      });

      const result = await castPeerVoteOnline(mockSupabase, {
        baseScheduleId: 'block-123',
        reportDate: '2026-09-24',
        vote: 'affirm',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('cast_peer_vote', {
        p_base_schedule_id: 'block-123',
        p_report_date: '2026-09-24',
        p_vote: 'affirm',
      });
      expect(result).toEqual({
        report_id: 'rep-1',
        status: 'pending',
        affirmation_count: 1,
        denial_count: 0,
      });
    });

    it('successfully calls veto_peer_report RPC when device is online', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: { report_id: 'rep-1', status: 'vetoed' },
        error: null,
      });

      const result = await vetoPeerReportOnline(mockSupabase, {
        reportId: 'rep-1',
        reason: 'False report',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('veto_peer_report', {
        p_report_id: 'rep-1',
        p_reason: 'False report',
      });
      expect(result).toEqual({ report_id: 'rep-1', status: 'vetoed' });
    });
  });

  describe('2. UI Temporal Reporting Window Bounds [-10m, +30m]', () => {
    const originalDate = (globalThis as any).Date;

    afterEach(() => {
      (globalThis as any).Date = originalDate;
    });

    function mockCurrentTime(isoString: string) {
      const fixedTime = new originalDate(isoString).getTime();
      class MockDate extends originalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(fixedTime);
          } else {
            // @ts-ignore
            super(...args);
          }
        }
        static now() {
          return fixedTime;
        }
      }
      (globalThis as any).Date = MockDate as any;
    }

    it('returns isBefore = true when more than 10 minutes before class start', () => {
      mockCurrentTime('2026-09-24T09:45:00Z'); // 15 mins before 10:00:00
      const window = isPeerVotingWindowOpen('2026-09-24', '10:00:00');

      expect(window.isOpen).toBe(false);
      expect(window.isBefore).toBe(true);
      expect(window.isAfter).toBe(false);
      expect(window.minutesUntilOpen).toBe(5);
    });

    it('returns isOpen = true exactly 10 minutes before class start', () => {
      mockCurrentTime('2026-09-24T09:50:00Z'); // 10 mins before 10:00:00
      const window = isPeerVotingWindowOpen('2026-09-24', '10:00:00');

      expect(window.isOpen).toBe(true);
      expect(window.isBefore).toBe(false);
      expect(window.isAfter).toBe(false);
    });

    it('returns isOpen = true right at class start time', () => {
      mockCurrentTime('2026-09-24T10:00:00Z');
      const window = isPeerVotingWindowOpen('2026-09-24', '10:00:00');

      expect(window.isOpen).toBe(true);
      expect(window.isBefore).toBe(false);
      expect(window.isAfter).toBe(false);
    });

    it('returns isOpen = true at 25 minutes after class start', () => {
      mockCurrentTime('2026-09-24T10:25:00Z');
      const window = isPeerVotingWindowOpen('2026-09-24', '10:00:00');

      expect(window.isOpen).toBe(true);
      expect(window.isBefore).toBe(false);
      expect(window.isAfter).toBe(false);
    });

    it('returns isAfter = true when more than 30 minutes after class start', () => {
      mockCurrentTime('2026-09-24T10:35:00Z'); // 35 mins after 10:00:00
      const window = isPeerVotingWindowOpen('2026-09-24', '10:00:00');

      expect(window.isOpen).toBe(false);
      expect(window.isBefore).toBe(false);
      expect(window.isAfter).toBe(true);
    });
  });

  describe('3. Quorum Math & 2x Denial Weighting Formula', () => {
    function evaluateQuorum(affirms: number, denials: number): boolean {
      return affirms >= 3 && affirms > 2 * denials;
    }

    it('requires minimum 3 affirmative votes for quorum', () => {
      expect(evaluateQuorum(0, 0)).toBe(false);
      expect(evaluateQuorum(1, 0)).toBe(false);
      expect(evaluateQuorum(2, 0)).toBe(false);
      expect(evaluateQuorum(3, 0)).toBe(true);
    });

    it('enforces 2x denial weighting against affirmations', () => {
      // 3 affirms vs 1 denial: 3 > 2*(1) -> True
      expect(evaluateQuorum(3, 1)).toBe(true);

      // 3 affirms vs 2 denials: 3 <= 2*(2)=4 -> False
      expect(evaluateQuorum(3, 2)).toBe(false);

      // 4 affirms vs 2 denials: 4 <= 2*(2)=4 -> False (tie breaks to class in session)
      expect(evaluateQuorum(4, 2)).toBe(false);

      // 5 affirms vs 2 denials: 5 > 2*(2)=4 -> True
      expect(evaluateQuorum(5, 2)).toBe(true);

      // 10 affirms vs 5 denials: 10 <= 2*(5)=10 -> False
      expect(evaluateQuorum(10, 5)).toBe(false);

      // 10 affirms vs 4 denials: 10 > 2*(4)=8 -> True
      expect(evaluateQuorum(10, 4)).toBe(true);
    });
  });
});
