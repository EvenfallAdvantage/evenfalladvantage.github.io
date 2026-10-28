"use client";

/**
 * Map search: coordinates jump instantly (decimal, DMS, geo: URIs); place
 * names search on Enter via Photon → Nominatim (throttled, cached, credited).
 */
import { useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Satellite, Search, X } from "lucide-react";
import { parseCoordinateQuery } from "@/lib/map/coordinate-parser";
import { GEOCODE_CREDIT, sharedGeocoder, type PlaceResult } from "@/lib/map/geocode";

export function MapSearch({ onPick, onPasses, onClose }: {
  onPick: (place: PlaceResult) => void;
  onPasses: (target: { label: string; lat: number; lng: number }) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<PlaceResult | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const coord = useMemo(() => {
    const c = parseCoordinateQuery(q);
    return c ? ({ label: c.label, detail: "Coordinates", lat: c.lat, lng: c.lon, source: "coordinates" } as PlaceResult) : null;
  }, [q]);

  const pick = (p: PlaceResult) => { setPicked(p); onPick(p); };

  const submit = async () => {
    if (coord) { pick(coord); return; }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true); setMsg(null); setResults([]);
    try {
      const { results: r, error } = await sharedGeocoder().search(q, c.signal);
      if (c.signal.aborted) return;
      setResults(r);
      setMsg(error ?? (r.length ? null : "No places found"));
      if (r.length) pick(r[0]);
    } catch {
      if (!c.signal.aborted) setMsg("Place search unavailable");
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  };

  const list = coord ? [coord] : results;

  return (
    <div className="relative z-30 w-72 max-w-full rounded-lg border border-white/10 bg-black/75 backdrop-blur-md text-white/90 shadow-lg pointer-events-auto" data-testid="map-search">
      <form className="flex items-center gap-2 px-2.5 py-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/50" /> : <Search className="h-4 w-4 shrink-0 text-white/50" />}
        <input
          autoFocus value={q} onChange={(e) => { setQ(e.target.value); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          placeholder="Place, address or lat, lng" aria-label="Search the map"
          className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-white/35"
        />
        <button type="button" onClick={onClose} aria-label="Close search" className="text-white/50 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </form>
      {(list.length > 0 || msg) && (
        <div className="border-t border-white/10 max-h-64 overflow-y-auto">
          {list.map((p, i) => (
            <div key={`${p.source}-${i}`} className={`flex items-start gap-2 px-2.5 py-1.5 text-[11px] ${picked === p ? "bg-white/10" : "hover:bg-white/5"}`}>
              <button className="flex-1 min-w-0 text-left flex gap-2" onClick={() => pick(p)}>
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-300" />
                <span className="min-w-0">
                  <span className="block truncate">{coord ? `Go to ${p.label}` : p.label}</span>
                  {p.detail && <span className="block truncate text-white/45">{p.detail}</span>}
                </span>
              </button>
              <button onClick={() => onPasses({ label: p.label, lat: p.lat, lng: p.lng })} title="Satellite passes over this place (next 24 h)"
                className="shrink-0 text-white/50 hover:text-cyan-200"><Satellite className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {msg && <div className="px-2.5 py-1.5 text-[11px] text-white/50">{msg}</div>}
        </div>
      )}
      {!coord && <div className="px-2.5 py-1 text-[9px] text-white/35 border-t border-white/10">Press Enter to search · {GEOCODE_CREDIT}</div>}
    </div>
  );
}
