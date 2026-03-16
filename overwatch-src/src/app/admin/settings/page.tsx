"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Check, Copy, Plus, CalendarOff, ImageIcon, Trash2, Building2, Globe, MapPin } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyDetails, updateCompany, getTimeOffPolicies, createTimeOffPolicy, deleteTimeOffPolicy } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Policy = any;

const LEAVE_TYPES = ["vacation", "sick", "personal", "bereavement", "parental", "unpaid"];

// Get all IANA timezone names (browser Intl API)
const ALL_TIMEZONES: string[] = typeof Intl !== "undefined" && Intl.supportedValuesOf
  ? Intl.supportedValuesOf("timeZone")
  : [
      "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
      "America/Anchorage","Pacific/Honolulu","America/Phoenix","America/Indiana/Indianapolis",
      "America/Detroit","America/Kentucky/Louisville","America/Toronto","America/Vancouver",
      "Europe/London","Europe/Paris","Europe/Berlin","Europe/Moscow",
      "Asia/Tokyo","Asia/Shanghai","Asia/Kolkata","Asia/Dubai",
      "Australia/Sydney","Australia/Melbourne","Pacific/Auckland",
      "America/Sao_Paulo","America/Mexico_City","Africa/Cairo","Africa/Johannesburg",
    ];

const DEVICE_TZ = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

export default function AdminSettingsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [timezone, setTimezone] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [policyName, setPolicyName] = useState("");
  const [policyType, setPolicyType] = useState("vacation");
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<string | null>(null);
  const [tzSearch, setTzSearch] = useState("");
  const [tzOpen, setTzOpen] = useState(false);
  const tzRef = useRef<HTMLDivElement>(null);

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
        setBrandColor(c.brand_color ?? "#1d3451");
        setLogoUrl(c.logo_url ?? "");
      }
      setPolicies(p);
    } catch {}
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  // Close timezone dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tzRef.current && !tzRef.current.contains(e.target as Node)) setTzOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSave() {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setSaving(true);
    try {
      await updateCompany(activeCompanyId, { name, brandColor, timezone, logoUrl: logoUrl || undefined });
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

  async function handleDeletePolicy(policyId: string) {
    if (!confirm("Delete this leave policy?")) return;
    setDeletingPolicy(policyId);
    try {
      await deleteTimeOffPolicy(policyId);
      if (activeCompanyId) setPolicies(await getTimeOffPolicies(activeCompanyId));
    } catch (err) { console.error(err); }
    finally { setDeletingPolicy(null); }
  }

  async function handleAddPolicy() {
    if (!policyName.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreatingPolicy(true);
    try {
      await createTimeOffPolicy({ companyId: activeCompanyId, name: policyName.trim(), type: policyType });
      setPolicyName(""); setPolicyType("vacation"); setShowAddPolicy(false);
      setPolicies(await getTimeOffPolicies(activeCompanyId));
    } catch (err) { console.error(err); }
    finally { setCreatingPolicy(false); }
  }

  return (
    <>
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><Building2 className="h-5 w-5 sm:h-6 sm:w-6" /> HQ CONFIG</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Organization profile and settings</p>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-sm font-semibold">Company Profile</h3>
            <div>
              <Label className="text-xs text-muted-foreground">Company Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Company Logo URL</Label>
              <div className="flex items-center gap-2 mt-1">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="flex-1" placeholder="https://example.com/logo.png" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Paste a URL to your company logo. It will appear in the sidebar.</p>
            </div>
            <div ref={tzRef}>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Timezone
              </Label>
              <div className="relative mt-1">
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Input
                      value={tzOpen ? tzSearch : timezone}
                      onChange={(e) => { setTzSearch(e.target.value); setTzOpen(true); }}
                      onFocus={() => { setTzSearch(""); setTzOpen(true); }}
                      placeholder="Search timezones..."
                      className="pr-8"
                    />
                    {timezone && !tzOpen && (
                      <MapPin className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                  </div>
                  <Button
                    type="button" size="sm" variant="outline"
                    className="shrink-0 text-[10px] gap-1"
                    onClick={() => { setTimezone(DEVICE_TZ); setTzOpen(false); }}
                    title={`Detect: ${DEVICE_TZ}`}
                  >
                    <MapPin className="h-3 w-3" /> Detect
                  </Button>
                </div>
                {tzOpen && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                    {ALL_TIMEZONES
                      .filter((tz) => tz.toLowerCase().includes(tzSearch.toLowerCase()))
                      .slice(0, 50)
                      .map((tz) => (
                        <button
                          key={tz}
                          type="button"
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${tz === timezone ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}
                          onClick={() => { setTimezone(tz); setTzOpen(false); setTzSearch(""); }}
                        >
                          {tz}
                        </button>
                      ))}
                    {ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(tzSearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No timezones match &ldquo;{tzSearch}&rdquo;</p>
                    )}
                  </div>
                )}
              </div>
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

        {/* Leave Policies */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Leave Policies</h3>
                <p className="text-xs text-muted-foreground">Configure leave types your team can request</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddPolicy(true)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>

            {showAddPolicy && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Input placeholder="Policy name (e.g. Annual Leave)" value={policyName} onChange={(e) => setPolicyName(e.target.value)} />
                <select value={policyType} onChange={(e) => setPolicyType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddPolicy} disabled={!policyName.trim() || creatingPolicy}>
                    {creatingPolicy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddPolicy(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {policies.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-4">
                <CalendarOff className="h-5 w-5 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No leave policies yet. Add one so your team can request time off.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {policies.map((p: Policy) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <CalendarOff className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] capitalize">{p.type}</Badge>
                      <button onClick={() => handleDeletePolicy(p.id)} disabled={deletingPolicy === p.id}
                        className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete policy">
                        {deletingPolicy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
