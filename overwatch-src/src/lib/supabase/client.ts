import { createBrowserClient } from "@supabase/ssr";

// Singleton browser client — shared across all 258+ call sites.
// This avoids allocating a new SupabaseBrowserClient on every function call,
// ensures auth state consistency, and reduces GC pressure.
// Note: server.ts must NOT be a singleton (cookie store is per-request).
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
