"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getCompanySettings, updateCompanySettings } from "@/lib/supabase/db-users";
import { REQUIRE_MFA_ADMINS_KEY, hasVerifiedTotp } from "@/lib/security/mfa";

/** Admin → Security: "Require 2FA for owners and admins" (companies.settings). */
export function MfaPolicy({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getCompanySettings(companyId).then((s) => setOn(!!s[REQUIRE_MFA_ADMINS_KEY])).catch(() => setOn(false)); }, [companyId]);

  async function toggle(next: boolean) {
    if (next && !(await hasVerifiedTotp())) { toast.error("Turn on 2FA for your own account first (Profile → Two-factor authentication)."); return; }
    setBusy(true);
    try { await updateCompanySettings(companyId, { [REQUIRE_MFA_ADMINS_KEY]: next }); setOn(next); toast.success(next ? "2FA is now required for owners and admins" : "2FA is now optional"); }
    catch { toast.error("Couldn't save. Only owners and admins can change this."); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Require 2FA for owners and admins</h3>
        <p className="mt-1 text-sm text-muted-foreground">Owners and admins without an authenticator app are asked to set one up before they can continue. Officers can turn it on for themselves in Profile.</p>
      </div>
      <Switch aria-label="Require 2FA for owners and admins" checked={!!on} disabled={on === null || busy || !canEdit} onCheckedChange={toggle} />
    </div>
  );
}
