"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Check, Copy } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyDetails, updateCompany } from "@/lib/supabase/db";

export default function AdminSettingsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [timezone, setTimezone] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const c = await getCompanyDetails(activeCompanyId);
      if (c) {
        setName(c.name ?? "");
        setJoinCode(c.join_code ?? "");
        setTimezone(c.timezone ?? "");
        setBrandColor(c.brand_color ?? "#1d3451");
      }
    } catch {}
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setSaving(true);
    try {
      await updateCompany(activeCompanyId, { name, brandColor, timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HQ Config</h1>
          <p className="text-sm text-muted-foreground">Organization profile and settings</p>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-sm font-semibold">Company Profile</h3>
            <div>
              <Label className="text-xs text-muted-foreground">Company Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1" placeholder="America/Los_Angeles" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Brand Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="flex-1 font-mono" />
              </div>
            </div>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? "Saved!" : "Save"}
            </Button>
          </CardContent>
        </Card>

        {joinCode && (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <h3 className="text-sm font-semibold">Join Code</h3>
              <p className="text-xs text-muted-foreground">Share this code so team members can join your organization.</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono font-bold tracking-widest">{joinCode}</span>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={copyCode}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
