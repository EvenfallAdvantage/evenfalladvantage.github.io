"use client";

/**
 * Combined ticker of high-risk news items + recent earthquakes. Refreshed on
 * mount and every 5 minutes. Clicking a row optionally flies the camera to
 * the row's coordinates if a `onLocate` handler is provided.
 */

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, MapPin } from "lucide-react";
import {
  fetchIntelNews,
  fetchIntelEarthquakes,
} from "@/lib/intel-client";
import type { IntelNewsItem, IntelEarthquake } from "@/lib/intel-types";
import { logger } from "@/lib/logger";

interface LiveAlertsTabProps {
  /** Callback invoked when a row with coordinates is clicked. */
  onLocate?: (lat: number, lng: number) => void;
}

type AlertRow =
  | { kind: "news"; data: IntelNewsItem }
  | { kind: "quake"; data: IntelEarthquake };

const REFRESH_MS = 5 * 60_000;

export function LiveAlertsTab({ onLocate }: LiveAlertsTabProps) {
  const [news, setNews] = useState<IntelNewsItem[]>([]);
  const [quakes, setQuakes] = useState<IntelEarthquake[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "news" | "quakes">("all");

  async function refresh() {
    setBusy(true);
    try {
      const [n, q] = await Promise.all([
        fetchIntelNews().catch((e) => {
          logger.swallow("intel:live-alerts:news", e, "debug");
          return { news: [] as IntelNewsItem[] };
        }),
        fetchIntelEarthquakes().catch((e) => {
          logger.swallow("intel:live-alerts:earthquakes", e, "debug");
          return { earthquakes: [] as IntelEarthquake[] };
        }),
      ]);
      setNews(n.news ?? []);
      setQuakes(q.earthquakes ?? []);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const rows: AlertRow[] = [
    ...(filter !== "quakes"
      ? news
          .filter((n) => n.risk_score >= 5)
          .slice(0, 25)
          .map<AlertRow>((n) => ({ kind: "news", data: n }))
      : []),
    ...(filter !== "news"
      ? quakes
          .filter((q) => q.magnitude >= 4.5)
          .slice(0, 25)
          .map<AlertRow>((q) => ({ kind: "quake", data: q }))
      : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["all", "news", "quakes"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors"
              style={{
                backgroundColor:
                  filter === f
                    ? "color-mix(in srgb, var(--brand-accent, #d59b3c) 25%, transparent)"
                    : "transparent",
                color:
                  filter === f
                    ? "var(--brand-accent, #d59b3c)"
                    : "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="text-white/40 hover:text-white/80 disabled:opacity-40"
          title="Refresh"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {rows.length === 0 && (
          <div className="text-[11px] text-white/30 font-mono py-3 text-center">
            No active alerts.
          </div>
        )}
        {rows.map((row, i) => (
          <AlertRowItem
            key={`${row.kind}-${i}`}
            row={row}
            onLocate={onLocate}
          />
        ))}
      </div>
    </div>
  );
}

function AlertRowItem({
  row,
  onLocate,
}: {
  row: AlertRow;
  onLocate?: (lat: number, lng: number) => void;
}) {
  if (row.kind === "news") {
    const n = row.data;
    const coords = n.coords;
    const riskColor =
      n.risk_score >= 8 ? "#ef4444" : n.risk_score >= 6 ? "#f97316" : "#fbbf24";
    return (
      <div className="bg-white/5 border border-white/5 rounded-lg p-2 text-[11px] font-mono">
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: riskColor }}
          />
          <div className="flex-1 min-w-0">
            <a
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 hover:text-white block leading-snug"
            >
              {n.title}
            </a>
            <div className="text-[9px] text-white/40 mt-0.5">
              {n.source} · risk {n.risk_score}
            </div>
          </div>
          {coords && onLocate && (
            <button
              onClick={() => onLocate(coords[0], coords[1])}
              className="text-white/40 hover:text-white/80"
              title="Locate"
            >
              <MapPin className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const q = row.data;
  const magColor =
    q.magnitude >= 6 ? "#ef4444" : q.magnitude >= 5 ? "#f97316" : "#fbbf24";
  return (
    <div className="bg-white/5 border border-white/5 rounded-lg p-2 text-[11px] font-mono">
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: magColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-white/90">
            <span className="font-bold" style={{ color: magColor }}>
              M{q.magnitude.toFixed(1)}
            </span>{" "}
            {q.place}
          </div>
          <div className="text-[9px] text-white/40 mt-0.5">
            {new Date(q.time).toUTCString()} · depth {q.depth.toFixed(0)} km
          </div>
        </div>
        {onLocate && (
          <button
            onClick={() => onLocate(q.lat, q.lng)}
            className="text-white/40 hover:text-white/80"
            title="Locate"
          >
            <MapPin className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
