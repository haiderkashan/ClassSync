import { useAuth } from '@clerk/clerk-expo';
import { useMemo } from 'react';
import { createClerkSupabaseClient } from '@/lib/supabase';

/**
 * Hook providing a memoized, typed Supabase client pre-configured with 
 * Clerk's custom JWT template ('supabase') for PostgreSQL RLS authorization.
 */
export function useSupabase() {
  const { getToken } = useAuth();

  return useMemo(() => {
    return createClerkSupabaseClient(async () => {
      try {
        return await getToken({ template: 'supabase' });
      } catch (error) {
        console.error('[useSupabase] Failed to fetch Clerk Supabase JWT:', error);
        return null;
      }
    });
  }, [getToken]);
}
