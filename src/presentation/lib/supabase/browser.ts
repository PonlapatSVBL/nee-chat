'use client';
import { createBrowserClient } from '@supabase/ssr';
import { supabasePublicEnv } from './env';

export function createSupabaseBrowserClient() {
  const { url, anonKey } = supabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
