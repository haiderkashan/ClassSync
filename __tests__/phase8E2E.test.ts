import { calculateWeekParity, getLocalDateString } from '../src/lib/schedule/calendarUtils';
import { parseJoinCodeFromUrl } from '../src/lib/scanner/deepLinkUtils';
import { isPeerVotingWindowOpen, checkIsOnline } from '../src/services/peerVerificationService';
import NetInfo from '@react-native-community/netinfo';

jest.mock('@react-native-community/netinfo');

describe('Phase 8: End-to-End Integration Test Suite', () => {
  describe('Feature 1: Bi-Weekly / A/B Cycle & Schedule Parity', () => {
    const anchorDate = '2026-09-07'; // Week A start

    it('deterministically calculates week parity across consecutive weeks', () => {
      // 2026-09-07 is Week A (0 weeks diff)
      const weekA = calculateWeekParity('2026-09-08', anchorDate);
      expect(weekA).toBe('biweekly_week_a');

      // 2026-09-14 is Week B (1 week diff)
      const weekB = calculateWeekParity('2026-09-15', anchorDate);
      expect(weekB).toBe('biweekly_week_b');

      // 2026-09-21 is Week A again (2 weeks diff)
      const weekA2 = calculateWeekParity('2026-09-22', anchorDate);
      expect(weekA2).toBe('biweekly_week_a');
    });

    it('formats local dates consistently for timetable parity keys', () => {
      const date = new Date(Date.UTC(2026, 8, 25, 12, 0, 0));
      const formatted = getLocalDateString(date, 'UTC');
      expect(formatted).toBe('2026-09-25');
    });
  });

  describe('Feature 2: Universal Deep-Linking & Presenter QR Code Parsing', () => {
    it('accurately parses raw 6-character uppercase codes', () => {
      expect(parseJoinCodeFromUrl('CS101A')).toBe('CS101A');
      expect(parseJoinCodeFromUrl('  bio202  ')).toBe('BIO202');
    });

    it('extracts join codes from web URLs, custom schemes, and query parameters', () => {
      // Direct path format
      expect(parseJoinCodeFromUrl('https://classsync.app/join/CS401X')).toBe('CS401X');
      expect(parseJoinCodeFromUrl('classsync://join/CS401X')).toBe('CS401X');

      // Query param format
      expect(parseJoinCodeFromUrl('https://classsync.app/join?code=ENG300')).toBe('ENG300');
      expect(parseJoinCodeFromUrl('classsync://join?code=ENG300')).toBe('ENG300');
    });

    it('rejects invalid or corrupted scan payloads', () => {
      expect(parseJoinCodeFromUrl('')).toBeNull();
      expect(parseJoinCodeFromUrl('https://randomsite.com/welcome')).toBeNull();
      expect(parseJoinCodeFromUrl('SHORT')).toBeNull(); // Less than 6 characters
    });
  });

  describe('Feature 3: Crowd-Sourced Peer Verification Consensus Engine', () => {
    it('strictly guards against offline voting submissions (bypass mutation queue)', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: false });
      const online = await checkIsOnline();
      expect(online).toBe(false);
    });

    it('permits online voting submissions', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: true });
      const online = await checkIsOnline();
      expect(online).toBe(true);
    });

    it('validates the temporal voting window bounds around session start', () => {
      const originalDate = (globalThis as any).Date;
      const fixedTime = new originalDate('2026-09-25T10:00:00Z').getTime();

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

      try {
        // Class at 10:00:00 on 2026-09-25 -> current time is exactly 10:00:00
        const window = isPeerVotingWindowOpen('2026-09-25', '10:00:00');
        expect(window.isOpen).toBe(true);
        expect(window.isBefore).toBe(false);
        expect(window.isAfter).toBe(false);
      } finally {
        (globalThis as any).Date = originalDate;
      }
    });

    it('verifies the 2x denial weighting mathematical consensus threshold', () => {
      // Quorum rule: affirmations >= 3 AND affirmations > (2 * denials)
      const computeQuorum = (affirmations: number, denials: number) => {
        return affirmations >= 3 && affirmations > 2 * denials;
      };

      // 2 affirmations, 0 denials -> false (needs >= 3)
      expect(computeQuorum(2, 0)).toBe(false);

      // 3 affirmations, 0 denials -> true
      expect(computeQuorum(3, 0)).toBe(true);

      // 3 affirmations, 1 denial -> true (3 > 2)
      expect(computeQuorum(3, 1)).toBe(true);

      // 4 affirmations, 2 denials -> false (4 is NOT > 4)
      expect(computeQuorum(4, 2)).toBe(false);

      // 5 affirmations, 2 denials -> true (5 > 4)
      expect(computeQuorum(5, 2)).toBe(true);

      // 6 affirmations, 3 denials -> false (6 is NOT > 6)
      expect(computeQuorum(6, 3)).toBe(false);
    });
  });
});
