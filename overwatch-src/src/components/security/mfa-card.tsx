"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listTotpFactors, removeTotp, type TotpFactor } from "@/lib/security/mfa";
import { TotpSetup } from "./totp-setup";

/** Profile → Two-factor authentication (TOTP). */
export function MfaCard({ required = false }: { required?: boolean }) {
  const [factors, setFactors] = useState<TotpFactor[] | null>(null);
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => { listTotpFactors().then(setFactors).catch(() => setFactors([])); }, []);
  useEffect(load, [load]);
  const verified = (factors ?? []).filter((f) => f.status === "verified");

  async function remove(id: string) {
    if (required && verified.length <= 1) { toast.error("Your company requires 2FA for admins. Add another authenticator before removing this one."); return; }
    if (!window.confirm("Remove this authenticator? You'll sign in with just your password.")) return;
    setBusy(id);
    try { await removeTotp(id); toast.success("Authenticator removed"); load(); }
    catch { toast.error("Couldn't remove it. Sign out and back in with your code, then try again."); }
    finally { setBusy(null); }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Two-factor authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {factors === null ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" /> : (
          <>
            <p className="text-sm text-muted-foreground">
              {verified.length ? "On. You'll enter a code from your authenticator app when you sign in." : "Off. Add a code from an authenticator app at sign-in for stronger account protection."}
              {required && " Your company requires this for admins."}
            </p>
            {verified.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm">
                <span>{f.friendlyName || "Authenticator app"}</span>
                <Button size="sm" variant="ghost" onClick={() => remove(f.id)} disabled={busy === f.id} aria-label={`Remove ${f.friendlyName || "authenticator"}`}>
                  {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
            {setup ? <TotpSetup onDone={() => { setSetup(false); toast.success("Two-factor authentication is on"); load(); }} onCancel={() => setSetup(false)} />
              : <Button size="sm" variant={verified.length ? "outline" : "default"} onClick={() => setSetup(true)}>{verified.length ? "Add another authenticator" : "Set up 2FA"}</Button>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
