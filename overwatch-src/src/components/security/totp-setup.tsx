"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanCode, startTotpEnroll, verifyTotp } from "@/lib/security/mfa";

/** QR + code entry to add an authenticator app. Calls onDone after the first code verifies. */
export function TotpSetup({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [enroll, setEnroll] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    startTotpEnroll().then(setEnroll).catch((e) => setError(e instanceof Error ? e.message : "Couldn't start setup"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll || code.length !== 6) return;
    setBusy(true); setError("");
    try { await verifyTotp(enroll.factorId, code, "enroll"); onDone(); }
    catch { setError("That code didn't match. Check the time on your phone and try the newest code."); }
    finally { setBusy(false); }
  }

  if (!enroll) return <div className="flex items-center gap-2 text-sm text-muted-foreground">{error || <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>}</div>;

  return (
    <form onSubmit={submit} className="space-y-3">
      <ol className="list-decimal pl-5 text-sm space-y-1">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
        <li>Scan this code, or enter the setup key by hand.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      <div className="flex flex-wrap items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URL from Supabase */}
        <img src={enroll.qrCode} alt="QR code for your authenticator app" width={160} height={160} className="rounded-md bg-white p-2" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">Setup key</p>
          <code className="block break-all rounded bg-muted px-2 py-1 text-xs select-all">{enroll.secret}</code>
        </div>
      </div>
      <div>
        <label htmlFor="totp-setup-code" className="text-sm font-medium">6-digit code</label>
        <Input id="totp-setup-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(cleanCode(e.target.value))} placeholder="123456" className="mt-1 max-w-[10rem] tracking-widest" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || code.length !== 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Turn on 2FA</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
