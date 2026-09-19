import { useAuth } from '@clerk/clerk-expo';
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
        if (token) {
          try {
            const [headerB64, payloadB64] = token.split('.');
            const header = typeof atob !== 'undefined' ? JSON.parse(atob(headerB64)) : {};
            const payload = typeof atob !== 'undefined' ? JSON.parse(atob(payloadB64)) : {};
            console.log('🔍 [Clerk JWT Diagnostic] alg:', header.alg, '| aud:', payload.aud, '| role:', payload.role, '| sub:', payload.sub);
          } catch (e) {
            console.log('🔍 [Clerk JWT Diagnostic] could not parse token header/payload');
          }
        } else {
          console.warn('⚠️ [Clerk JWT Diagnostic] getToken returned null or empty');
        }
        return token;
      } catch (error) {
        console.error('[useSupabase] Failed to fetch Clerk Supabase JWT:', error);
        return null;
      }
    });
  }, [getToken]);

  return clerkSupabaseClient;
}
