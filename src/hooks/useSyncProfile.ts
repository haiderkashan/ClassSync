import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/hooks/useSupabase';

/**
 * Hook that silently synchronizes the Clerk user profile into Supabase PostgreSQL `public.profiles`
 * upon authentication, eliminating race conditions and maintaining avatar/name consistency.
 */
export function useSyncProfile() {
  const { user, isLoaded } = useUser();
  const supabase = useSupabase();
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Avoid duplicate sync executions in the same mount cycle
    if (syncedUserIdRef.current === user.id) return;

    async function syncProfile() {
      try {
        const primaryEmail = user?.primaryEmailAddress?.emailAddress || null;
        const displayName =
          user?.fullName ||
          user?.firstName ||
          user?.username ||
          user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
          'Student';
        const avatarUrl = user?.imageUrl || null;

        const { error } = await supabase.from('profiles').upsert(
          {
            id: user!.id,
            email: primaryEmail,
            display_name: displayName,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'id',
          }
        );

        if (error) {
          console.error('[useSyncProfile] Failed to upsert profile to Supabase:', error.message);
        } else {
          syncedUserIdRef.current = user!.id;
          console.log('[useSyncProfile] User profile synchronized with Supabase:', user!.id);
        }
      } catch (err) {
        console.error('[useSyncProfile] Unexpected error during profile sync:', err);
      }
    }

    void syncProfile();
  }, [user, isLoaded, supabase]);
}
