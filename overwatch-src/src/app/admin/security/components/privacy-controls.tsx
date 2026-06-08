"use client";

/**
 * Privacy controls for admin/security — GDPR Articles 15/20 (export) and
 * 17 (delete). Self-service for any authenticated user; admin actions
 * (export/delete other members) are owner-only.
 */

import { useState } from "react";
import { Download, Trash2, Loader2, ShieldAlert, FileJson } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

function getSupabaseFunctionsBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url.replace(/\/+$/, "")}/functions/v1` : null;
}

export function PrivacyControls() {
  const { user, activeCompanyId, getActiveCompany } = useAuthStore();
  const activeCompany = getActiveCompany();
  const isOwner = activeCompany?.role === "owner";
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [selfExporting, setSelfExporting] = useState(false);
  const [selfDeleting, setSelfDeleting] = useState(false);
  const [adminTargetId, setAdminTargetId] = useState("");
  const [adminConfirmEmail, setAdminConfirmEmail] = useState("");
  const [adminExporting, setAdminExporting] = useState(false);
  const [adminDeleting, setAdminDeleting] = useState(false);
  const [confirmSelfEmail, setConfirmSelfEmail] = useState("");

  async function callFunction(name: "data-export" | "data-delete", body: Record<string, unknown>) {
    const base = getSupabaseFunctionsBaseUrl();
    if (!base) throw new Error("Supabase URL missing");
    const session = (await createClient().auth.getSession()).data.session;
    if (!session) throw new Error("Not signed in");
    const res = await fetch(`${base}/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const errMsg = (parsed as { error?: string })?.error ?? `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return parsed;
  }

  function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSelfExport() {
    if (!user) return;
    setSelfExporting(true);
    try {
      const bundle = await callFunction("data-export", {
        subject_user_id: user.id,
        company_id: activeCompanyId ?? undefined,
      });
      const ts = new Date().toISOString().slice(0, 10);
      downloadJson(`overwatch-data-export-${ts}.json`, bundle);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setSelfExporting(false);
    }
  }

  async function handleSelfDelete() {
    if (!user) return;
    if (!confirmSelfEmail.trim()) {
      toast.error("Type your email to confirm");
      return;
    }
    const ok = await confirm({
      description:
        "This will anonymize your personal data and remove you from the active roster. You will lose access immediately. This action cannot be undone.",
      variant: "destructive",
      confirmLabel: "Delete my data",
    });
    if (!ok) return;
    setSelfDeleting(true);
    try {
      await callFunction("data-delete", {
        subject_user_id: user.id,
        company_id: activeCompanyId ?? undefined,
        confirm_email: confirmSelfEmail.trim(),
      });
      toast.success("Your data has been redacted. Signing out...");
      await createClient().auth.signOut();
      window.location.href = "/login";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSelfDeleting(false);
    }
  }

  async function handleAdminExport() {
    if (!adminTargetId.trim()) {
      toast.error("Subject user ID required");
      return;
    }
    setAdminExporting(true);
    try {
      const bundle = await callFunction("data-export", {
        subject_user_id: adminTargetId.trim(),
        company_id: activeCompanyId ?? undefined,
      });
      const ts = new Date().toISOString().slice(0, 10);
      downloadJson(`overwatch-export-${adminTargetId.slice(0, 8)}-${ts}.json`, bundle);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setAdminExporting(false);
    }
  }

  async function handleAdminDelete() {
    if (!adminTargetId.trim() || !adminConfirmEmail.trim()) {
      toast.error("Subject user ID and confirmation email required");
      return;
    }
    const ok = await confirm({
      description: `Anonymize PII for user ${adminTargetId.slice(0, 8)}... and remove from this company? They will lose access immediately.`,
      variant: "destructive",
      confirmLabel: "Delete member data",
    });
    if (!ok) return;
    setAdminDeleting(true);
    try {
      await callFunction("data-delete", {
        subject_user_id: adminTargetId.trim(),
        company_id: activeCompanyId ?? undefined,
        confirm_email: adminConfirmEmail.trim(),
      });
      toast.success("Member data anonymized");
      setAdminTargetId("");
      setAdminConfirmEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setAdminDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold">My Data (GDPR Articles 15 / 20)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Download a JSON archive of all your personal data across timesheets, incidents,
            tasks, audit log entries, and related records. Self-service; no admin approval
            needed.
          </p>
          <div className="flex justify-end">
            <Button onClick={handleSelfExport} disabled={selfExporting} className="gap-2">
              {selfExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export my data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-500/30">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold text-red-600">Erase My Data (GDPR Article 17)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Permanently anonymize your name, email, phone, and avatar; redact your comments
            on incidents and tasks; remove badges; and revoke your active company
            memberships. <strong>This cannot be undone.</strong>
          </p>
          <div>
            <Label htmlFor="confirm-self-email" className="text-xs">
              Type your email address to confirm
            </Label>
            <Input
              id="confirm-self-email"
              type="email"
              placeholder={user?.email ?? ""}
              value={confirmSelfEmail}
              onChange={(e) => setConfirmSelfEmail(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={handleSelfDelete}
              disabled={selfDeleting || !confirmSelfEmail.trim()}
              className="gap-2"
            >
              {selfDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Erase my data
            </Button>
          </div>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-amber-500/30">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-amber-700">Subject Access / Erasure (Owner only)</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Respond to a member&apos;s data subject access request (DSAR) or
              right-to-be-forgotten request. The member&apos;s user ID is shown in their
              profile URL. All actions are audited.
            </p>
            <div>
              <Label htmlFor="admin-target" className="text-xs">Subject user ID</Label>
              <Input
                id="admin-target"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={adminTargetId}
                onChange={(e) => setAdminTargetId(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleAdminExport}
                disabled={adminExporting || !adminTargetId.trim()}
                className="gap-2"
              >
                {adminExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export member data
              </Button>
            </div>
            <div className="pt-2 border-t">
              <Label htmlFor="admin-confirm" className="text-xs">
                Member&apos;s email (for erasure confirmation)
              </Label>
              <Input
                id="admin-confirm"
                type="email"
                placeholder="member@example.com"
                value={adminConfirmEmail}
                onChange={(e) => setAdminConfirmEmail(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={handleAdminDelete}
                disabled={adminDeleting || !adminTargetId.trim() || !adminConfirmEmail.trim()}
                className="gap-2"
              >
                {adminDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Erase member data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog />
    </div>
  );
}
