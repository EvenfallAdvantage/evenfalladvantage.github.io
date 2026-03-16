"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

function goToLanding() {
  // Hard redirect — clears all in-memory state, works reliably on static exports
  const base = typeof window !== "undefined" ? window.location.origin : "";
  window.location.href = `${base}/overwatch/`;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const redirected = useRef(false);

  // Listen for sign-out events directly from Supabase
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !redirected.current) {
        redirected.current = true;
        goToLanding();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Redirect when store shows no user
  useEffect(() => {
    if (!isLoading && !user && !redirected.current) {
      redirected.current = true;
      goToLanding();
    }
  }, [isLoading, user]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
