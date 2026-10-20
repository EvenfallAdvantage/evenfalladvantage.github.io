"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Navigation, ScrollText, CheckCircle2, AlertTriangle, Loader2, Map as MapIcon, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPostShifts, getPostOrderAckStatus, ackPostOrders, type AckStatus } from "@/lib/supabase/db";
import { getSignedFileUrl } from "@/lib/supabase/db-helpers";
import { parseUTC } from "@/lib/parse-utc";
import { pickMyPost, hasPostOrders, startsIn, directionsUrl } from "@/lib/post/my-post";

/**
 * "My Post": everything an officer needs for the shift that's on now (or next):
 * where, when, role, directions, site map and the post orders, with a
 * read-and-acknowledge step that goes stale if the orders are edited.
 */
export function MyPostCard({ activeCompanyId }: { activeCompanyId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [post, setPost] = useState<{ shift: any; state: "on_now" | "upcoming" } | null | undefined>(undefined);
  const [ack, setAck] = useState<AckStatus | null | undefined>(undefined);
  const [ackSupported, setAckSupported] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const shifts = await getMyPostShifts(activeCompanyId);
    const p = pickMyPost(shifts);
    setPost(p);
    if (p) {
      const m = await getPostOrderAckStatus([p.shift.id]);
      if (m === null) { setAckSupported(false); setAck(null); } else setAck(m.get(p.shift.id) ?? null);
    }
  }, [activeCompanyId]);
  useEffect(() => { void load(); }, [load]);

  if (!post) return null;
  const { shift: s, state } = post;
  const e = s.events ?? {};
  const orders = [e.post_orders?.trim(), s.post_orders?.trim()].filter(Boolean) as string[];
  const needsAck = ackSupported && hasPostOrders(s) && !(ack && ack.is_current);
  const stale = !!ack && !ack.is_current;
  const dir = directionsUrl(e);
  const fmt = (iso: string) => parseUTC(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  async function acknowledge() {
    setBusy(true);
    try { await ackPostOrders(s.id); toast.success("Post orders acknowledged"); await load(); setOpen(false); }
    catch { toast.error("Couldn't record the acknowledgement. Try again."); }
    finally { setBusy(false); }
  }
  async function openSiteMap() {
    try { window.open(await getSignedFileUrl(e.site_map_url), "_blank"); } catch { toast.error("Couldn't open the site map"); }
  }

  return (
    <Card className={`overflow-hidden ${needsAck ? "border-amber-500/50" : "border-emerald-500/30"}`} data-testid="my-post">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${state === "on_now" ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"}`}><Shield className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Post</h3>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${state === "on_now" ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"}`}>{state === "on_now" ? "ON NOW" : startsIn(s)}</span>
            </div>
            <p className="truncate text-lg font-bold leading-tight">{s.role || "Shift"}</p>
            <p className="truncate text-sm text-muted-foreground">{e.name}</p>
            <p className="text-xs text-muted-foreground">{parseUTC(s.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {fmt(s.start_time)} to {fmt(s.end_time)}</p>
            {e.location && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{e.location}</span></p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {dir && <a href={dir} target="_blank" rel="noreferrer" style={{ minHeight: 44 }} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium"><Navigation className="h-4 w-4" />Directions</a>}
          {e.site_map_url && <button type="button" onClick={openSiteMap} style={{ minHeight: 44 }} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium"><MapIcon className="h-4 w-4" />Site map</button>}
        </div>

        {orders.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-muted/20">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ minHeight: 48 }} className="flex w-full items-center gap-2 px-3 text-left">
              <ScrollText className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-sm font-semibold">Post orders</span>
              {ack?.is_current ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400" data-testid="ack-state"><CheckCircle2 className="h-3.5 w-3.5" />Acknowledged {new Date(ack.acked_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                : needsAck ? <span className="inline-flex items-center gap-1 text-[11px] text-amber-400" data-testid="ack-state"><AlertTriangle className="h-3.5 w-3.5" />{stale ? "Updated: re-read" : "Read and acknowledge"}</span> : null}
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {open && (
              <div className="space-y-3 border-t border-border/50 px-3 py-3" data-testid="post-orders">
                {stale && <p className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">These orders changed after you acknowledged them on {new Date(ack!.acked_at).toLocaleString()}.</p>}
                {orders.map((o, i) => (
                  <div key={i}>
                    {orders.length > 1 && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{i === 0 && e.post_orders?.trim() ? "Operation" : "This post"}</p>}
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{o}</p>
                  </div>
                ))}
                {needsAck && (
                  <button type="button" onClick={acknowledge} disabled={busy} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white disabled:opacity-60">
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}I&apos;ve read and understand these orders
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
