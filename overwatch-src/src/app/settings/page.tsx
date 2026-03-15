"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Save, Loader2, User, Building2, Mail, Phone, Shield, KeyRound } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { getCompanyDetails, updateUserProfile } from "@/lib/supabase/db";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [joinCode, setJoinCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

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
      if (user) setUser({ ...user, firstName, lastName, phone });
      setSaved(true);
      setEditingProfile(false);
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
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">SETTINGS</h1>
          <p className="text-sm text-muted-foreground">Profile, organization, and preferences</p>
        </div>

        {/* Identity card */}
        <Card className="overflow-hidden border-border/40">
          <div className="h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
          <CardContent className="-mt-8 space-y-5 pb-6">
            <div className="flex items-end gap-4">
              <Avatar className="h-16 w-16 border-4 border-card shadow-lg">
                <AvatarFallback className="bg-primary/20 text-lg font-bold text-primary">{initials || "?"}</AvatarFallback>
              </Avatar>
              <div className="pb-0.5">
                <h2 className="text-lg font-semibold leading-tight">
                  {user?.firstName || "Your"} {user?.lastName || "Name"}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px] capitalize font-mono">
                    <Shield className="mr-1 h-3 w-3" />
                    {activeCompany?.role ?? "staff"}
                  </Badge>
                  {companyName && (
                    <Badge variant="outline" className="text-[10px]">
                      <Building2 className="mr-1 h-3 w-3" />
                      {companyName}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Profile fields */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profile Details</span>
                {!editingProfile && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingProfile(true)}>
                    Edit
                  </Button>
                )}
              </div>

              {editingProfile ? (
                <div className="space-y-3 rounded-xl border border-border/50 bg-muted/30 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <User className="h-3 w-3" /> First Name
                      </label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <User className="h-3 w-3" /> Last Name
                      </label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Phone className="h-3 w-3" /> Phone
                    </label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" placeholder="(555) 123-4567" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3 text-green-500" /> : <Save className="h-3 w-3" />}
                      {saved ? "Saved!" : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingProfile(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2.5">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase">Email</p>
                      <p className="text-sm font-medium truncate">{user?.email || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2.5">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase">Phone</p>
                      <p className="text-sm font-medium">{user?.phone || "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Organization card */}
        {joinCode && (
          <Card className="border-border/40">
            <CardContent className="space-y-4 pt-6 pb-6">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Join Code</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-5 py-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Share this code to invite team members</p>
                  <p className="text-2xl font-mono font-bold tracking-[0.3em] text-amber-500">{joinCode}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copyCode}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
