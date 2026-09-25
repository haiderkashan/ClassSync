import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/expo';
import { useSupabase } from '@/hooks/useSupabase';
import { useAppStore, type SectionRow, type CourseRow } from '@/store/useAppStore';
import type { Tables } from '@/types/database.types';

export interface WorkspacesData {
  sections: SectionRow[];
  courses: CourseRow[];
}

/**
 * Hook to manage workspace (sections) and course enrollments.
 * Fetches data via TanStack Query and syncs directly into Zustand state.
 */
export function useWorkspaces() {
  const { user, isLoaded } = useUser();
  const supabase = useSupabase();

  const {
    activeSectionId,
    activeSections,
    activeCourses,
    setActiveSectionId,
    setActiveSections,
    setActiveCourses,
  } = useAppStore();

  const queryKey = ['workspaces', user?.id];

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<WorkspacesData>({
    queryKey,
    enabled: isLoaded && !!user?.id,
    queryFn: async () => {
      if (!user?.id) {
        return { sections: [], courses: [] };
      }

      // 1. Fetch user's section memberships joined with section details
      const { data: memberRows, error: memberError } = await supabase
        .from('section_members')
        .select('role, section:sections(*)')
        .eq('user_id', user.id);

      if (memberError) {
        console.error('[useWorkspaces] Error fetching sections:', memberError.message);
        throw memberError;
      }

      const sections: SectionRow[] = (memberRows ?? [])
        .filter((row): row is typeof row & { section: Tables<'sections'> } => row.section !== null)
        .map((row) => ({
          ...row.section,
          role: row.role,
        }));

      // 2. Fetch user's course enrollments joined with course details
      const { data: enrollRows, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('id, is_active, is_muted, is_guest, course:courses(*)')
        .eq('user_id', user.id);

      if (enrollError) {
        console.error('[useWorkspaces] Error fetching courses:', enrollError.message);
        throw enrollError;
      }

      const courses: CourseRow[] = (enrollRows ?? [])
        .filter((row): row is typeof row & { course: Tables<'courses'> } => row.course !== null)
        .map((row) => ({
          ...row.course,
          is_active: row.is_active,
          is_muted: row.is_muted,
          is_guest: row.is_guest,
          enrollment_id: row.id,
        }));

      return { sections, courses };
    },
  });

  // Sync server data into Zustand store safely without wiping offline creations
  useEffect(() => {
    if (!data) return;

    if (data.sections && data.sections.length > 0) {
      setActiveSections(data.sections);
    }

    if (data.courses) {
      const serverMap = new Map(data.courses.map((c) => [c.id, c]));
      const localOnly = activeCourses.filter((c) => !serverMap.has(c.id));
      setActiveCourses([...data.courses, ...localOnly]);
    }

    if (data.sections.length > 0) {
      const exists = data.sections.some((s) => s.id === activeSectionId);
      if (!activeSectionId || !exists) {
        setActiveSectionId(data.sections[0].id);
      }
    }
  }, [data, activeSectionId, setActiveSectionId, setActiveSections, setActiveCourses, activeCourses]);

  const sections = (data?.sections && data.sections.length > 0) ? data.sections : activeSections;
  const courses = (data?.courses && data.courses.length > 0) ? data.courses : activeCourses;
  const activeSection =
    sections.find((s) => s.id === activeSectionId) ?? (sections.length > 0 ? sections[0] : null);

  return {
    sections,
    courses,
    activeSection,
    activeSectionId,
    setActiveSectionId,
    isLoading: !isLoaded || isLoading,
    isFetching,
    isError,
    error,
    refetch,
  };
}
