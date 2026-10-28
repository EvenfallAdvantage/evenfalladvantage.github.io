"use client";

/**
 * "Imagery by date" for one site: the last 90 days of NASA HLS passes
 * (Landsat 8/9 + Sentinel-2, 30 m) over a 12 km box, from NASA CMR. Picking a
 * day draws that day's GIBS tiles inside the box (see use-site-imagery.ts).
 * Key it by target so a new site remounts.
 */
import { useEffect, useState } from "react";
import { CalendarDays, Loader2, X } from "lucide-react";
import { logger } from "@/lib/logger";
import {
  HLS_PRODUCTS, SITE_IMAGERY_DAYS, cloudLabel, cmrUrl, imageryDays, parseCmr, pickDefaultDay, siteBox,
  type HlsProduct, type ImageryDay, type SiteBox,
} from "@/lib/map/site-imagery";

export interface SiteImagerySelection { day: string; product: HlsProduct; box: SiteBox; label: string; lat: number; lng: number }

const fmtDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function SiteImageryPanel({ target, selected, onSelect, onClose }: {
  target: { label: string; lat: number; lng: number };
  selected: SiteImagerySelection | null;
  onSelect: (s: SiteImagerySelection) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ok"; days: ImageryDay[] } | { status: "error" } | { status: "unsupported" }>({ status: "loading" });
  const [clearOnly, setClearOnly] = useState(false);

  useEffect(() => {
    const box = siteBox(target.lat, target.lng);
    if (!box) { setState({ status: "unsupported" }); return; }
    const ctrl = new AbortController();
    const products: HlsProduct[] = ["S30", "L30"];
    Promise.allSettled(products.map((p) =>
      fetch(cmrUrl(p, box), { signal: ctrl.signal })
        .then((r) => { if (!r.ok) throw new Error(`CMR ${r.status}`); return r.json(); })
        .then((j) => parseCmr(j, p)),
    )).then((settled) => {
      if (ctrl.signal.aborted) return;
      const ok = settled.filter((s): s is PromiseFulfilledResult<ReturnType<typeof parseCmr>> => s.status === "fulfilled");
      if (!ok.length) { setState({ status: "error" }); return; }
      const days = imageryDays(ok.flatMap((s) => s.value));
      setState({ status: "ok", days });
      const first = pickDefaultDay(days);
      if (first) onSelect({ day: first.day, product: first.product, box, ...target });
    }).catch((err) => { logger.swallow("site-imagery:cmr", err, "warn"); if (!ctrl.signal.aborted) setState({ status: "error" }); });
    return () => ctrl.abort();
    // onSelect is a state setter from the parent; target is the remount key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.lat, target.lng]);

  const box = siteBox(target.lat, target.lng);
  const rows = state.status === "ok" ? state.days.filter((d) => !clearOnly || (d.cloud !== null && d.cloud <= 20)) : [];

  return (
    <div className="relative z-30 w-72 max-w-full rounded-lg border border-white/10 bg-black/75 backdrop-blur-md text-white/90 shadow-lg pointer-events-auto" data-testid="site-imagery">
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-white/10">
        <CalendarDays className="h-4 w-4 text-emerald-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate">Imagery by date · {target.label}</div>
          <div className="text-[10px] text-white/45">NASA HLS 30 m · last {SITE_IMAGERY_DAYS} days · dates UTC</div>
        </div>
        <button onClick={onClose} aria-label="Close imagery by date" className="text-white/50 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex gap-1 px-2.5 pt-1.5 text-[10px] font-mono">
        {([false, true] as const).map((c) => (
          <button key={String(c)} onClick={() => setClearOnly(c)}
            className={`px-2 py-0.5 rounded-full ${clearOnly === c ? "bg-emerald-500/25 text-emerald-100" : "bg-white/5 text-white/55 hover:bg-white/10"}`}>
            {c ? "Clear (≤20%)" : "All passes"}
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto py-1 text-[11px] font-mono">
        {state.status === "loading" && <div className="flex items-center gap-2 px-2.5 py-2 text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" />Searching NASA catalog…</div>}
        {state.status === "error" && <div className="px-2.5 py-2 text-white/50">NASA catalog unavailable — try again later.</div>}
        {state.status === "unsupported" && <div className="px-2.5 py-2 text-white/50">No HLS coverage this close to the poles.</div>}
        {state.status === "ok" && rows.length === 0 && <div className="px-2.5 py-2 text-white/50">No {clearOnly ? "clear " : ""}passes in the last {SITE_IMAGERY_DAYS} days.</div>}
        {box && rows.map((d) => {
          const active = selected?.day === d.day;
          return (
            <button key={d.day} onClick={() => onSelect({ day: d.day, product: d.product, box, ...target })}
              aria-pressed={active}
              className={`w-full flex items-center gap-2 px-2.5 py-1 text-left ${active ? "bg-emerald-500/20 text-emerald-50" : "hover:bg-white/5"}`}>
              <span className="w-24 text-white/85">{fmtDay(d.day)}</span>
              <span className="flex-1 truncate text-white/60">{d.products.map((p) => HLS_PRODUCTS[p].label).join(" + ")}</span>
              <span className={`w-16 text-right ${d.cloud !== null && d.cloud <= 20 ? "text-emerald-200" : "text-white/45"}`}>{cloudLabel(d.cloud)}</span>
            </button>
          );
        })}
      </div>
      <div className="px-2.5 py-1 text-[9px] text-white/35 border-t border-white/10">
        NASA GIBS / CMR · HLS (Landsat 8/9, Sentinel-2) · public domain. Cloud % is for the whole scene, not just this site.
      </div>
    </div>
  );
}
