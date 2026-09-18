import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, 'EXPO_PUBLIC_SUPABASE_URL is required')
    .url('EXPO_PUBLIC_SUPABASE_URL must be a valid URL'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(10, 'EXPO_PUBLIC_SUPABASE_ANON_KEY must be at least 10 characters long'),
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .startsWith('pk_', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must start with "pk_"'),
  EXPO_PUBLIC_APP_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
});

export type Env = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
});

if (!parsedEnv.success) {
  const formattedErrors = Object.entries(parsedEnv.error.flatten().fieldErrors)
    .map(([field, errors]) => `  - ${field}: ${errors?.join(', ')}`)
    .join('\n');

  const errorMessage = `[Environment Validation Error] Invalid or missing environment variables:\n${formattedErrors}\n\nPlease check your .env or .env.development file.`;
  console.error(errorMessage);
  throw new Error(errorMessage);
}

export const env = parsedEnv.data;
