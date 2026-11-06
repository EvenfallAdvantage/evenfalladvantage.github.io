"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { LAUNCH_SESSION_KEY, launchSessionMayRetargetManifest, resolveLaunchCompany, SHARED_MANIFEST_PATH } from "@/lib/pwa-company-install";

/**
 * Applies the installed app's start-URL company only when this account has
 * an active membership. A company switch does not change the manifest link
 * the boot script already pointed at the launched company.
 */
export function PwaLaunchCompany() {
  const user = useAuthStore((s) => s.user);
  const setActiveCompany = useAuthStore((s) => s.setActiveCompany);

  useEffect(() => {
    if (!launchSessionMayRetargetManifest(window.location.pathname)) return;
    if (!user) return;
    let requested: string | null = null;
    try {
      requested = sessionStorage.getItem(LAUNCH_SESSION_KEY);
    } catch {
      return;
    }
    if (!requested) return;
    const companies = user.companies.map((c) => ({
      companyId: c.companyId,
      companyName: c.companyName,
      companyLogo: c.companyLogo,
      brandColor: c.brandColor,
      status: c.membership?.status ?? "active",
    }));
    const allowed = resolveLaunchCompany(companies, requested);
    if (!allowed) {
      try { sessionStorage.removeItem(LAUNCH_SESSION_KEY); } catch { /* private mode */ }
      document.querySelector('link[rel="manifest"]')?.setAttribute("href", SHARED_MANIFEST_PATH);
      return;
    }
    if (useAuthStore.getState().activeCompanyId !== allowed) setActiveCompany(allowed);
  }, [user, setActiveCompany]);

  return null;
}
