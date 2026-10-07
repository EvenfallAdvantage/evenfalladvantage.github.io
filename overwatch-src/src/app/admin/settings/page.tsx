"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Building2, Loader2, RefreshCw, Settings } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyDetails, getCompanyJoinCode, getTimeOffPolicies, getIntegrationsConfig } from "@/lib/supabase/db";
import { HQ_SECTIONS, type HqSectionId } from "@/lib/hq-config";

import CompanyProfileSection from "./components/company-profile-section";
import LeavePoliciesSection from "./components/leave-policies-section";
import PayOvertimeSection from "./components/pay-overtime-section";
import FeatureVisibilitySection from "./components/feature-visibility-section";
import IntegrationsSection from "./components/integrations-section";
import DeliveryChannelsSection from "./components/delivery-channels-section";
import ClientPortalSection from "./components/client-portal-section";
import ApiSourcesSection from "./components/api-sources-section";
import ErrorLogViewer from "./components/error-log-viewer";
import IncidentConfigSection from "./components/incident-config-section";
import RadioStateSection from "./components/radio-state-section";
import { logger } from "@/lib/logger";

type Policy = Record<string, unknown> & {
  id: string;
  name: string;
  type: string;
};
type IntConfig = Record<string, unknown> & {
  provider: string;
  config?: Record<string, string> | null;
  is_active?: boolean | null;
};

const TITLE = "HQ CONFIG";
const SUBTITLE = "Organization profile and settings";

function Section({ id, title, children }: { id: HqSectionId; title: string; children: React.ReactNode }) {
  return (
    <section id={`hq-${id}`} aria-labelledby={`hq-${id}-title`} className="scroll-mt-28 space-y-4">
      <h2 id={`hq-${id}-title`} className="px-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AdminSettingsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const internalUserId = useAuthStore((s) => s.user?.id ?? null);
  const isOwner = activeCompany?.role === "owner";
  const isAdminPlus = ["owner", "admin"].includes(activeCompany?.role ?? "");

  // Loaded data
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [integrationsError, setIntegrationsError] = useState(false);
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
    if (!activeCompanyId) return;
    setLoadError(null);
    setLoaded(false);
    try {
      const [c, p, code] = await Promise.all([
        getCompanyDetails(activeCompanyId),
        getTimeOffPolicies(activeCompanyId),
        // companies.join_code is a retired placeholder; the real code is admin-only.
        getCompanyJoinCode(activeCompanyId),
      ]);
      if (!c) throw new Error("Company not found or not readable");
      setName(c.name ?? "");
      setJoinCode(code);
      setTimezone(c.timezone ?? "");
      setBrandColor(c.brand_color || "#1d3451");
      setAccentColor(c.accent_color || "#d59b3c");
      setLogoUrl(c.logo_url ?? "");
      setWebsiteUrl(c.website_url ?? "");
      const s = (c.settings ?? {}) as { hiddenTabs?: string[] };
      setHiddenTabs(s.hiddenTabs ?? []);
      setPolicies(p);
      try {
        setIntegrations(await getIntegrationsConfig(activeCompanyId));
        setIntegrationsError(false);
      } catch (e) {
        // Don't render blank credential forms over real stored values.
        logger.swallow("admin-settings:load-integrations", e, "warn");
        setIntegrationsError(true);
      }
      setLoaded(true);
    } catch (e) {
      logger.swallow("admin-settings:load", e, "warn");
      setLoadError(e instanceof Error ? e.message : "Unknown error");
    }
  }, [activeCompanyId]);

  useEffect(() => { void load(); }, [load]);  

  if (activeCompany && !isAdminPlus) {
    return (
      <PageShell title={TITLE} subtitle={SUBTITLE} icon={<Settings className="h-5 w-5" />}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">Access Restricted</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">Only admins and owners can access HQ Config.</p>
        </div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell title={TITLE} subtitle={SUBTITLE} icon={<Settings className="h-5 w-5" />}>
        <div role="alert" className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle className="mb-3 h-10 w-10 text-amber-500/70" />
          <p className="text-sm font-medium">Couldn&apos;t load HQ Config</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">Check your connection and try again. ({loadError})</p>
          <Button className="mt-4 h-11 gap-1.5 sm:h-8" variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      </PageShell>
    );
  }

  if (!loaded) {
    return (
      <PageShell title={TITLE} subtitle={SUBTITLE} icon={<Settings className="h-5 w-5" />}>
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading settings…
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={TITLE} subtitle={SUBTITLE} icon={<Settings className="h-5 w-5" />}>
      <div className="hq-config space-y-8">
        {/* Jump bar: the page is long, especially on a phone. */}
        <nav aria-label="HQ Config sections" className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-background/90 px-1 py-2 backdrop-blur">
          <ul className="flex gap-2 whitespace-nowrap">
            {HQ_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#hq-${s.id}`} className="inline-flex min-h-11 items-center rounded-full border border-border/50 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground sm:min-h-8">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Section id="organization" title="Organization">
          <CompanyProfileSection
            companyId={activeCompanyId!}
            initialName={name}
            initialTimezone={timezone}
            initialBrandColor={brandColor}
            initialAccentColor={accentColor}
            initialLogoUrl={logoUrl}
            initialWebsiteUrl={websiteUrl}
            joinCode={joinCode}
            canRotateJoinCode={isAdminPlus}
          />
          {isOwner && (
            <FeatureVisibilitySection
              companyId={activeCompanyId!}
              initialHiddenTabs={hiddenTabs}
            />
          )}
        </Section>

        <Section id="people" title="People & Time">
          <PayOvertimeSection companyId={activeCompanyId!} />
          <LeavePoliciesSection
            companyId={activeCompanyId!}
            initialPolicies={policies}
          />
          <ClientPortalSection companyId={activeCompanyId!} />
        </Section>

        <Section id="operations" title="Operations">
          <IncidentConfigSection companyId={activeCompanyId!} />
          <RadioStateSection companyId={activeCompanyId!} />
        </Section>

        <Section id="integrations" title="Integrations">
          <DeliveryChannelsSection integrations={integrations} />
          {integrationsError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="flex-1">Integrations couldn&apos;t be loaded, so they&apos;re hidden to avoid overwriting saved settings.</span>
              <Button size="sm" variant="outline" className="h-11 sm:h-7" onClick={() => void load()}>Retry</Button>
            </div>
          ) : (
            <IntegrationsSection
              companyId={activeCompanyId!}
              initialIntegrations={integrations}
            />
          )}
        </Section>

        <Section id="developer" title="API & Leads">
          {internalUserId && (
            <ApiSourcesSection companyId={activeCompanyId!} userId={internalUserId} />
          )}
        </Section>

        <Section id="diagnostics" title="Diagnostics">
          <ErrorLogViewer companyId={activeCompanyId!} />
        </Section>
      </div>
    </PageShell>
  );
}
