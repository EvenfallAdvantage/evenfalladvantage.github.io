"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Check, Copy, Plus, CalendarOff, ImageIcon, Trash2, Building2, Globe, MapPin, Plug, Mail, Eye, EyeOff, ChevronDown, LayoutGrid } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyDetails, updateCompany, updateCompanySettings, getTimeOffPolicies, createTimeOffPolicy, deleteTimeOffPolicy, getIntegrationsConfig, saveIntegrationConfig } from "@/lib/supabase/db";
import { TOGGLEABLE_TABS } from "@/lib/feature-flags";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Policy = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IntConfig = any;

const LEAVE_TYPES = ["vacation", "sick", "personal", "bereavement", "parental", "unpaid"];

type IntField = { key: string; label: string; type: string; placeholder?: string; options?: string[] };
type IntDef = { provider: string; label: string; logo: string | null; desc: string; fields: IntField[] };
type IntGroup = { id: string; label: string; desc: string; items: IntDef[] };

const INTEGRATION_GROUPS: IntGroup[] = [
  { id: "messaging", label: "Messaging & Alerts", desc: "Team comms, SMS dispatch, email automation, and push notifications", items: [
    { provider: "whatsapp", label: "WhatsApp Business", logo: "/images/integrations/whatsapp.png", desc: "Auto-invite new hires to WhatsApp community and send notifications", fields: [
      { key: "waba_id", label: "WABA ID", type: "text", placeholder: "1234567890" },
      { key: "phone_number_id", label: "Phone Number ID", type: "text", placeholder: "1234567890" },
      { key: "access_token", label: "Permanent Access Token", type: "password", placeholder: "EAAx..." },
      { key: "business_phone", label: "Business Phone Number", type: "text", placeholder: "+15551234567" },
      { key: "community_invite_link", label: "Community Invite Link", type: "text", placeholder: "https://chat.whatsapp.com/..." },
    ]},
    { provider: "signal", label: "Signal", logo: "/images/integrations/signal.png", desc: "Secure encrypted messaging for sensitive operations and executive protection", fields: [
      { key: "signal_group_link", label: "Signal Group Invite Link", type: "text", placeholder: "https://signal.group/#..." },
    ]},
    { provider: "twilio", label: "Twilio", logo: "/images/integrations/twilio.jpeg", desc: "SMS dispatch alerts, shift reminders, emergency notifications, and OTP verification", fields: [
      { key: "account_sid", label: "Account SID", type: "text", placeholder: "AC..." },
      { key: "auth_token", label: "Auth Token", type: "password", placeholder: "your_auth_token" },
      { key: "from_number", label: "From Number", type: "text", placeholder: "+15551234567" },
      { key: "messaging_service_sid", label: "Messaging Service SID (optional)", type: "text", placeholder: "MG..." },
    ]},
    { provider: "email", label: "Email (Postmark / Resend)", logo: null, desc: "Auto-send onboarding emails when applicants are hired", fields: [
      { key: "provider", label: "Provider", type: "select", options: ["postmark", "resend"] },
      { key: "api_key", label: "API Key", type: "password", placeholder: "pm_..." },
      { key: "from_email", label: "From Email", type: "email", placeholder: "noreply@yourcompany.com" },
      { key: "from_name", label: "From Name", type: "text", placeholder: "TGT Security" },
    ]},
    { provider: "onesignal", label: "OneSignal", logo: "/images/integrations/onesignal.jpeg", desc: "Push notifications for shift alerts, incident updates, and company announcements", fields: [
      { key: "app_id", label: "App ID", type: "text", placeholder: "your_onesignal_app_id" },
      { key: "rest_api_key", label: "REST API Key", type: "password", placeholder: "your_rest_api_key" },
    ]},
  ]},
  { id: "hiring", label: "Hiring & Onboarding", desc: "Applicant intake, background checks, records sync, and e-signatures", items: [
    { provider: "fillout", label: "Fillout", logo: "/images/integrations/fillout.png", desc: "Receive employment applications via Fillout webhook", fields: [
      { key: "webhook_secret", label: "Webhook Secret", type: "password", placeholder: "whsec_..." },
    ]},
    { provider: "airtable", label: "Airtable", logo: "/images/integrations/airtable.jpeg", desc: "Sync applicant records with Airtable", fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "pat..." },
      { key: "base_id", label: "Base ID", type: "text", placeholder: "app..." },
      { key: "table_name", label: "Table Name", type: "text", placeholder: "Staff" },
    ]},
    { provider: "checkr", label: "Checkr", logo: "/images/integrations/checkr.jpeg", desc: "Automated background checks triggered from the applicant pipeline on hire", fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "checkr_..." },
      { key: "package_slug", label: "Default Package", type: "select", options: ["tasker_standard", "tasker_plus", "driver_standard", "driver_plus", "basic_criminal", "essential_criminal"] },
      { key: "webhook_url", label: "Webhook URL (auto-generated)", type: "text", placeholder: "Set after first save" },
    ]},
    { provider: "docusign", label: "DocuSign", logo: "/images/integrations/docusign.jpeg", desc: "E-signatures for employment agreements, NDAs, and policy acknowledgments during onboarding", fields: [
      { key: "integration_key", label: "Integration Key", type: "text", placeholder: "your_integration_key" },
      { key: "secret_key", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "account_id", label: "Account ID", type: "text", placeholder: "your_account_id" },
      { key: "base_url", label: "Base URL", type: "select", options: ["https://demo.docusign.net", "https://app.docusign.com"] },
      { key: "template_id", label: "Onboarding Template ID (optional)", type: "text", placeholder: "abc-123-template-id" },
    ]},
  ]},
  { id: "payroll", label: "Payroll & Finance", desc: "Timesheet sync, payroll runs, and tax filing", items: [
    { provider: "gusto", label: "Gusto", logo: "/images/integrations/gusto.jpeg", desc: "Sync timesheets to payroll runs, manage tax filing and direct deposits", fields: [
      { key: "client_id", label: "OAuth Client ID", type: "text", placeholder: "your_client_id" },
      { key: "client_secret", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "company_uuid", label: "Gusto Company UUID", type: "text", placeholder: "uuid-from-gusto" },
      { key: "sync_frequency", label: "Sync Frequency", type: "select", options: ["manual", "daily", "weekly", "per_pay_period"] },
    ]},
  ]},
];

const ALL_INTEGRATIONS = INTEGRATION_GROUPS.flatMap(g => g.items);

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
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const { user, setUser } = useAuthStore();
  const isOwner = activeCompany?.role === "owner";
  const isAdminPlus = ["owner", "admin"].includes(activeCompany?.role ?? "");
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
  // Integrations
  const [integrations, setIntegrations] = useState<IntConfig[]>([]);
  const [intForms, setIntForms] = useState<Record<string, { config: Record<string, string>; isActive: boolean }>>({});
  const [savingInt, setSavingInt] = useState<string | null>(null);
  const [savedInt, setSavedInt] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  // Tab visibility
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [savingTabs, setSavingTabs] = useState(false);
  const [savedTabs, setSavedTabs] = useState(false);

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
        if (c.settings) {
          const s = c.settings as { hiddenTabs?: string[] };
          setHiddenTabs(s.hiddenTabs ?? []);
        }
      }
      setPolicies(p);
      // Load integrations
      try {
        const ints = await getIntegrationsConfig(activeCompanyId);
        setIntegrations(ints);
        const forms: Record<string, { config: Record<string, string>; isActive: boolean }> = {};
        for (const int of ints) {
          forms[int.provider] = { config: int.config ?? {}, isActive: int.is_active ?? false };
        }
        // Initialize empty forms for unconfigured providers
        for (const def of ALL_INTEGRATIONS) {
          if (!forms[def.provider]) {
            const cfg: Record<string, string> = {};
            for (const f of def.fields) cfg[f.key] = "";
            forms[def.provider] = { config: cfg, isActive: false };
          }
        }
        setIntForms(forms);
      } catch {}
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

  async function handleSaveIntegration(provider: string) {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setSavingInt(provider);
    try {
      const form = intForms[provider];
      if (!form) return;
      await saveIntegrationConfig(activeCompanyId, provider, form.config, form.isActive);
      setSavedInt(provider);
      setTimeout(() => setSavedInt(null), 2000);
      setIntegrations(await getIntegrationsConfig(activeCompanyId));
    } catch (err) { console.error(err); }
    finally { setSavingInt(null); }
  }

  function updateIntField(provider: string, key: string, value: string) {
    setIntForms(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        config: { ...(prev[provider]?.config ?? {}), [key]: value },
      },
    }));
  }

  function toggleIntActive(provider: string) {
    setIntForms(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        isActive: !prev[provider]?.isActive,
      },
    }));
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

  if (activeCompany && !isAdminPlus) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium">Access Restricted</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">Only admins and owners can access HQ Config.</p>
      </div>
    );
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

        {/* Tab Visibility */}
        {isOwner && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> Feature Visibility</h3>
                  <p className="text-xs text-muted-foreground">Toggle which tabs are visible for your entire company</p>
                </div>
                <Button size="sm" className="gap-1.5 text-xs" onClick={async () => {
                  if (!activeCompanyId || activeCompanyId === "pending") return;
                  setSavingTabs(true);
                  try {
                    await updateCompanySettings(activeCompanyId, { hiddenTabs });
                    if (user) {
                      const updatedCompanies = user.companies.map((c) =>
                        c.companyId === activeCompanyId ? { ...c, settings: { ...c.settings, hiddenTabs } } : c
                      );
                      setUser({ ...user, companies: updatedCompanies });
                    }
                    setSavedTabs(true);
                    setTimeout(() => setSavedTabs(false), 2000);
                  } catch (err) { console.error(err); }
                  finally { setSavingTabs(false); }
                }} disabled={savingTabs}>
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
        )}

        {/* Integrations */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2"><Plug className="h-4 w-4" /> External Integrations</h3>
              <p className="text-xs text-muted-foreground">Connect external tools to automate intake, onboarding, and communications</p>
            </div>

            {INTEGRATION_GROUPS.map(group => {
              const isOpen = expandedGroups[group.id] ?? false;
              const activeCount = group.items.filter(d => {
                const f = intForms[d.provider];
                return f?.isActive;
              }).length;
              const configuredCount = group.items.filter(d => integrations.find((i: IntConfig) => i.provider === d.provider)).length;

              return (
                <div key={group.id} className="rounded-lg border border-border/40 overflow-hidden">
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => setExpandedGroups(p => ({ ...p, [group.id]: !p[group.id] }))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{group.label}</span>
                        {activeCount > 0 && <Badge className="text-[9px] bg-green-500/15 text-green-500">{activeCount} active</Badge>}
                        {configuredCount > 0 && activeCount === 0 && <Badge variant="outline" className="text-[9px]">{configuredCount} configured</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{group.desc}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Collapsible items */}
                  {isOpen && (
                    <div className="border-t border-border/30 px-4 py-3 space-y-3">
                      {group.items.map(def => {
                        const form = intForms[def.provider];
                        const existing = integrations.find((i: IntConfig) => i.provider === def.provider);
                        const isConfigured = !!existing;

                        return (
                          <div key={def.provider} className={`rounded-lg border p-4 space-y-3 ${
                            form?.isActive ? "border-green-500/30 bg-green-500/5" : "border-border/40"
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {def.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={def.logo} alt={def.label} className="h-5 w-5 object-contain" />
                                ) : (
                                  <Mail className="h-4 w-4 text-primary" />
                                )}
                                <span className="text-sm font-semibold">{def.label}</span>
                                {isConfigured && form?.isActive && <Badge className="text-[9px] bg-green-500/15 text-green-500">Active</Badge>}
                                {isConfigured && !form?.isActive && <Badge variant="outline" className="text-[9px]">Configured</Badge>}
                              </div>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input type="checkbox" checked={form?.isActive ?? false}
                                  onChange={() => toggleIntActive(def.provider)}
                                  className="rounded" />
                                Enabled
                              </label>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{def.desc}</p>

                            <form onSubmit={(e) => { e.preventDefault(); handleSaveIntegration(def.provider); }} autoComplete="off">
                              <div className="space-y-2">
                                {def.fields.map(field => (
                                  <div key={field.key}>
                                    <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                                    {field.type === "select" && "options" in field && field.options ? (
                                      <select
                                        value={form?.config?.[field.key] ?? ""}
                                        onChange={(e) => updateIntField(def.provider, field.key, e.target.value)}
                                        className="mt-0.5 h-8 w-full rounded border border-border/40 bg-background px-2 text-xs">
                                        <option value="">Select...</option>
                                        {field.options.map((o: string) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                      </select>
                                    ) : (
                                      <div className="relative mt-0.5">
                                        <Input
                                          type={field.type === "password" && !showSecret[`${def.provider}.${field.key}`] ? "password" : "text"}
                                          value={form?.config?.[field.key] ?? ""}
                                          onChange={(e) => updateIntField(def.provider, field.key, e.target.value)}
                                          placeholder={field.placeholder ?? ""}
                                          autoComplete="off"
                                          className="h-8 text-xs pr-8" />
                                        {field.type === "password" && (
                                          <button type="button"
                                            onClick={() => setShowSecret(p => ({ ...p, [`${def.provider}.${field.key}`]: !p[`${def.provider}.${field.key}`] }))}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                                            {showSecret[`${def.provider}.${field.key}`] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <Button type="submit" size="sm" className="gap-1.5 text-xs mt-3"
                                disabled={savingInt === def.provider}>
                                {savingInt === def.provider ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : savedInt === def.provider ? <Check className="h-3 w-3 text-green-500" />
                                  : <Save className="h-3 w-3" />}
                                {savedInt === def.provider ? "Saved!" : "Save"}
                              </Button>
                            </form>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="rounded-lg border border-dashed border-border/40 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">More integrations coming soon: Verkada cameras, Brivo access control, Samsara fleet GPS, QuickBooks</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
