"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { joinCompanyByCode } from "@/lib/supabase/db";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Check for pending company join from registration
        try {
          const raw = localStorage.getItem("pending_join");
          if (raw) {
            const pending = JSON.parse(raw);
            localStorage.removeItem("pending_join");

            // SECURITY: Only process the join if the session user matches
            // the user who originally registered. This prevents a stale
            // pending_join from being applied to the wrong account.
            if (pending.supabaseId === session.user.id) {
              await joinCompanyByCode({
                supabaseId: session.user.id,
                email: session.user.email,
                phone: pending.phone ?? null,
                firstName: pending.firstName ?? "",
                lastName: pending.lastName ?? "",
                joinCode: pending.code,
              });
            } else {
              console.warn(
                "Pending join discarded: session user",
                session.user.id,
                "does not match pending user",
                pending.supabaseId
              );
            }
          }
        } catch (err) {
          console.warn("Pending join failed (will retry on next login):", err);
        }
        router.replace("/feed");
      } else {
        router.replace("/login?error=auth_callback_failed");
      }
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Verifying your account...</p>
      </div>
    </div>
  );
}
