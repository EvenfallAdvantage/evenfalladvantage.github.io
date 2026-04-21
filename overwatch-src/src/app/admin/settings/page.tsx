"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Settings } from "lucide-react";
import { usePageHeader } from "@/stores/page-header-store";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyDetails, getTimeOffPolicies, getIntegrationsConfig } from "@/lib/supabase/db";

import CompanyProfileSection from "./components/company-profile-section";
import LeavePoliciesSection from "./components/leave-policies-section";
import FeatureVisibilitySection from "./components/feature-visibility-section";
import IntegrationsSection from "./components/integrations-section";
import ErrorLogViewer from "./components/error-log-viewer";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Policy = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IntConfig = any;

export default function AdminSettingsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isOwner = activeCompany?.role === "owner";
  const isAdminPlus = ["owner", "admin"].includes(activeCompany?.role ?? "");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader("HQ CONFIG", "Organization profile and settings", <Settings className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader]);

  // Loaded data
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [timezone, setTimezone] = useState("");
  const [brandColor, setBrandColor] = useState("#1d3451");
  const [accentColor, setAccentColor] = useState("#d59b3c");
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [integrations, setIntegrations] = useState<IntConfig[]>([]);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const [c, p] = await Promise.all([
        getCompanyDetails(activeCompanyId),
        getTimeOffPolicies(activeCompanyId),
      ]);
      if (c) {
        setName(c.name ?? "");
        setJoinCode(c.join_code ?? "");
        setTimezone(c.timezone ?? "");
        setBrandColor(c.brand_color || "#1d3451");
        setAccentColor(c.accent_color || "#d59b3c");
        setLogoUrl(c.logo_url ?? "");
        setWebsiteUrl(c.website_url ?? "");
        if (c.settings) {
          const s = c.settings as { hiddenTabs?: string[] };
          setHiddenTabs(s.hiddenTabs ?? []);
        }
      }
      setPolicies(p);
      try {
        const ints = await getIntegrationsConfig(activeCompanyId);
        setIntegrations(ints);
      } catch (e) { logger.swallow("admin-settings:load-integrations", e, "debug"); }
      setLoaded(true);
    } catch (e) { logger.swallow("admin-settings:load", e, "warn"); }
  }, [activeCompanyId]);

  useEffect(() => { void load(); }, [load]); // eslint-disable-line -- async data-loading pattern

  if (activeCompany && !isAdminPlus) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium">Access Restricted</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">Only admins and owners can access HQ Config.</p>
      </div>
    );
  }

  if (!loaded) return null;

  return (
    <>
      <div className="space-y-6">
        <CompanyProfileSection
          companyId={activeCompanyId!}
          initialName={name}
          initialTimezone={timezone}
          initialBrandColor={brandColor}
          initialAccentColor={accentColor}
          initialLogoUrl={logoUrl}
          initialWebsiteUrl={websiteUrl}
          joinCode={joinCode}
        />

        <LeavePoliciesSection
          companyId={activeCompanyId!}
          initialPolicies={policies}
        />

        {isOwner && (
          <FeatureVisibilitySection
            companyId={activeCompanyId!}
            initialHiddenTabs={hiddenTabs}
          />
        )}

        <IntegrationsSection
          companyId={activeCompanyId!}
          initialIntegrations={integrations}
        />

        <ErrorLogViewer companyId={activeCompanyId!} />
      </div>
    </>
  );
}
