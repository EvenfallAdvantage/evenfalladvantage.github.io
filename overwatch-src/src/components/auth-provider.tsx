"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserProfile, registerUserInDB } from "@/lib/supabase/db";
import { useAuthStore } from "@/stores/auth-store";
import type { SessionUser, CompanyContext } from "@/types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, clearSession } = useAuthStore();
  const autoRegAttempted = useRef(false);

  const loadProfile = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (authUser: any) => {
      // Try loading real profile from database
      try {
        let profile = await fetchUserProfile(authUser.id);

        // If user exists but has NO memberships, and auth metadata has a
        // company_name, auto-create the company + membership now.
        // This handles the email-confirmation flow where registerUserInDB
        // was skipped because signUp returned before a session existed.
        // Only attempt once per session to prevent infinite retry loops.
        const meta = authUser.user_metadata || {};
        if (
          profile?.user &&
          (profile.memberships ?? []).length === 0 &&
          meta.company_name &&
          !autoRegAttempted.current
        ) {
          autoRegAttempted.current = true;
          try {
            await registerUserInDB({
              supabaseId: authUser.id,
              email: authUser.email ?? null,
              phone: authUser.phone ?? meta.phone ?? null,
              firstName: meta.first_name ?? profile.user.first_name ?? "",
              lastName: meta.last_name ?? profile.user.last_name ?? "",
              companyName: meta.company_name,
            });
            // Re-fetch profile to pick up the new membership
            profile = await fetchUserProfile(authUser.id);
          } catch (regErr) {
            console.warn("Auto-register company failed:", regErr);
          }
        }

        if (profile?.user) {
          const companies: CompanyContext[] = (profile.memberships ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (m: any) => ({
              companyId: m.companies?.id ?? m.company_id,
              companyName: m.companies?.name ?? "Unknown",
              companySlug: m.companies?.slug ?? "",
              companyLogo: m.companies?.logo_url ?? null,
              brandColor: m.companies?.brand_color ?? "#1d3451",
              role: m.role ?? "staff",
              settings: m.companies?.settings ?? {},
              membership: {
                id: m.id,
                nickname: m.nickname ?? null,
                status: m.status ?? "active",
              },
            })
          );

          setUser({
            id: profile.user.id,
            email: profile.user.email ?? authUser.email ?? null,
            phone: profile.user.phone ?? authUser.phone ?? null,
            firstName: profile.user.first_name ?? "",
            lastName: profile.user.last_name ?? "",
            avatarUrl: profile.user.avatar_url ?? null,
            isPlatformAdmin: profile.user.is_platform_admin ?? false,
            companies,
            activeCompanyId: companies[0]?.companyId ?? null,
          });
          return;
        }
      } catch {
        // DB not ready or tables missing — fall back to metadata
      }

      // Fallback: use Supabase auth metadata
      setUser(mapSupabaseUser(authUser));
    },
    [setUser]
  );

  useEffect(() => {
    const supabase = createClient();

    // onAuthStateChange fires INITIAL_SESSION on subscribe, so no
    // separate getUser() call is needed — that would acquire a second
    // lock and cause contention / 5-second timeout warnings.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        clearSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile, clearSession]);

  return <>{children}</>;
}

// Fallback: Map Supabase user metadata when DB profile not available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabaseUser(user: any): SessionUser {
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || null,
    phone: user.phone || meta.phone || null,
    firstName: meta.first_name || "",
    lastName: meta.last_name || "",
    avatarUrl: meta.avatar_url || null,
    isPlatformAdmin: meta.is_platform_admin || false,
    companies: meta.company_name
      ? [
          {
            companyId: "pending",
            companyName: meta.company_name,
            companySlug: meta.company_name
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, ""),
            companyLogo: null,
            brandColor: "#1d3451",
            role: "owner",
            settings: {},
            membership: {
              id: "pending",
              nickname: null,
              status: "active",
            },
          },
        ]
      : [],
    activeCompanyId: meta.company_name ? "pending" : null,
  };
}
