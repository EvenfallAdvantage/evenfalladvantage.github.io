"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Check, Save, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { getCompanyDetails, updateUserProfile } from "@/lib/supabase/db";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [joinCode, setJoinCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadCompany = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const company = await getCompanyDetails(activeCompanyId);
      setJoinCode(company?.join_code ?? "");
      setCompanyName(company?.name ?? "");
    } catch {}
  }, [activeCompanyId]);

  useEffect(() => { loadCompany(); }, [loadCompany]);
  useEffect(() => {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setPhone(user?.phone ?? "");
  }, [user]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateUserProfile({ firstName, lastName, phone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error("Save failed:", err); }
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
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Your profile and organization settings</p>
        </div>

        {/* Profile Settings */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-sm font-semibold">Profile</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={user?.email ?? ""} disabled className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="(555) 123-4567" />
            </div>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? "Saved!" : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Organization */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-sm font-semibold">Organization</h3>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-muted-foreground">Company</Label>
                <p className="text-sm font-medium">{companyName || "—"}</p>
              </div>
            </div>
            {joinCode && (
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs text-muted-foreground">Join Code</Label>
                  <p className="text-sm font-mono font-bold">{joinCode}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={copyCode}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
