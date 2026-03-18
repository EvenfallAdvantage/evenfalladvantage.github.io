"use client";

import { useEffect, useState } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { Building2, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyDetails, updateCompanySettings } from "@/lib/supabase/db";
import { TOGGLEABLE_TABS } from "@/lib/feature-flags";

export default function CompanySettingsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const { user, setUser } = useAuthStore();
  const isOwner = activeCompany?.role === "owner";
  const isLeadership = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    getCompanyDetails(activeCompanyId).then((company) => {
      if (company?.settings) {
        const s = company.settings as { hiddenTabs?: string[] };
        setHiddenTabs(s.hiddenTabs ?? []);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [activeCompanyId]);

  function toggleTab(href: string) {
    setHiddenTabs((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
    setSaved(false);
  }

  async function handleSave() {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setSaving(true);
    try {
      await updateCompanySettings(activeCompanyId, { hiddenTabs });
      // Update the auth store so sidebar reflects changes immediately
      if (user) {
        const updatedCompanies = user.companies.map((c) =>
          c.companyId === activeCompanyId
            ? { ...c, settings: { ...c.settings, hiddenTabs } }
            : c
        );
        setUser({ ...user, companies: updatedCompanies });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  if (!isLeadership) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium">Access Denied</p>
        <p className="text-xs text-muted-foreground mt-1">Only company owners and managers can access settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono uppercase flex items-center gap-2">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6" /> Company Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure which features are available to your team
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || saved}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Save className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {/* Tab Visibility */}
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="border-b border-border/40 px-5 py-4">
              <h2 className="text-sm font-semibold">Feature Visibility</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggle which tabs are visible in the sidebar and navigation for your entire company.
                {!isOwner && " Only the company owner can change these settings."}
              </p>
            </div>
            <div className="divide-y divide-border/30">
              {/* Group by section */}
              {["Field Ops", "Academy", "Tools"].map((section) => {
                const sectionTabs = TOGGLEABLE_TABS.filter((t) => t.section === section);
                return (
                  <div key={section}>
                    <div className="px-5 py-2.5 bg-muted/20">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 font-mono">{section}</span>
                    </div>
                    {sectionTabs.map((tab) => {
                      const isVisible = !hiddenTabs.includes(tab.href);
                      return (
                        <div key={tab.href} className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{tab.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{tab.description}</p>
                          </div>
                          <button
                            onClick={() => isOwner && toggleTab(tab.href)}
                            disabled={!isOwner}
                            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              isVisible
                                ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            } ${!isOwner ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {isVisible ? "Visible" : "Hidden"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Hidden tabs will not appear in the sidebar or mobile navigation for any member of this company.
          </p>
        </div>
      )}
    </div>
  );
}
