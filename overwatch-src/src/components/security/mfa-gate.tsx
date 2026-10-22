"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useActiveCompany } from "@/stores/auth-store";
import { getCompanySettings } from "@/lib/supabase/db-users";
import { cleanCode, getMfaState, hasVerifiedTotp, listTotpFactors, mfaRequiredFor, verifyTotp } from "@/lib/security/mfa";
import { TotpSetup } from "./totp-setup";

type GateState = "checking" | "ok" | "challenge" | "enroll";

/**
 * Inside AuthGuard. (1) If the account has 2FA and this session hasn't passed
 * it (AAL1 → AAL2), ask for the code. (2) If the active company requires 2FA
 * for owners/admins and this admin has none, require setup first.
 * Client-side gate; see docs/security/MFA.md for server-side enforcement.
 */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const company = useActiveCompany();
  const [state, setState] = useState<GateState>("checking");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ((await getMfaState()) === "challenge") { if (!cancelled) setState("challenge"); return; }
        if (company && (company.role === "owner" || company.role === "admin")) {
          const settings = await getCompanySettings(company.companyId).catch(() => ({}));
          if (mfaRequiredFor(company.role, settings) && !(await hasVerifiedTotp())) { if (!cancelled) setState("enroll"); return; }
        }
        if (!cancelled) setState("ok");
      } catch { if (!cancelled) setState("ok"); }
    })();
    return () => { cancelled = true; };
  }, [company]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true); setError("");
    try {
      const f = (await listTotpFactors()).find((x) => x.status === "verified");
      if (!f) { setState("ok"); return; }
      await verifyTotp(f.id, code, "login");
      setState("ok");
    } catch { setError("That code didn't match. Try the newest code from your app."); }
    finally { setBusy(false); }
  }

  async function signOut() { await createClient().auth.signOut(); window.location.href = `${window.location.origin}/overwatch/?auth=login`; }

  if (state === "ok") return <>{children}</>;
  if (state === "checking") return <div className="min-h-screen bg-background" />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg space-y-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> {state === "challenge" ? "Enter your 2FA code" : "Set up two-factor authentication"}</h1>
        {state === "challenge" ? (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-muted-foreground">Open your authenticator app and enter the 6-digit code for Overwatch.</p>
            <label htmlFor="mfa-gate-code" className="sr-only">6-digit code</label>
            <Input id="mfa-gate-code" autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(cleanCode(e.target.value))} placeholder="123456" className="tracking-widest" />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify</Button>
          </form>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{company?.companyName ?? "Your company"} requires two-factor authentication for owners and admins.</p>
            <TotpSetup onDone={() => setState("ok")} />
          </>
        )}
        <button type="button" onClick={signOut} className="text-sm text-muted-foreground underline underline-offset-2 min-h-[24px]">Sign out</button>
      </div>
    </main>
  );
}
