"use client";

import { useState } from "react";
import { Save, Loader2, Check, LayoutGrid, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateCompanySettings } from "@/lib/supabase/db";
import { TOGGLEABLE_TABS } from "@/lib/feature-flags";
import { useAuthStore } from "@/stores/auth-store";

interface FeatureVisibilitySectionProps {
  companyId: string;
  initialHiddenTabs: string[];
}

export default function FeatureVisibilitySection({ companyId, initialHiddenTabs }: FeatureVisibilitySectionProps) {
  const { user, setUser } = useAuthStore();
  const [hiddenTabs, setHiddenTabs] = useState<string[]>(initialHiddenTabs);
  const [savingTabs, setSavingTabs] = useState(false);
  const [savedTabs, setSavedTabs] = useState(false);

  async function handleSave() {
    if (!companyId) return;
    setSavingTabs(true);
    try {
      await updateCompanySettings(companyId, { hiddenTabs });
      if (user) {
        const updatedCompanies = user.companies.map((c) =>
          c.companyId === companyId ? { ...c, settings: { ...c.settings, hiddenTabs } } : c
        );
        setUser({ ...user, companies: updatedCompanies });
      }
      setSavedTabs(true);
      setTimeout(() => setSavedTabs(false), 2000);
    } catch (err) { console.error(err); }
    finally { setSavingTabs(false); }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> Feature Visibility</h3>
            <p className="text-xs text-muted-foreground">Toggle which tabs are visible for your entire company</p>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={savingTabs}>
            {savingTabs ? <Loader2 className="h-3 w-3 animate-spin" /> : savedTabs ? <Check className="h-3 w-3 text-green-500" /> : <Save className="h-3 w-3" />}
            {savedTabs ? "Saved!" : "Save"}
          </Button>
        </div>
        <div className="rounded-lg border border-border/40 overflow-hidden divide-y divide-border/30">
          {["Field Ops", "Academy", "Tools"].map((section) => {
            const sectionTabs = TOGGLEABLE_TABS.filter((t) => t.section === section);
            return (
              <div key={section}>
                <div className="px-4 py-2 bg-muted/20">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 font-mono">{section}</span>
                </div>
                {sectionTabs.map((tab) => {
                  const isVisible = !hiddenTabs.includes(tab.href);
                  return (
                    <div key={tab.href} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/10 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{tab.label}</p>
                        <p className="text-[10px] text-muted-foreground">{tab.description}</p>
                      </div>
                      <button
                        onClick={() => { setHiddenTabs((prev) => prev.includes(tab.href) ? prev.filter((h) => h !== tab.href) : [...prev, tab.href]); setSavedTabs(false); }}
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          isVisible ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        } cursor-pointer`}
                      >
                        {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {isVisible ? "Visible" : "Hidden"}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground text-center">Hidden tabs won&apos;t appear in the sidebar or mobile nav for anyone in this company.</p>
      </CardContent>
    </Card>
  );
}
