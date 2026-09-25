import { useAuth } from '@clerk/expo';
import { useEffect } from 'react';
import { clerkSupabaseClient, setClerkTokenGetter } from '@/lib/supabase';

/**
 * Hook providing a singleton, typed Supabase client pre-configured with 
 * Clerk's session JWT template ('supabase') for PostgreSQL RLS authorization.
 */
export function useSupabase() {
  const { getToken } = useAuth();

  useEffect(() => {
    setClerkTokenGetter(async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        return token;
      } catch (error) {
        console.error('[useSupabase] Failed to fetch Clerk Supabase JWT:', error);
        return null;
      }
    });
  }, [getToken]);

  return clerkSupabaseClient;
}
