"use client";

import { useEffect, useState } from "react";
import { BellMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMyMutes, setMyMutes, MUTE_OPTIONS, type MuteKey } from "@/lib/supabase/db-notification-mutes";

/** Officer-controlled mutes for phone/email alerts, per type. */
export function AlertMutesCard() {
  const [mutes, setMutes] = useState<MuteKey[] | null>(null);
  const [saving, setSaving] = useState<MuteKey | null>(null);
  useEffect(() => { getMyMutes().then(setMutes).catch(() => setMutes([])); }, []);

  async function toggle(key: MuteKey) {
    if (!mutes) return;
    const next = mutes.includes(key) ? mutes.filter((m) => m !== key) : [...mutes, key];
    setSaving(key);
    const prev = mutes;
    setMutes(next);
    try { await setMyMutes(next); }
    catch { setMutes(prev); toast.error("Couldn't save. Try again."); }
    finally { setSaving(null); }
  }

  if (!mutes) return null;
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4" data-testid="alert-mutes-card">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BellMinus className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Alert types</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Choose which alerts reach your phone and email. Muted ones still show here in the app. SOS and overdue-patrol alerts are always on.</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-border/40">
        {MUTE_OPTIONS.map((o) => {
          const on = !mutes.includes(o.key);
          return (
            <li key={o.key} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <span className="text-sm">{o.label}</span>
              <button type="button" role="switch" aria-checked={on} aria-label={`${o.label} alerts`} onClick={() => toggle(o.key)} disabled={saving !== null}
                data-testid={`mute-${o.key}`}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${on ? "bg-green-500" : "bg-muted"}`}>
                {saving === o.key ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
