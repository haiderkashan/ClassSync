import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSupabase } from '@/hooks/useSupabase';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore, type SectionRow } from '@/store/useAppStore';
import { resetLocalDatabase } from '@/lib/db/localDatabase';

export interface UseDeleteAccountResult {
  isGenesisCrOfAnySection: boolean;
  genesisSections: SectionRow[];
  isDeleting: boolean;
  error: string | null;
  deleteAccount: () => Promise<boolean>;
  clearError: () => void;
}

/**
 * Hook managing the account deletion lifecycle in strict compliance with
 * Apple App Store Guideline 5.1.1(v) and the Genesis CR Orphan Safeguard.
 */
export function useDeleteAccount(): UseDeleteAccountResult {
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabase();
  const { sections } = useWorkspaces();
  const { reset } = useAppStore();

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Genesis CR Safeguard Evaluation
  const genesisSections = useMemo(
    () => (sections || []).filter((s) => s.role === 'genesis_cr'),
    [sections]
  );
  const isGenesisCrOfAnySection = genesisSections.length > 0;

  // 2. Cascade Purge Handler
  const deleteAccount = async (): Promise<boolean> => {
    setError(null);

    if (isGenesisCrOfAnySection) {
      setError(
        'Cannot delete account: You are the Genesis CR of an active cohort section. Please transfer ownership before proceeding.'
      );
      return false;
    }

    setIsDeleting(true);

    try {
      // Step A: Execute atomic database purge in Supabase via RPC
      const { error: rpcError } = await supabase.rpc('delete_user_account');
      if (rpcError) {
        throw new Error(rpcError.message || 'Failed to purge account data.');
      }

      // Step B: Permanently destroy user account in Clerk Auth
      if (user) {
        await user.delete();
      }

      // Step C: Drop all local SQLite cached tables
      try {
        resetLocalDatabase();
      } catch (err) {
        console.warn('[useDeleteAccount] Local database reset non-critical failure:', err);
      }

      // Step D: Flush AsyncStorage
      try {
        await AsyncStorage.clear();
      } catch (err) {
        console.warn('[useDeleteAccount] AsyncStorage clear non-critical failure:', err);
      }

      // Step E: Reset Zustand L1 client store
      reset();

      // Step F: Redirect cleanly to authentication
      router.replace('/(auth)/sign-in');
      return true;
    } catch (err: any) {
      console.error('[useDeleteAccount] Account deletion error:', err);
      setError(
        err?.message || 'Failed to complete account deletion. Please try again or contact support.'
      );
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isGenesisCrOfAnySection,
    genesisSections,
    isDeleting,
    error,
    deleteAccount,
    clearError: () => setError(null),
  };
}
