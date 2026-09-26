import {
  filterGenesisCrSections,
  isGenesisCrBlocked,
  executeAccountDeletion,
  type DeleteAccountDependencies,
} from '@/services/deleteAccountService';
import type { SectionRow } from '@/store/useAppStore';

describe('Phase 9.1: Account Deletion Engine & Genesis CR Guard (Apple 5.1.1v)', () => {
  const mockSupabase: any = {
    rpc: jest.fn(),
  };

  const mockClerkUser = {
    delete: jest.fn(),
  };

  const mockResetLocalDb = jest.fn();
  const mockClearStorage = jest.fn();
  const mockResetStore = jest.fn();

  const createDeps = (): DeleteAccountDependencies => ({
    supabase: mockSupabase,
    clerkUser: mockClerkUser,
    resetLocalDb: mockResetLocalDb,
    clearStorage: mockClearStorage,
    resetStore: mockResetStore,
  });

  const createMockSection = (overrides: Partial<SectionRow>): SectionRow => ({
    id: 'sec-default',
    name: 'Sample Section',
    created_at: '2026-09-01T00:00:00Z',
    created_by: 'usr-cr',
    cycle_mode: 'standard_weekly',
    cycle_naming_convention: 'letter_ab',
    institution_tag: 'Stanford University',
    is_archived: false,
    join_code: 'CODE01',
    semester_start_date: null,
    timezone: 'America/New_York',
    total_instructional_weeks: 16,
    updated_at: '2026-09-01T00:00:00Z',
    week_a_anchor_date: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.rpc.mockResolvedValue({ error: null });
    mockClerkUser.delete.mockResolvedValue(undefined);
    mockClearStorage.mockResolvedValue(undefined);
  });

  describe('1. Genesis CR Orphan Safeguard Evaluation', () => {
    it('returns empty array and false when sections list is empty or null', () => {
      expect(filterGenesisCrSections([])).toEqual([]);
      expect(isGenesisCrBlocked([])).toBe(false);
      expect(filterGenesisCrSections(null)).toEqual([]);
      expect(isGenesisCrBlocked(null)).toBe(false);
    });

    it('returns false for standard student or co-admin roles', () => {
      const studentSections: SectionRow[] = [
        createMockSection({
          id: 'sec-1',
          name: 'Section A',
          role: 'student',
        }),
        createMockSection({
          id: 'sec-2',
          name: 'Section B',
          role: 'co_admin',
        }),
      ];

      expect(filterGenesisCrSections(studentSections)).toEqual([]);
      expect(isGenesisCrBlocked(studentSections)).toBe(false);
    });

    it('flags true and returns the section when role is genesis_cr', () => {
      const sections: SectionRow[] = [
        createMockSection({
          id: 'sec-1',
          name: 'BSCS Fall 2026',
          role: 'genesis_cr',
        }),
        createMockSection({
          id: 'sec-2',
          name: 'Elective 101',
          role: 'student',
        }),
      ];

      const genesisList = filterGenesisCrSections(sections);
      expect(genesisList).toHaveLength(1);
      expect(genesisList[0].name).toBe('BSCS Fall 2026');
      expect(isGenesisCrBlocked(sections)).toBe(true);
    });
  });

  describe('2. Atomic Cascade Purge Execution', () => {
    it('strictly blocks deletion and returns safeguard error if user is Genesis CR', async () => {
      const genesisSections: SectionRow[] = [
        createMockSection({
          id: 'sec-1',
          name: 'Cohort Alpha',
          role: 'genesis_cr',
        }),
      ];

      const deps = createDeps();
      const result = await executeAccountDeletion(genesisSections, deps);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot delete account: You are the Genesis CR');
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(mockClerkUser.delete).not.toHaveBeenCalled();
      expect(mockResetLocalDb).not.toHaveBeenCalled();
      expect(mockClearStorage).not.toHaveBeenCalled();
      expect(mockResetStore).not.toHaveBeenCalled();
    });

    it('completes entire atomic cascade purge for standard student user', async () => {
      const studentSections: SectionRow[] = [
        createMockSection({
          id: 'sec-9',
          name: 'Cohort Beta',
          role: 'student',
        }),
      ];

      const deps = createDeps();
      const result = await executeAccountDeletion(studentSections, deps);

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_user_account');
      expect(mockClerkUser.delete).toHaveBeenCalledTimes(1);
      expect(mockResetLocalDb).toHaveBeenCalledTimes(1);
      expect(mockClearStorage).toHaveBeenCalledTimes(1);
      expect(mockResetStore).toHaveBeenCalledTimes(1);
    });

    it('gracefully aborts without destroying Clerk session or client store when RPC fails', async () => {
      const studentSections: SectionRow[] = [
        createMockSection({
          id: 'sec-9',
          name: 'Cohort Beta',
          role: 'student',
        }),
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        error: { message: 'CANNOT_DELETE_GENESIS_CR: Database guard triggered' },
      });

      const deps = createDeps();
      const result = await executeAccountDeletion(studentSections, deps);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CANNOT_DELETE_GENESIS_CR: Database guard triggered');
      expect(mockClerkUser.delete).not.toHaveBeenCalled();
      expect(mockResetLocalDb).not.toHaveBeenCalled();
      expect(mockResetStore).not.toHaveBeenCalled();
    });

    it('survives local storage or SQLite reset exceptions and still resets store', async () => {
      const studentSections: SectionRow[] = [];
      const deps = createDeps();
      deps.resetLocalDb = () => {
        throw new Error('SQLite lock conflict');
      };
      deps.clearStorage = jest.fn().mockRejectedValueOnce(new Error('AsyncStorage disk IO'));

      const result = await executeAccountDeletion(studentSections, deps);

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_user_account');
      expect(mockClerkUser.delete).toHaveBeenCalled();
      expect(mockResetStore).toHaveBeenCalled();
    });
  });
});
