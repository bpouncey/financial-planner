/**
 * Supabase browser client for client-side persistence.
 * Uses anon key; RLS can restrict access when auth is added.
 * Returns null when env vars are missing (avoids throwing during build/SSR).
 */

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!_client) {
    _client = createSupabaseClient(url, anonKey);
  }
  return _client;
}

/** Lazy client — null when Supabase is not configured. */
export function getSupabase() {
  return createClient();
}
