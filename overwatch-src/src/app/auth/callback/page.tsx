"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { joinCompanyByCode, registerUserInDB } from "@/lib/supabase/db";

export default function AuthCallbackPage() {
  const router = useRouter();
  const handled = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const supabase = createClient();

    // Use onAuthStateChange to reliably detect the session after
    // Supabase processes the URL hash tokens from email confirmation.
    // A one-shot getSession() can race against the hash processing.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: { user: { id: string; email?: string; user_metadata?: Record<string, string> } } | null) => {
        // Only act on events that give us a real session
        if (!session) return;

        // Unsubscribe immediately — we only need the first valid session
        subscription.unsubscribe();

        try {
          await handlePostAuth(supabase, session);
          router.replace("/feed");
        } catch (err) {
          console.error("Post-auth processing failed:", err);
          // Show error instead of silently redirecting — otherwise the user
          // lands on /feed with no company and no idea registration failed.
          setError(
            err instanceof Error
              ? err.message
              : "Account setup failed. Please try again."
          );
        }
      }
    );

    // Safety net: if no auth event fires within 8s (e.g. user navigated
    // here directly without a valid token), redirect to login.
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      router.replace("/?auth=login&error=auth_callback_timeout");
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border border-border/50 bg-card p-6 text-center shadow-xl">
          <h1 className="text-lg font-semibold">Account setup failed</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => {
                handled.current = false;
                setError("");
                // Re-run the effect by forcing a reload of this page
                window.location.reload();
              }}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.replace("/?auth=login")}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Verifying your account...</p>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePostAuth(supabase: any, session: any) {
  const meta = session.user.user_metadata ?? {};
  const userId = session.user.id;
  const email = session.user.email;

  // ── Resolve join code ──────────────────────────────────
  // PRIMARY: user_metadata.join_code (survives cross-browser/device)
  // FALLBACK: localStorage pending_join (same-browser only)
  let joinCode: string | null = meta.join_code || null;
  let phone: string | null = meta.phone || null;
  let firstName: string = meta.first_name || "";
  let lastName: string = meta.last_name || "";

  // Check localStorage fallback
  try {
    const raw = localStorage.getItem("pending_join");
    if (raw) {
      const pending = JSON.parse(raw);
      localStorage.removeItem("pending_join");

      // Only use localStorage data if it matches this user
      if (pending.supabaseId === userId) {
        if (!joinCode) joinCode = pending.code || null;
        if (!phone) phone = pending.phone || null;
        if (!firstName) firstName = pending.firstName || "";
        if (!lastName) lastName = pending.lastName || "";
      }
    }
  } catch {
    // localStorage unavailable (e.g. different browser) — no problem
  }

  // ── Execute join or register ───────────────────────────
  if (joinCode) {
    await joinCompanyByCode({
      supabaseId: userId,
      email,
      phone,
      firstName,
      lastName,
      joinCode,
    });

    // Clear join_code from user_metadata so it doesn't re-fire
    await supabase.auth.updateUser({
      data: { join_code: null },
    });
  } else if (meta.company_name) {
    // New company registration that was deferred by email confirmation
    await registerUserInDB({
      supabaseId: userId,
      email,
      phone,
      firstName,
      lastName,
      companyName: meta.company_name,
    });

    // Clear company_name so it doesn't re-fire
    await supabase.auth.updateUser({
      data: { company_name: null },
    });
  }
}
