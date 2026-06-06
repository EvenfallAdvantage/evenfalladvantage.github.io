"use client";

/**
 * /admin/settings/email — per-company email-sending configuration.
 *
 * Lets an owner/admin pick SMTP or Resend as the delivery method, save
 * credentials (encrypted in Supabase Vault by the save RPC + Edge Function),
 * trigger a real test send, and view the recent-send log + verification
 * status. Until the configuration is verified via a successful test send,
 * the platform fallback ("via Overwatch") is used for outbound mail.
 *
 * Saving credentials is a two-step flow:
 *   1. Client writes the integrations_config row (delivery_method,
 *      from_email, from_name, reply_to) via PostgREST RLS (admin/owner).
 *   2. Client calls the `save_email_provider_credentials` RPC (Vault-backed)
 *      to upsert the vault secret + link the vault_secret_id. The RPC is
 *      service-role-only-callable via PostgREST, so we route this step
 *      through the email-send Edge Function's sibling endpoint... NOPE —
 *      simpler: we POST the creds to email-test-send which does NOT save
 *      them; saving lives in a tiny new RPC. (See note below — the save RPC
 *      is intentionally deferred to a follow-up commit; for now we
 *      instruct users to set the row + paste the vault_secret_id manually
 *      via the dashboard. The test-send + verified status work today.)
 */

import { useCallback, useEffect, useState } from "react";
import { Mail, Loader2, Save, Check, AlertTriangle, Send, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

type DeliveryMethod = "smtp" | "resend";

interface EmailConfigRow {
  id: string;
  delivery_method: DeliveryMethod | null;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  verified_at: string | null;
  test_sent_to: string | null;
  is_active: boolean;
}

interface RecentSend {
  id: string;
  sent_at: string;
  to_email: string;
  subject: string;
  status: string;
  delivery_method: string;
  purpose: string;
  error_message: string | null;
}

function getSupabaseFunctionsBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url.replace(/\/+$/, "")}/functions/v1` : null;
}

export default function EmailConfigPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdminPlus = ["owner", "admin"].includes(activeCompany?.role ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  // Form fields (mirror integrations_config columns).
  const [row, setRow] = useState<EmailConfigRow | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("resend");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [testTo, setTestTo] = useState("");

  // Recent sends.
  const [recentSends, setRecentSends] = useState<RecentSend[]>([]);

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const supabase = createClient();

    // Read existing config row.
    const { data: cfg } = await supabase
      .from("integrations_config")
      .select(
        "id, delivery_method, from_email, from_name, reply_to, verified_at, test_sent_to, is_active",
      )
      .eq("company_id", activeCompanyId)
      .eq("provider", "email")
      .maybeSingle();

    if (cfg) {
      const cfgT = cfg as unknown as EmailConfigRow;
      setRow(cfgT);
      if (cfgT.delivery_method) setDeliveryMethod(cfgT.delivery_method);
      setFromEmail(cfgT.from_email ?? "");
      setFromName(cfgT.from_name ?? "");
      setReplyTo(cfgT.reply_to ?? "");
      setTestTo(cfgT.test_sent_to ?? "");
    }

    // Read recent sends.
    const { data: log } = await supabase
      .from("email_send_log")
      .select(
        "id, sent_at, to_email, subject, status, delivery_method, purpose, error_message",
      )
      .eq("company_id", activeCompanyId)
      .order("sent_at", { ascending: false })
      .limit(20);
    if (log) setRecentSends(log as RecentSend[]);

    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!activeCompanyId) return;
    if (!fromEmail.trim() || !fromName.trim()) {
      toast.error("From name and from email are required.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        company_id: activeCompanyId,
        provider: "email",
        delivery_method: deliveryMethod,
        from_email: fromEmail.trim(),
        from_name: fromName.trim(),
        reply_to: replyTo.trim() || null,
        is_active: true,
        // Saving verified_at = null forces a re-verification after any
        // change to the public-facing fields. Test-send re-stamps it on
        // success.
        verified_at: null,
        config: {},
      };

      const { error } = await supabase
        .from("integrations_config")
        .upsert(payload, { onConflict: "company_id,provider" });
      if (error) throw error;

      toast.success("Saved. Run a test send to verify the configuration.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save email config",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSend() {
    if (!activeCompanyId) return;
    if (!testTo.trim()) {
      toast.error("Enter an email address to receive the test.");
      return;
    }
    const base = getSupabaseFunctionsBaseUrl();
    if (!base) {
      toast.error("Email test endpoint not configured.");
      return;
    }
    setTesting(true);
    try {
      const supabase = createClient();
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        toast.error("Please re-authenticate and try again.");
        return;
      }
      const res = await fetch(`${base}/email-test-send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: activeCompanyId,
          to_email: testTo.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        toast.error(
          json.error ?? `Test send failed (HTTP ${res.status})`,
        );
      } else {
        toast.success(
          `Test sent via ${json.delivery_method}. Check your inbox.`,
        );
      }
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Test send failed",
      );
    } finally {
      setTesting(false);
    }
  }

  if (activeCompany && !isAdminPlus) {
    return (
      <PageShell
        title="EMAIL CONFIG"
        subtitle="Per-company email sending"
        icon={<Mail className="h-5 w-5" />}
      >
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">Access Restricted</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Only owners and admins can configure email sending.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="EMAIL CONFIG"
      subtitle="Per-company email sending"
      icon={<Mail className="h-5 w-5" />}
    >
      <div className="space-y-6 max-w-3xl">
        {/* Status banner */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Delivery status
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-md">
                  {row?.verified_at
                    ? "Your provider is verified. Roster invitations and broadcasts are sent through your own credentials."
                    : "Not yet verified. Until you complete a successful test send, mail is delivered via the platform fallback (\u201cvia Overwatch\u201d in the From line)."}
                </p>
              </div>
              <Badge variant={row?.verified_at ? "default" : "outline"} className="shrink-0">
                {row?.verified_at ? "Verified" : "Unverified"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Provider config */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Provider
              </h3>
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : saved
                  ? <Check className="h-3 w-3 text-green-500" />
                  : <Save className="h-3 w-3" />}
                {saved ? "Saved!" : "Save"}
              </Button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Delivery method</Label>
              <div className="flex gap-2">
                {(["resend", "smtp"] as DeliveryMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDeliveryMethod(m)}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                      deliveryMethod === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-accent/40"
                    }`}
                  >
                    {m === "resend" ? "Resend" : "SMTP"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {deliveryMethod === "resend"
                  ? "Direct API delivery via Resend. Faster, but requires a verified sending domain in your Resend account."
                  : "Any SMTP relay (Mailgun, SES, M365, Postfix). More flexible, slightly slower."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="from-name" className="text-xs">From name</Label>
                <Input
                  id="from-name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder={activeCompany?.companyName ?? "Your company"}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="from-email" className="text-xs">From email</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="ops@yourcompany.com"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="reply-to" className="text-xs">Reply-To (optional)</Label>
                <Input
                  id="reply-to"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="Defaults to the sending manager's email"
                />
              </div>
            </div>

            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
              <p className="font-medium text-amber-700 dark:text-amber-300">Credentials</p>
              <p className="mt-1 text-muted-foreground">
                Your Resend API key or SMTP password is stored encrypted in
                Supabase Vault. Today, paste the credentials into the Supabase
                Dashboard under <code className="bg-background px-1 rounded">Database → Vault</code>,
                then put the resulting secret UUID into the{" "}
                <code className="bg-background px-1 rounded">vault_secret_id</code>{" "}
                column of the <code className="bg-background px-1 rounded">integrations_config</code>{" "}
                row for this company. A guided UI for this step is coming in a follow-up release.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test send */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Send className="h-4 w-4" />
              Test send
            </h3>
            <p className="text-xs text-muted-foreground">
              Sends a real test message through your configured provider. On
              success, the configuration becomes verified and will be used for
              all subsequent invitations and broadcasts.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="you@yourcompany.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleTestSend}
                disabled={testing || !row?.delivery_method}
                className="gap-1.5 text-xs"
              >
                {testing
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Send className="h-3 w-3" />}
                Send test
              </Button>
            </div>
            {!row?.delivery_method && (
              <p className="text-[10px] text-muted-foreground">
                Save your provider configuration first, then run the test.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent sends */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-3">Recent sends</h3>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentSends.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">
                No outbound mail yet. Invitations and broadcasts will show up here.
              </p>
            ) : (
              <div className="divide-y divide-border/40 text-xs">
                {recentSends.map((s) => (
                  <div
                    key={s.id}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.subject}</p>
                      <p className="text-muted-foreground">
                        to {s.to_email} &middot; {new Date(s.sent_at).toLocaleString()}
                      </p>
                      {s.error_message && (
                        <p className="text-red-500">{s.error_message}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant={s.status === "sent" ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {s.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {s.delivery_method} &middot; {s.purpose}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
