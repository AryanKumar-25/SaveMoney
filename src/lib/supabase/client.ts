import { createBrowserClient } from '@supabase/ssr';

export const isSupabaseConfigured = (): boolean => {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return false;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isValid = Boolean(
    url && 
    anonKey && 
    !url.includes('your-project-id') && 
    !anonKey.includes('your-anon-key') &&
    url.startsWith('https://')
  );

  if (!isValid && typeof window !== 'undefined') {
    console.error(
      'SaveMoney Supabase Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or invalid in .env.local.\n' +
      `URL: ${url || 'NOT SET'} | Key: ${anonKey ? 'Present' : 'NOT SET'}`
    );
  }

  return isValid;
};

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  if (typeof window === 'undefined') {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return clientInstance;
}
