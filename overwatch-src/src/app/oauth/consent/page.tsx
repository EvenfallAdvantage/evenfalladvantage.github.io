"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import Image from "next/image";

/**
 * OAuth Consent Page
 *
 * This page is required by Supabase's OAuth Server feature.
 * When a third-party app requests authorization, Supabase redirects
 * the user here to approve or deny access.
 *
 * URL params from Supabase:
 *   - client_id: The OAuth app's client ID
 *   - redirect_uri: Where to redirect after consent
 *   - response_type: Usually "code"
 *   - scope: Requested permissions
 *   - state: CSRF protection state
 */

function ConsentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ email?: string } | null>(null);

  const clientId = searchParams.get("client_id") ?? "";
  const redirectUri = searchParams.get("redirect_uri") ?? "";
  const responseType = searchParams.get("response_type") ?? "code";
  const scope = searchParams.get("scope") ?? "";
  const state = searchParams.get("state") ?? "";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => {
      if (data.user) {
        setUser({ email: data.user.email });
      } else {
        // Not logged in — redirect to login with return URL
        const returnUrl = encodeURIComponent(window.location.href);
        router.push(`/?auth=login&returnTo=${returnUrl}`);
      }
    });
  }, [router]);

  async function handleApprove() {
    setLoading(true);
    setError("");
    try {
      // Build the approval redirect URL
      // Supabase OAuth server handles the actual token exchange
      const approveUrl = new URL(redirectUri);
      if (state) approveUrl.searchParams.set("state", state);

      // Use Supabase's authorize endpoint to generate the auth code
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setError("Not authenticated. Please sign in first.");
        setLoading(false);
        return;
      }

      // Redirect to Supabase's authorize endpoint with the consent approved
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const authorizeUrl = `${supabaseUrl}/auth/v1/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${encodeURIComponent(responseType)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

      globalThis.location.assign(authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed");
      setLoading(false);
    }
  }

  function handleDeny() {
    // Redirect back with an error
    if (redirectUri) {
      const denyUrl = new URL(redirectUri);
      denyUrl.searchParams.set("error", "access_denied");
      denyUrl.searchParams.set("error_description", "User denied the request");
      if (state) denyUrl.searchParams.set("state", state);
      globalThis.location.assign(denyUrl.toString());
    } else {
      router.push("/feed");
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1422]">
        <Loader2 className="h-8 w-8 animate-spin text-[#dd8c33]" />
      </div>
    );
  }

  // Parse scopes for display
  const scopeList = scope ? scope.split(" ").filter(Boolean) : ["read"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1422] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#dd8c33]/30 bg-[#0f1a2e] p-8 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <Image src="/images/overwatch_logo.png?v=2" alt="Overwatch" width={48} height={48} style={{ width: 48, height: "auto" }} className="rounded-xl" />
          <h1 className="mt-3 text-lg font-bold font-mono text-white">AUTHORIZE ACCESS</h1>
          <p className="text-xs text-white/40 mt-1 text-center">
            An application is requesting access to your Overwatch account
          </p>
        </div>

        {/* App info */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#dd8c33]/15">
              <ExternalLink className="h-5 w-5 text-[#dd8c33]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{clientId || "Unknown Application"}</p>
              {redirectUri && (
                <p className="text-[10px] text-white/30 truncate max-w-[280px]">{new URL(redirectUri).origin}</p>
              )}
            </div>
          </div>
        </div>

        {/* Signed in as */}
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 mb-4">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
          <span className="text-xs text-green-400">Signed in as {user.email}</span>
        </div>

        {/* Requested permissions */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Requested Permissions</p>
          <div className="space-y-1.5">
            {scopeList.map((s) => (
              <div key={s} className="flex items-center gap-2 text-xs text-white/70">
                <Shield className="h-3 w-3 text-[#dd8c33] shrink-0" />
                <span>{s === "read" ? "Read your profile data" : s === "write" ? "Modify your data" : s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 mb-4">
            <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            disabled={loading}
            className="flex-1 h-10 rounded-lg border border-white/10 text-sm font-medium text-white/60 hover:bg-white/5 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-[#dd8c33] text-white font-semibold text-sm hover:bg-[#c47a2a] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Authorize
          </button>
        </div>

        <p className="text-[9px] text-white/20 text-center mt-4">
          You can revoke access at any time from your profile settings.
        </p>
      </div>
    </div>
  );
}

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0b1422]">
        <Loader2 className="h-8 w-8 animate-spin text-[#dd8c33]" />
      </div>
    }>
      <ConsentContent />
    </Suspense>
  );
}
