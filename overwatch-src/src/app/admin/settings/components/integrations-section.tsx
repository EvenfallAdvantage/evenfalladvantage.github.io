"use client";

import { useState } from "react";
import Link from "next/link";
import { Save, Loader2, Check, Plug, Mail, Eye, EyeOff, ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getIntegrationsConfig, saveIntegrationConfig } from "@/lib/supabase/db";

type IntField = { key: string; label: string; type: string; placeholder?: string; options?: string[] };
/**
 * Integration definition.
 *   - Normal integrations: have `fields` and render an inline credentials form.
 *   - `redirectTo` integrations: render a link card pointing to a dedicated
 *     configuration page (used for email, which moved to /admin/settings/email
 *     once it grew its own Vault-backed credential storage + verification
 *     flow). For redirect tiles, `fields` is empty.
 */
type IntDef = {
  provider: string;
  label: string;
  logo: string | null;
  desc: string;
  fields: IntField[];
  redirectTo?: string;
};
type IntGroup = { id: string; label: string; desc: string; items: IntDef[] };

type IntConfig = Record<string, unknown> & {
  provider: string;
  config?: Record<string, string> | null;
  is_active?: boolean | null;
};

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
    // Email config moved to its own page (/admin/settings/email) — it has
    // a verification flow, Vault-backed credential storage, recent-sends
    // log, and per-message audit that don't fit the generic integrations
    // form. We keep a redirect tile here so admins can still discover it
    // from HQ Config.
    {
      provider: "email",
      label: "Email Sending",
      logo: null,
      desc: "Configure per-company SMTP or Resend for invitations and broadcasts",
      fields: [],
      redirectTo: "/admin/settings/email",
    },
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
    { provider: "quickbooks", label: "QuickBooks Online", logo: "/images/integrations/quickbooks.png", desc: "Sync approved timesheets to QuickBooks as TimeActivity entries for payroll processing", fields: [
      { key: "client_id", label: "OAuth Client ID", type: "text", placeholder: "your_client_id" },
      { key: "client_secret", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "realm_id", label: "Company ID (realmId)", type: "text", placeholder: "123456789" },
      { key: "environment", label: "Environment", type: "select", options: ["sandbox", "production"] },
    ]},
    { provider: "adp", label: "ADP Workforce Now", logo: "/images/integrations/adp.jpeg", desc: "Sync approved timesheets to ADP as time card entries for payroll processing", fields: [
      { key: "client_id", label: "API Client ID", type: "text", placeholder: "your_client_id" },
      { key: "client_secret", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "org_oid", label: "Organization OID", type: "text", placeholder: "your_org_oid" },
      { key: "environment", label: "Environment", type: "select", options: ["sandbox", "production"] },
    ]},
    { provider: "paychex", label: "Paychex Flex", logo: "/images/integrations/paychex.jpeg", desc: "Sync approved timesheets to Paychex Flex for payroll processing and direct deposits", fields: [
      { key: "client_id", label: "API Client ID", type: "text", placeholder: "your_client_id" },
      { key: "client_secret", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "company_id", label: "Company ID (displayId)", type: "text", placeholder: "your_company_id" },
      { key: "environment", label: "Environment", type: "select", options: ["sandbox", "production"] },
    ]},
  ]},
];

const ALL_INTEGRATIONS = INTEGRATION_GROUPS.flatMap(g => g.items);

interface IntegrationsSectionProps {
  companyId: string;
  initialIntegrations: IntConfig[];
}

export default function IntegrationsSection({ companyId, initialIntegrations }: IntegrationsSectionProps) {
  const [integrations, setIntegrations] = useState<IntConfig[]>(initialIntegrations);
  const [savingInt, setSavingInt] = useState<string | null>(null);
  const [savedInt, setSavedInt] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Build initial forms
  const buildForms = () => {
    const forms: Record<string, { config: Record<string, string>; isActive: boolean }> = {};
    for (const int of initialIntegrations) {
      forms[int.provider] = { config: int.config ?? {}, isActive: int.is_active ?? false };
    }
    for (const def of ALL_INTEGRATIONS) {
      if (!forms[def.provider]) {
        const cfg: Record<string, string> = {};
        for (const f of def.fields) cfg[f.key] = "";
        forms[def.provider] = { config: cfg, isActive: false };
      }
    }
    return forms;
  };

  const [intForms, setIntForms] = useState<Record<string, { config: Record<string, string>; isActive: boolean }>>(buildForms);

  async function handleSaveIntegration(provider: string) {
    if (!companyId) return;
    setSavingInt(provider);
    try {
      const form = intForms[provider];
      if (!form) return;
      await saveIntegrationConfig(companyId, provider, form.config, form.isActive);
      setSavedInt(provider);
      setTimeout(() => setSavedInt(null), 2000);
      setIntegrations(await getIntegrationsConfig(companyId));
      toast.success(`${provider} config saved`);
    } catch (err) { console.error(err); toast.error("Failed to save integration"); }
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

  return (
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

              {isOpen && (
                <div className="border-t border-border/30 px-4 py-3 space-y-3">
                  {group.items.map(def => {
                    const form = intForms[def.provider];
                    const existing = integrations.find((i: IntConfig) => i.provider === def.provider);
                    const isConfigured = !!existing;

                    // Redirect tile: render a link to the dedicated config
                    // page and skip the inline credential form entirely.
                    // The integrations_config row's verification status is
                    // surfaced via a "Verified" badge if present.
                    if (def.redirectTo) {
                      const existingRow = existing as
                        | (IntConfig & { verified_at?: string | null; delivery_method?: string | null })
                        | undefined;
                      const verified = Boolean(existingRow?.verified_at);
                      const method = existingRow?.delivery_method;
                      return (
                        <Link
                          key={def.provider}
                          href={def.redirectTo}
                          className="block rounded-lg border border-border/40 p-4 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-primary" />
                              <span className="text-sm font-semibold">{def.label}</span>
                              {verified && (
                                <Badge className="text-[9px] bg-green-500/15 text-green-500">
                                  Verified{method ? ` · ${method}` : ""}
                                </Badge>
                              )}
                              {isConfigured && !verified && (
                                <Badge variant="outline" className="text-[9px] text-amber-500">
                                  Unverified
                                </Badge>
                              )}
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{def.desc}</p>
                          <p className="text-[10px] text-primary mt-2">Open Email Config →</p>
                        </Link>
                      );
                    }

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
          <p className="text-[10px] text-muted-foreground">More integrations coming soon: Verkada cameras, Brivo access control, Samsara fleet GPS</p>
        </div>
      </CardContent>
    </Card>
  );
}
