"use client";

/**
 * Lightweight 2D map for drawing a geofence polygon: tap to add corners,
 * drag to pan, +/- to zoom. Plain OpenStreetMap raster tiles (no SDK, no key).
 * Emits GeoJSON-style [lng, lat] rings (open; the caller closes them).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Undo2, Trash2, LocateFixed } from "lucide-react";
import { lngLatToWorld, worldToLngLat, TILE } from "@/lib/geo/mercator";

export interface PolygonDrawMapProps {
  value: Array<[number, number]>; // [lng, lat]
  onChange: (pts: Array<[number, number]>) => void;
  initialCenter?: { lat: number; lng: number };
  height?: number;
}

export function PolygonDrawMap({ value, onChange, initialCenter, height = 320 }: PolygonDrawMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: height });
  const first = value[0];
  const [view, setView] = useState(() => ({
    lat: first ? first[1] : initialCenter?.lat ?? 39.5,
    lng: first ? first[0] : initialCenter?.lng ?? -98.35,
    z: first || initialCenter ? 17 : 4,
  }));
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const center = useMemo(() => lngLatToWorld(view.lng, view.lat, view.z), [view]);
  const toScreen = useCallback((lng: number, lat: number) => {
    const p = lngLatToWorld(lng, lat, view.z);
    return { x: p.x - center.x + size.w / 2, y: p.y - center.y + size.h / 2 };
  }, [center, size, view.z]);

  const tiles = useMemo(() => {
    const out: { key: string; x: number; y: number; url: string }[] = [];
    const n = 2 ** view.z;
    const x0 = Math.floor((center.x - size.w / 2) / TILE), x1 = Math.floor((center.x + size.w / 2) / TILE);
    const y0 = Math.floor((center.y - size.h / 2) / TILE), y1 = Math.floor((center.y + size.h / 2) / TILE);
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      out.push({ key: `${view.z}/${tx}/${ty}`, x: tx * TILE - center.x + size.w / 2, y: ty * TILE - center.y + size.h / 2, url: `https://tile.openstreetmap.org/${view.z}/${wx}/${ty}.png` });
    }
    return out;
  }, [center, size, view.z]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    const ll = worldToLngLat(d.cx - dx, d.cy - dy, view.z);
    setView((v) => ({ ...v, lat: ll.lat, lng: ll.lng }));
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current; drag.current = null;
    if (!d || d.moved) return;
    const r = ref.current!.getBoundingClientRect();
    const ll = worldToLngLat(center.x + (e.clientX - r.left - size.w / 2), center.y + (e.clientY - r.top - size.h / 2), view.z);
    onChange([...value, [round6(ll.lng), round6(ll.lat)]]);
  }
  const zoom = (dz: number) => setView((v) => ({ ...v, z: Math.max(2, Math.min(19, v.z + dz)) }));
  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => setView({ lat: p.coords.latitude, lng: p.coords.longitude, z: 17 }), () => {}, { enableHighAccuracy: true, timeout: 8000 });
  }

  const pts = value.map(([lng, lat]) => toScreen(lng, lat));
  return (
    <div className="space-y-2">
      <div ref={ref} className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-border bg-[#aad3df]" style={{ height }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} data-testid="polygon-draw-map"
        onWheel={(e) => zoom(e.deltaY < 0 ? 1 : -1)}>
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.key} src={t.url} alt="" draggable={false} className="pointer-events-none absolute" style={{ left: t.x, top: t.y, width: TILE, height: TILE }} />
        ))}
        <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h}>
          {pts.length >= 3 && <polygon points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(221,140,51,0.25)" stroke="#dd8c33" strokeWidth={2} />}
          {pts.length === 2 && <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke="#dd8c33" strokeWidth={2} />}
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 7 : 5} fill={i === 0 ? "#dd8c33" : "#fff"} stroke="#dd8c33" strokeWidth={2} />)}
        </svg>
        <div className="absolute right-2 top-2 flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/90 shadow"><Plus className="h-4 w-4" /></button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/90 shadow"><Minus className="h-4 w-4" /></button>
          <button type="button" aria-label="Go to my location" onClick={locate} className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/90 shadow"><LocateFixed className="h-4 w-4" /></button>
        </div>
        <span className="pointer-events-none absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black">© OpenStreetMap contributors</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{value.length < 3 ? `Tap the map to place corners (${value.length}/3 minimum)` : `${value.length} corners · tap to add more`}</span>
        <span className="flex gap-1">
          <button type="button" onClick={() => onChange(value.slice(0, -1))} disabled={!value.length} className="flex h-9 items-center gap-1 rounded-lg border border-border px-2 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" />Undo</button>
          <button type="button" onClick={() => onChange([])} disabled={!value.length} className="flex h-9 items-center gap-1 rounded-lg border border-border px-2 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />Clear</button>
        </span>
      </div>
    </div>
  );
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
