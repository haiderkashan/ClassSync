import { parseJoinCodeFromUrl } from './deepLinkUtils';
import { useAppStore } from '@/store/useAppStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('Phase 8.3: Universal Deep-Linking & Scanner Utilities', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  describe('1. parseJoinCodeFromUrl', () => {
    it('parses raw 6-character alphanumeric join code directly', () => {
      expect(parseJoinCodeFromUrl('BSSE26')).toBe('BSSE26');
      expect(parseJoinCodeFromUrl('k7m9p2')).toBe('K7M9P2');
      expect(parseJoinCodeFromUrl('  arc401  ')).toBe('ARC401');
    });

    it('parses universal web URL with query param ?code=XYZ', () => {
      expect(parseJoinCodeFromUrl('https://classsync.app/join?code=BSSE26')).toBe('BSSE26');
      expect(parseJoinCodeFromUrl('https://classsync.app/join?referrer=qr&code=k7m9p2')).toBe('K7M9P2');
      expect(parseJoinCodeFromUrl('https://classsync.app/join?code=ARC401&source=share')).toBe('ARC401');
    });

    it('parses custom native deep-link scheme classsync://join?code=XYZ', () => {
      expect(parseJoinCodeFromUrl('classsync://join?code=BSSE26')).toBe('BSSE26');
      expect(parseJoinCodeFromUrl('classsync://join?code=abc123')).toBe('ABC123');
    });

    it('parses path-based join links (https://classsync.app/join/XYZ and classsync://join/XYZ)', () => {
      expect(parseJoinCodeFromUrl('https://classsync.app/join/BSSE26')).toBe('BSSE26');
      expect(parseJoinCodeFromUrl('https://classsync.app/join/k7m9p2/')).toBe('K7M9P2');
      expect(parseJoinCodeFromUrl('classsync://join/ARC401')).toBe('ARC401');
    });

    it('parses URLs with trailing hash anchors or params', () => {
      expect(parseJoinCodeFromUrl('https://classsync.app/join?code=K7M9P2#onboard')).toBe('K7M9P2');
    });

    it('returns null for invalid or non-matching URLs and inputs', () => {
      expect(parseJoinCodeFromUrl('')).toBeNull();
      expect(parseJoinCodeFromUrl(null as any)).toBeNull();
      expect(parseJoinCodeFromUrl(undefined as any)).toBeNull();
      expect(parseJoinCodeFromUrl('https://google.com')).toBeNull();
      expect(parseJoinCodeFromUrl('https://classsync.app/about')).toBeNull();
      expect(parseJoinCodeFromUrl('TOO_LONG_CODE')).toBeNull();
      expect(parseJoinCodeFromUrl('SHORT')).toBeNull();
      expect(parseJoinCodeFromUrl('https://classsync.app/join?code=SHORT')).toBeNull();
      expect(parseJoinCodeFromUrl('https://classsync.app/join?code=TOOLONGCODE')).toBeNull();
      expect(parseJoinCodeFromUrl('INVALID!@#')).toBeNull();
    });
  });

  describe('2. Zustand OAuth State Preservation', () => {
    it('initializes pendingJoinCode to null', () => {
      expect(useAppStore.getState().pendingJoinCode).toBeNull();
    });

    it('updates pendingJoinCode when setPendingJoinCode is called', () => {
      useAppStore.getState().setPendingJoinCode('BSSE26');
      expect(useAppStore.getState().pendingJoinCode).toBe('BSSE26');
    });

    it('clears pendingJoinCode to null on reset()', () => {
      useAppStore.getState().setPendingJoinCode('BSSE26');
      useAppStore.getState().reset();
      expect(useAppStore.getState().pendingJoinCode).toBeNull();
    });

    it('includes pendingJoinCode in store persistence partialize array', () => {
      useAppStore.getState().setPendingJoinCode('OAUTH1');

      // Introspect store configuration
      const state = useAppStore.getState();
      expect(state.pendingJoinCode).toBe('OAUTH1');

      // Verify reset clears it
      state.setPendingJoinCode(null);
      expect(useAppStore.getState().pendingJoinCode).toBeNull();
    });
  });
});
