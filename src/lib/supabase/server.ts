import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a Supabase client configured for server-side operations (API routes, server actions).
 * 
 * If SUPABASE_SERVICE_ROLE_KEY is provided, it uses the service role key to safely
 * bypass RLS for administrative actions (like inserting alerts or reading push subscriptions).
 * 
 * If a user JWT accessToken is provided, it configures the client with the user's Bearer token
 * so auth.uid() matches the authenticated user in RLS policies.
 */
export function getSupabaseServerClient(accessToken?: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const apiKey = serviceRoleKey || anonKey;

  const headers: Record<string, string> = {};
  if (accessToken && !serviceRoleKey) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return createClient(supabaseUrl, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers,
    },
  });
}

/**
 * Checks if the service role key is configured in the environment.
 */
export function isServiceRoleConfigured(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(key && !key.includes('your-service-role-key') && key.length > 20);
}
