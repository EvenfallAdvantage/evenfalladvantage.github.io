"use client";

import { useState } from "react";
import { Save, Loader2, Check, Plug, Mail, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getIntegrationsConfig, saveIntegrationConfig } from "@/lib/supabase/db";
import { isSecretKey } from "@/lib/integration-secrets";
import { HQ_ACTION_CLASS, HQ_LABEL_CLASS } from "@/lib/hq-config";
import { HqDisclosure } from "./hq-disclosure";

type IntField = { key: string; label: string; type: string; placeholder?: string; options?: string[] };
/** Integration definition: renders an inline credentials form. Email and SMS live on their own pages (see Delivery channels). */
type IntDef = {
  provider: string;
  label: string;
  logo: string | null;
  desc: string;
  fields: IntField[];
  /**
   * false = the vendor can't work yet (browser calls blocked by CORS, no
   * push SDK, undeployed webhook / OAuth refresh). The tile is shown as
   * "Not available yet" with no credential form, and is never "Active".
   * Existing integrations_config rows are left untouched.
   */
  available?: boolean;
};
type IntGroup = { id: string; label: string; desc: string; items: IntDef[] };

type IntConfig = Record<string, unknown> & {
  provider: string;
  config?: Record<string, string> | null;
  is_active?: boolean | null;
};

const INTEGRATION_GROUPS: IntGroup[] = [
  { id: "messaging", label: "Messaging & Alerts", desc: "Team comms, SMS dispatch, email automation, and push notifications", items: [
    { provider: "whatsapp", available: false, label: "WhatsApp Business", logo: "/images/integrations/whatsapp.png", desc: "Auto-invite new hires to WhatsApp community and send notifications", fields: [
      { key: "waba_id", label: "WABA ID", type: "text", placeholder: "1234567890" },
      { key: "phone_number_id", label: "Phone Number ID", type: "text", placeholder: "1234567890" },
      { key: "access_token", label: "Permanent Access Token", type: "password", placeholder: "EAAx..." },
      { key: "business_phone", label: "Business Phone Number", type: "text", placeholder: "+15551234567" },
      { key: "community_invite_link", label: "Community Invite Link", type: "text", placeholder: "https://chat.whatsapp.com/..." },
    ]},
    { provider: "onesignal", available: false, label: "OneSignal", logo: "/images/integrations/onesignal.jpeg", desc: "Push notifications for shift alerts, incident updates, and company announcements", fields: [
      { key: "app_id", label: "App ID", type: "text", placeholder: "your_onesignal_app_id" },
      { key: "rest_api_key", label: "REST API Key", type: "password", placeholder: "your_rest_api_key" },
    ]},
  ]},
  { id: "hiring", label: "Hiring & Onboarding", desc: "Applicant intake, background checks, records sync, and e-signatures", items: [
    { provider: "fillout", available: false, label: "Fillout", logo: "/images/integrations/fillout.png", desc: "Receive employment applications via Fillout webhook", fields: [
      { key: "webhook_secret", label: "Webhook Secret", type: "password", placeholder: "whsec_..." },
    ]},
    { provider: "checkr", available: false, label: "Checkr", logo: "/images/integrations/checkr.jpeg", desc: "Automated background checks triggered from the applicant pipeline on hire", fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "checkr_..." },
      { key: "package_slug", label: "Default Package", type: "select", options: ["tasker_standard", "tasker_plus", "driver_standard", "driver_plus", "basic_criminal", "essential_criminal"] },
      { key: "webhook_url", label: "Webhook URL (auto-generated)", type: "text", placeholder: "Set after first save" },
    ]},
    { provider: "docusign", available: false, label: "DocuSign", logo: "/images/integrations/docusign.jpeg", desc: "E-signatures for employment agreements, NDAs, and policy acknowledgments during onboarding", fields: [
      { key: "integration_key", label: "Integration Key", type: "text", placeholder: "your_integration_key" },
      { key: "secret_key", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "account_id", label: "Account ID", type: "text", placeholder: "your_account_id" },
      { key: "base_url", label: "Base URL", type: "select", options: ["https://demo.docusign.net", "https://app.docusign.com"] },
      { key: "template_id", label: "Onboarding Template ID (optional)", type: "text", placeholder: "abc-123-template-id" },
    ]},
  ]},
  { id: "payroll", label: "Payroll & Finance", desc: "Timesheet sync, payroll runs, and tax filing", items: [
    { provider: "gusto", available: false, label: "Gusto", logo: "/images/integrations/gusto.jpeg", desc: "Sync timesheets to payroll runs, manage tax filing and direct deposits", fields: [
      { key: "client_id", label: "OAuth Client ID", type: "text", placeholder: "your_client_id" },
      { key: "client_secret", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "company_uuid", label: "Gusto Company UUID", type: "text", placeholder: "uuid-from-gusto" },
      { key: "sync_frequency", label: "Sync Frequency", type: "select", options: ["manual", "daily", "weekly", "per_pay_period"] },
    ]},
    { provider: "quickbooks", available: false, label: "QuickBooks Online", logo: "/images/integrations/quickbooks.png", desc: "Sync approved timesheets to QuickBooks as TimeActivity entries for payroll processing", fields: [
      { key: "client_id", label: "OAuth Client ID", type: "text", placeholder: "your_client_id" },
      { key: "client_secret", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "realm_id", label: "Company ID (realmId)", type: "text", placeholder: "123456789" },
      { key: "environment", label: "Environment", type: "select", options: ["sandbox", "production"] },
    ]},
    { provider: "adp", available: false, label: "ADP Workforce Now", logo: "/images/integrations/adp.jpeg", desc: "Sync approved timesheets to ADP as time card entries for payroll processing", fields: [
      { key: "client_id", label: "API Client ID", type: "text", placeholder: "your_client_id" },
      { key: "client_secret", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "org_oid", label: "Organization OID", type: "text", placeholder: "your_org_oid" },
      { key: "environment", label: "Environment", type: "select", options: ["sandbox", "production"] },
    ]},
    { provider: "paychex", available: false, label: "Paychex Flex", logo: "/images/integrations/paychex.jpeg", desc: "Sync approved timesheets to Paychex Flex for payroll processing and direct deposits", fields: [
      { key: "client_id", label: "API Client ID", type: "text", placeholder: "your_client_id" },
      { key: "client_secret", label: "OAuth Access Token", type: "password", placeholder: "eyJ0eX..." },
      { key: "company_id", label: "Company ID (displayId)", type: "text", placeholder: "your_company_id" },
      { key: "environment", label: "Environment", type: "select", options: ["sandbox", "production"] },
    ]},
  ]},
];

const ALL_INTEGRATIONS = INTEGRATION_GROUPS.flatMap(g => g.items);

/** Names of secret fields already stored (values are never sent to the browser). */
const savedSecrets = (row: IntConfig | undefined): string[] => {
  const v = (row?.config as Record<string, unknown> | null | undefined)?.secret_keys_set;
  return Array.isArray(v) ? (v as string[]) : [];
};

export const isIntegrationAvailable = (def: Pick<IntDef, "available">) => def.available !== false;
export const INTEGRATION_PROVIDERS = ALL_INTEGRATIONS.map((d) => ({ provider: d.provider, available: isIntegrationAvailable(d) }));

function savedPublic(row: IntConfig | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries((row?.config ?? {}) as Record<string, unknown>)) {
    if (k === "secret_keys_set" || isSecretKey(k) || typeof v !== "string") continue;
    out[k] = v;
  }
  return out;
}

/** True when an available vendor has a typed secret, a changed field, or a changed Enabled flag. */
function providerDirty(
  def: IntDef,
  form: { config: Record<string, string>; isActive: boolean } | undefined,
  existing: IntConfig | undefined,
): boolean {
  if (!isIntegrationAvailable(def) || !form) return false;
  if (form.isActive !== (existing?.is_active ?? false)) return true;
  const saved = savedPublic(existing);
  const keys = new Set([...Object.keys(form.config), ...Object.keys(saved)]);
  for (const key of keys) {
    if (isSecretKey(key)) {
      if ((form.config[key] ?? "").trim()) return true;
      continue;
    }
    if ((form.config[key] ?? "") !== (saved[key] ?? "")) return true;
  }
  return false;
}

interface IntegrationsSectionProps {
  companyId: string;
  initialIntegrations: IntConfig[];
  /** Defaults to the live catalog. Tests pass a fixture with an available vendor. */
  groups?: IntGroup[];
}

export default function IntegrationsSection({ companyId, initialIntegrations, groups = INTEGRATION_GROUPS }: IntegrationsSectionProps) {
  const catalog = groups.flatMap((g) => g.items);
  const [integrations, setIntegrations] = useState<IntConfig[]>(initialIntegrations);
  const [savingInt, setSavingInt] = useState<string | null>(null);
  const [savedInt, setSavedInt] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // Build initial forms
  const buildForms = () => {
    const forms: Record<string, { config: Record<string, string>; isActive: boolean }> = {};
    for (const int of initialIntegrations) {
      // Secrets are never sent to the browser; only non-secret fields prefill.
      const { secret_keys_set: _set, ...cfg } = (int.config ?? {}) as Record<string, unknown>;
      void _set;
      forms[int.provider] = { config: cfg as Record<string, string>, isActive: int.is_active ?? false };
    }
    for (const def of catalog) {
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
      // Clear typed secrets from state once they're stored in Vault.
      setIntForms(prev => ({
        ...prev,
        [provider]: { ...prev[provider], config: Object.fromEntries(Object.entries(prev[provider]?.config ?? {}).filter(([k]) => !isSecretKey(k))) },
      }));
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

        {groups.map(group => {
          const activeCount = group.items.filter(d => {
            const f = intForms[d.provider];
            return isIntegrationAvailable(d) && f?.isActive;
          }).length;
          const configuredCount = group.items.filter(d => isIntegrationAvailable(d) && integrations.find((i: IntConfig) => i.provider === d.provider)).length;
          const dirty = group.items.some((def) => providerDirty(def, intForms[def.provider], integrations.find((i) => i.provider === def.provider)));

          return (
            <HqDisclosure
              key={group.id}
              testId={`hq-integration-group-${group.id}`}
              title={group.label}
              description={group.desc}
              forceOpen={dirty}
              meta={
                <>
                  {activeCount > 0 && <Badge className="text-[10px] bg-green-500/15 text-green-500">{activeCount} active</Badge>}
                  {configuredCount > 0 && activeCount === 0 && <Badge variant="outline" className="text-[10px]">{configuredCount} configured</Badge>}
                </>
              }
            >
                  {group.items.map(def => {
                    const form = intForms[def.provider];
                    const existing = integrations.find((i: IntConfig) => i.provider === def.provider);
                    const isConfigured = !!existing;

                    if (!isIntegrationAvailable(def)) {
                      return (
                        <div key={def.provider} data-testid={`integration-${def.provider}`} className="rounded-lg border border-dashed border-border/40 p-4 opacity-70">
                          <div className="flex flex-wrap items-center gap-2">
                            {def.logo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={def.logo} alt="" className="h-5 w-5 object-contain grayscale" />
                            )}
                            <span className="text-sm font-semibold">{def.label}</span>
                            <Badge variant="outline" className="text-[10px]">Not available yet</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{def.desc}</p>
                          <p className="mt-1 text-xs text-muted-foreground">This connection isn&apos;t supported yet. Contact support if you need it.</p>
                        </div>
                      );
                    }

                    return (
                      <div key={def.provider} data-testid={`integration-${def.provider}`} className={`rounded-lg border p-4 space-y-3 ${
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
                            {isConfigured && form?.isActive && <Badge className="text-[10px] bg-green-500/15 text-green-500">Active</Badge>}
                            {isConfigured && !form?.isActive && <Badge variant="outline" className="text-[10px]">Configured</Badge>}
                          </div>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input type="checkbox" checked={form?.isActive ?? false}
                              onChange={() => toggleIntActive(def.provider)}
                              className="rounded" />
                            Enabled
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">{def.desc}</p>

                        <form onSubmit={(e) => { e.preventDefault(); handleSaveIntegration(def.provider); }} autoComplete="off">
                          <div className="space-y-3">
                            {def.fields.map(field => {
                              const shown = !!showSecret[`${def.provider}.${field.key}`];
                              return (
                              <div key={field.key}>
                                <Label className={HQ_LABEL_CLASS}>{field.label}</Label>
                                {field.type === "select" && "options" in field && field.options ? (
                                  <select
                                    value={form?.config?.[field.key] ?? ""}
                                    onChange={(e) => updateIntField(def.provider, field.key, e.target.value)}
                                    aria-label={field.label}
                                    className="mt-1 h-11 w-full rounded-md border border-border/40 bg-background px-2 text-sm sm:h-8">
                                    <option value="">Select...</option>
                                    {field.options.map((o: string) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                                  </select>
                                ) : (
                                  <div className="relative mt-1">
                                    <Input
                                      type={field.type === "password" && !shown ? "password" : "text"}
                                      value={form?.config?.[field.key] ?? ""}
                                      onChange={(e) => updateIntField(def.provider, field.key, e.target.value)}
                                      placeholder={
                                        field.type === "password" && savedSecrets(existing).includes(field.key)
                                          ? "Saved. Leave blank to keep, or enter a new value"
                                          : field.placeholder ?? ""
                                      }
                                      aria-label={field.label}
                                      autoComplete="off"
                                      className="h-11 pr-12 text-sm sm:h-8" />
                                    {field.type === "password" && (
                                      <button type="button"
                                        aria-label={shown ? `Hide ${field.label}` : `Show ${field.label}`}
                                        aria-pressed={shown}
                                        onClick={() => setShowSecret(p => ({ ...p, [`${def.provider}.${field.key}`]: !p[`${def.provider}.${field.key}`] }))}
                                        className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-7 sm:w-7">
                                        {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );})}
                          </div>

                          <Button type="submit" size="sm" className={`${HQ_ACTION_CLASS} mt-3 text-xs`}
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
            </HqDisclosure>
          );
        })}

      </CardContent>
    </Card>
  );
}
