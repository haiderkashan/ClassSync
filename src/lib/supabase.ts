import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from '@/lib/env';
import { Database } from '@/types/database.types';

/**
 * Standard typed Supabase client configured with AsyncStorage persistence for React Native.
 */
const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

let currentTokenGetter: (() => Promise<string | null>) | null = null;

export const setClerkTokenGetter = (getter: () => Promise<string | null>) => {
  currentTokenGetter = getter;
};

/**
 * Singleton typed Supabase client that dynamically injects 
 * Clerk's session JWT into the Authorization headers for RLS verification.
 */
export const clerkSupabaseClient = createClient<Database>(
  supabaseUrl,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (url, options = {}) => {
        const clerkToken = currentTokenGetter ? await currentTokenGetter() : null;
        const headers = new Headers(options?.headers);
        if (clerkToken) {
          headers.set('Authorization', `Bearer ${clerkToken}`);
        }
        return fetch(url, { ...options, headers });
      },
    },
  }
);

export const supabase = clerkSupabaseClient;

export const createClerkSupabaseClient = (getToken: () => Promise<string | null>) => {
  setClerkTokenGetter(getToken);
  return clerkSupabaseClient;
};
