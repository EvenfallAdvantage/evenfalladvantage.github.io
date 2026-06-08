"use client";

/**
 * /admin/settings/sms - per-company SMS sending configuration (Phase 4 / HaloEngage).
 *
 * Lets an owner/admin configure Twilio credentials (encrypted in Supabase
 * Vault by sms-save-credentials), trigger a real test send, and view recent
 * sends + verification status. Mirrors /admin/settings/email exactly in
 * structure and security posture.
 */

import { useCallback, useEffect, useState } from "react";
import {
  MessageSquare,
  Loader2,
  Save,
  Check,
  AlertTriangle,
  Send,
  ShieldCheck,
  Key,
} from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

interface SmsConfigRow {
  id: string;
  delivery_method: "twilio" | "platform" | null;
  from_number: string | null;
  verified_at: string | null;
  test_sent_to: string | null;
  vault_secret_id: string | null;
  is_active: boolean;
}

interface RecentSend {
  id: string;
  sent_at: string;
  to_number: string;
  from_number: string;
  body: string;
  status: string;
  delivery_method: string;
  purpose: string;
  error_message: string | null;
}

function getSupabaseFunctionsBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url.replace(/\/+$/, "")}/functions/v1` : null;
}

export default function SmsConfigPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdminPlus = ["owner", "admin"].includes(activeCompany?.role ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [row, setRow] = useState<SmsConfigRow | null>(null);
  const [fromNumber, setFromNumber] = useState("");
  const [testTo, setTestTo] = useState("");

  // Credential inputs (write-only)
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");

  const [recentSends, setRecentSends] = useState<RecentSend[]>([]);

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const supabase = createClient();
    const { data: cfgData } = await supabase
      .from("integrations_config")
      .select("id, delivery_method, from_number, verified_at, test_sent_to, vault_secret_id, is_active")
      .eq("company_id", activeCompanyId)
      .eq("provider", "sms")
      .maybeSingle();
    setRow(cfgData as SmsConfigRow | null);
    setFromNumber((cfgData as SmsConfigRow | null)?.from_number ?? "");
    setTwilioFrom((cfgData as SmsConfigRow | null)?.from_number ?? "");

    const { data: sends } = await supabase
      .from("sms_send_log")
      .select("id, sent_at, to_number, from_number, body, status, delivery_method, purpose, error_message")
      .eq("company_id", activeCompanyId)
      .order("sent_at", { ascending: false })
      .limit(20);
    setRecentSends((sends as RecentSend[] | null) ?? []);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!activeCompanyId) return;
    if (!accountSid && !row?.vault_secret_id) {
      toast.error("Twilio Account SID required");
      return;
    }
    setSaving(true);
    try {
      const base = getSupabaseFunctionsBaseUrl();
      if (!base) throw new Error("Functions URL missing");
      const session = (await createClient().auth.getSession()).data.session;
      if (!session) throw new Error("Not signed in");

      // Only call sms-save-credentials if the admin actually entered creds.
      // If the inputs are empty, we just update from_number on the row.
      if (accountSid && authToken && twilioFrom) {
        const res = await fetch(`${base}/sms-save-credentials`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: activeCompanyId,
            twilio: {
              account_sid: accountSid.trim(),
              auth_token: authToken,
              from: twilioFrom.trim(),
            },
            from_number: fromNumber.trim() || undefined,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Save failed");
      } else if (row) {
        // Just update from_number on an existing row.
        const supabase = createClient();
        const { error } = await supabase
          .from("integrations_config")
          .update({ from_number: fromNumber.trim() || null })
          .eq("company_id", activeCompanyId)
          .eq("provider", "sms");
        if (error) throw error;
      }

      toast.success("Saved. Run a test send to verify.");
      setAccountSid("");
      setAuthToken("");
      setTwilioFrom("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!activeCompanyId || !testTo.trim()) {
      toast.error("Enter a test recipient (E.164)");
      return;
    }
    if (!/^\+\d{6,15}$/.test(testTo.trim())) {
      toast.error("Recipient must be E.164 (+15555550100)");
      return;
    }
    setTesting(true);
    try {
      const base = getSupabaseFunctionsBaseUrl();
      if (!base) throw new Error("Functions URL missing");
      const session = (await createClient().auth.getSession()).data.session;
      if (!session) throw new Error("Not signed in");
      const res = await fetch(`${base}/sms-test-send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company_id: activeCompanyId, to: testTo.trim() }),
      });
      const result = await res.json();
      if (!res.ok || result.ok === false) {
        throw new Error(result.error || "Test send failed");
      }
      toast.success(`Test SMS sent via ${result.delivery_method}`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Test failed";
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  if (!isAdminPlus) {
    return (
      <PageShell title="SMS SENDING" subtitle="Access restricted" icon={<MessageSquare className="h-5 w-5" />}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">Owner or admin role required</p>
        </div>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell title="SMS SENDING" subtitle="Loading..." icon={<MessageSquare className="h-5 w-5" />}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  const credsLinked = !!row?.vault_secret_id;
  const verified = !!row?.verified_at;

  return (
    <PageShell
      title="SMS SENDING"
      subtitle="Per-company Twilio configuration for reporter replies and outbound SMS"
      icon={<MessageSquare className="h-5 w-5" />}
    >
      <div className="space-y-4 max-w-3xl">
        {/* Status banner */}
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={
                  verified
                    ? "bg-green-500/10 text-green-700 border-green-500/30"
                    : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                }
              >
                {verified ? <Check className="h-3 w-3 mr-1 inline" /> : <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                {verified ? "Verified" : "Not verified"}
              </Badge>
              <Badge
                variant="outline"
                className={credsLinked ? "bg-green-500/10 text-green-700 border-green-500/30" : "bg-muted"}
              >
                <Key className="h-3 w-3 mr-1 inline" /> {credsLinked ? "Credentials saved" : "No credentials"}
              </Badge>
              {row?.delivery_method && (
                <Badge variant="outline">
                  Method: {row.delivery_method}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Until a successful test send stamps {`'verified_at'`}, outbound SMS uses the platform Twilio number
              (shared sender). Configure your own Twilio account below for branded SMS from your own number.
            </p>
          </CardContent>
        </Card>

        {/* Credentials form */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Twilio Credentials
            </h2>
            <p className="text-xs text-muted-foreground">
              Saved credentials are encrypted in Supabase Vault and never returned to the client.
            </p>

            <div>
              <Label htmlFor="sms-account-sid" className="text-xs">
                Account SID
              </Label>
              <Input
                id="sms-account-sid"
                placeholder={credsLinked ? "•••••••••••••••••••• (replace to update)" : "AC..."}
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="sms-auth-token" className="text-xs">
                Auth Token
              </Label>
              <Input
                id="sms-auth-token"
                type="password"
                placeholder={credsLinked ? "•••••••••••••••••••• (replace to update)" : ""}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="sms-twilio-from" className="text-xs">
                Twilio Sender (E.164 or MG... messaging-service SID)
              </Label>
              <Input
                id="sms-twilio-from"
                placeholder="+15555550100 or MG..."
                value={twilioFrom}
                onChange={(e) => setTwilioFrom(e.target.value)}
              />
            </div>

            <div className="border-t pt-3">
              <Label htmlFor="sms-from-number" className="text-xs">
                Display Sender (optional override)
              </Label>
              <Input
                id="sms-from-number"
                placeholder="Defaults to Twilio sender above"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save credentials
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test send */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Test Send
            </h2>
            <p className="text-xs text-muted-foreground">
              Sends a one-line verification message. On success, stamps {`'verified_at'`} so outbound SMS will use
              your Twilio account from now on.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="+15555550100"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                className="flex-1"
                aria-label="Test recipient phone"
              />
              <Button onClick={handleTest} disabled={testing || !testTo.trim()} className="gap-2">
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send test
              </Button>
            </div>
            {row?.test_sent_to && (
              <p className="text-[11px] text-muted-foreground">
                Last test send: {row.test_sent_to}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent sends */}
        <Card>
          <CardContent className="pt-6 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Sends
            </h2>
            {recentSends.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">No SMS sent yet.</p>
            ) : (
              <div className="space-y-1.5">
                {recentSends.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 text-xs rounded-md border bg-card p-2"
                  >
                    <Badge
                      variant="outline"
                      className={
                        s.status === "sent"
                          ? "text-[10px] bg-green-500/10 text-green-700 border-green-500/30"
                          : "text-[10px] bg-red-500/10 text-red-700 border-red-500/30"
                      }
                    >
                      {s.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px]">{s.to_number}</div>
                      <div className="text-muted-foreground truncate">{s.body}</div>
                      {s.error_message && (
                        <div className="text-red-600 text-[11px] mt-0.5">{s.error_message}</div>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground text-right">
                      <div>{new Date(s.sent_at).toLocaleString()}</div>
                      <div>{s.purpose}</div>
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
