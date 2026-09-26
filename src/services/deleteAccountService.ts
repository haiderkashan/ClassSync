import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { SectionRow } from '@/store/useAppStore';

export interface DeleteAccountDependencies {
  supabase: SupabaseClient<Database> | any;
  clerkUser?: { delete: () => Promise<void> } | null;
  resetLocalDb: () => void;
  clearStorage: () => Promise<void>;
  resetStore: () => void;
}

/**
 * Filters the active section list to identify sections where the user is Genesis CR.
 */
export function filterGenesisCrSections(sections: SectionRow[] | null | undefined): SectionRow[] {
  return (sections || []).filter((s) => s.role === 'genesis_cr');
}

/**
 * Evaluates whether account deletion must be blocked due to active Genesis CR ownership.
 */
export function isGenesisCrBlocked(sections: SectionRow[] | null | undefined): boolean {
  return filterGenesisCrSections(sections).length > 0;
}

/**
 * Orchestrates atomic account purge across Supabase, Clerk Auth, SQLite, and AsyncStorage.
 */
export async function executeAccountDeletion(
  sections: SectionRow[] | null | undefined,
  deps: DeleteAccountDependencies
): Promise<{ success: boolean; error?: string }> {
  // 1. Genesis CR Safeguard Guard
  if (isGenesisCrBlocked(sections)) {
    return {
      success: false,
      error:
        'Cannot delete account: You are the Genesis CR of an active cohort section. Please transfer ownership before proceeding.',
    };
  }

  try {
    // Step A: Remote database RPC cascade
    const { error: rpcError } = await deps.supabase.rpc('delete_user_account');
    if (rpcError) {
      throw new Error(rpcError.message || 'Failed to purge account data.');
    }

    // Step B: Clerk identity destruction
    if (deps.clerkUser) {
      await deps.clerkUser.delete();
    }

    // Step C: Drop local SQLite data
    try {
      deps.resetLocalDb();
    } catch (err) {
      console.warn('[deleteAccountService] SQLite reset warning:', err);
    }

    // Step D: Purge AsyncStorage
    try {
      await deps.clearStorage();
    } catch (err) {
      console.warn('[deleteAccountService] AsyncStorage clear warning:', err);
    }

    // Step E: Flush Zustand client state
    deps.resetStore();

    return { success: true };
  } catch (err: any) {
    console.error('[deleteAccountService] Execution error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to complete account deletion.',
    };
  }
}
