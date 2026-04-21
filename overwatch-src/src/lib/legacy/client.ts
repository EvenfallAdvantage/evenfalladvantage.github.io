/**
 * Legacy Bridge — Cross-database read/write service
 * 
 * Connects Overwatch to the legacy Evenfall Advantage Supabase instance
 * to pull training content, progress, assessments, and certificates.
 * 
 * Project URLs are configured via environment variables:
 *   NEXT_PUBLIC_LEGACY_SUPABASE_URL / NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Legacy Supabase credentials (read-scoped via RLS)
const LEGACY_URL = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_URL ?? "";
const LEGACY_ANON_KEY = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY ?? "";

let _legacyClient: SupabaseClient | null = null;

/** Get or create the legacy Supabase client (singleton) */
export function getLegacyClient(): SupabaseClient {
  if (!_legacyClient) {
    _legacyClient = createClient(LEGACY_URL, LEGACY_ANON_KEY);
  }
  return _legacyClient;
}
