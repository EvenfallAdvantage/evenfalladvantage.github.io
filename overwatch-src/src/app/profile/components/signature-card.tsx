"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, PenLine, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { deleteMySignature, getMySignature, saveMySignature } from "@/lib/signature/signature";

/** Profile → My Signature: draw, save, replace or delete the officer's saved signature. */
export function SignatureCard() {
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);

  useEffect(() => { getMySignature().then(setSaved).catch(() => setSaved(null)).finally(() => setLoading(false)); }, []);

  async function save() {
    const url = pad.current?.toDataUrl();
    if (!url) return;
    setBusy(true);
    const r = await saveMySignature(url);
    setBusy(false);
    if (!r.ok) { toast.error("Couldn't save your signature. Try again."); return; }
    setSaved(url); setEditing(false); toast.success("Signature saved");
  }
  async function remove() {
    setBusy(true);
    const r = await deleteMySignature();
    setBusy(false);
    if (!r.ok) { toast.error("Couldn't delete your signature."); return; }
    setSaved(null); toast.success("Signature deleted");
  }

  return (
    <Card data-testid="signature-card">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><PenLine className="h-4 w-4" /> My Signature</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Used to pre-fill your Shift Notes at clock-out. You still confirm every time. Past Shift Notes keep the signature they were signed with.</p>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
        ) : editing || !saved ? (
          <>
            <SignaturePad ref={pad} onChange={setEmpty} />
            <div className="flex flex-wrap gap-2">
              <Button className="h-11" disabled={empty || busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save signature"}</Button>
              {saved && <Button variant="ghost" className="h-11" onClick={() => setEditing(false)}>Cancel</Button>}
            </div>
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
            <img src={saved} alt="Your saved signature" className="h-24 w-full rounded-md border border-input bg-white object-contain" data-testid="saved-signature" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11" onClick={() => setEditing(true)}>Replace</Button>
              <Button variant="ghost" className="h-11 text-red-500" disabled={busy} onClick={remove}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
