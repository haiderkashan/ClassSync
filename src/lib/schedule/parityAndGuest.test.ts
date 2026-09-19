jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useAppStore, type BaseScheduleRow, type WeekParity } from '@/store/useAppStore';

describe('Phase 3.6: Agenda Parity & Guest Views Store and Filter Logic', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  describe('1. Parity State Management in Zustand Store', () => {
    it('defaults currentParity to "weekly"', () => {
      expect(useAppStore.getState().currentParity).toBe('weekly');
    });

    it('updates currentParity to "biweekly_week_a" and "biweekly_week_b"', () => {
      useAppStore.getState().setCurrentParity('biweekly_week_a');
      expect(useAppStore.getState().currentParity).toBe('biweekly_week_a');

      useAppStore.getState().setCurrentParity('biweekly_week_b');
      expect(useAppStore.getState().currentParity).toBe('biweekly_week_b');

      useAppStore.getState().setCurrentParity('weekly');
      expect(useAppStore.getState().currentParity).toBe('weekly');
    });

    it('resets currentParity back to "weekly" on reset()', () => {
      useAppStore.getState().setCurrentParity('biweekly_week_a');
      useAppStore.getState().reset();
      expect(useAppStore.getState().currentParity).toBe('weekly');
    });
  });

  describe('2. Agenda Parity Filter Logic', () => {
    const mockBlocks: BaseScheduleRow[] = [
      {
        id: 'block-1',
        course_id: 'c-1',
        day_of_week: 1, // Monday
        start_time: '09:00:00',
        end_time: '10:00:00',
        session_type: 'lecture',
        frequency: 'weekly',
        room: 'Room 101',
        instructor: 'Prof. Turing',
        color_override: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        course: {
          id: 'c-1',
          name: 'Computer Architecture',
          code: 'CS-201',
          section_id: 'sec-1',
          color_hex: '#4F46E5',
          created_at: '',
          guest_invite_token: 'GUEST',
          is_archived: false,
          join_code: 'JOIN1',
          updated_at: '',
        },
      },
      {
        id: 'block-2',
        course_id: 'c-2',
        day_of_week: 1, // Monday
        start_time: '10:00:00',
        end_time: '11:30:00',
        session_type: 'lab',
        frequency: 'biweekly_week_a',
        room: 'CS Lab A',
        instructor: 'Dr. Hopper',
        color_override: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        course: {
          id: 'c-2',
          name: 'Web Engineering Lab A',
          code: 'CS-301L',
          section_id: 'sec-1',
          color_hex: '#059669',
          created_at: '',
          guest_invite_token: 'GUEST2',
          is_archived: false,
          join_code: 'JOIN2',
          updated_at: '',
        },
      },
      {
        id: 'block-3',
        course_id: 'c-3',
        day_of_week: 1, // Monday
        start_time: '10:00:00',
        end_time: '11:30:00',
        session_type: 'lab',
        frequency: 'biweekly_week_b',
        room: 'CS Lab B',
        instructor: 'Dr. Lovelace',
        color_override: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        course: {
          id: 'c-3',
          name: 'Web Engineering Lab B',
          code: 'CS-301L',
          section_id: 'sec-1',
          color_hex: '#059669',
          created_at: '',
          guest_invite_token: 'GUEST3',
          is_archived: false,
          join_code: 'JOIN3',
          updated_at: '',
        },
      },
    ];

    function filterBlocksForParity(blocks: BaseScheduleRow[], dayOfWeek: number, parity: WeekParity) {
      return blocks
        .filter((block) => {
          if (block.day_of_week !== dayOfWeek) return false;
          if (parity === 'biweekly_week_a') {
            return block.frequency !== 'biweekly_week_b';
          }
          if (parity === 'biweekly_week_b') {
            return block.frequency !== 'biweekly_week_a';
          }
          return true;
        })
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }

    it('shows only Week A classes and weekly classes when parity is "biweekly_week_a"', () => {
      const filtered = filterBlocksForParity(mockBlocks, 1, 'biweekly_week_a');
      expect(filtered.map((b) => b.id)).toEqual(['block-1', 'block-2']);
      expect(filtered.find((b) => b.id === 'block-3')).toBeUndefined();
    });

    it('shows only Week B classes and weekly classes when parity is "biweekly_week_b"', () => {
      const filtered = filterBlocksForParity(mockBlocks, 1, 'biweekly_week_b');
      expect(filtered.map((b) => b.id)).toEqual(['block-1', 'block-3']);
      expect(filtered.find((b) => b.id === 'block-2')).toBeUndefined();
    });

    it('shows all classes (weekly + Week A + Week B) when parity is "weekly"', () => {
      const filtered = filterBlocksForParity(mockBlocks, 1, 'weekly');
      expect(filtered.map((b) => b.id)).toEqual(['block-1', 'block-2', 'block-3']);
    });
  });

  describe('3. Standalone Guest Student Course Store Population', () => {
    it('populates activeCourses for standalone guest enrollments without activeSectionId', () => {
      useAppStore.getState().setActiveSectionId(null);
      useAppStore.getState().setActiveCourses([
        {
          id: 'course-standalone-1',
          name: 'Distributed Systems',
          code: 'CS-401',
          section_id: 'sec-external',
          color_hex: '#10B981',
          created_at: '',
          guest_invite_token: 'GUESTX',
          is_archived: false,
          join_code: 'JOINX',
          updated_at: '',
          is_guest: true,
          is_active: true,
        },
      ]);

      const state = useAppStore.getState();
      expect(state.activeSectionId).toBeNull();
      expect(state.activeCourses).toHaveLength(1);
      expect(state.activeCourses[0].is_guest).toBe(true);
      expect(state.activeCourses[0].name).toBe('Distributed Systems');
    });
  });
});
