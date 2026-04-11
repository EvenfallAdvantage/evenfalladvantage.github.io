"use client";

import type { GeofenceAlert } from "./env-intel";

interface GeofenceAlertTickerProps {
  alerts: GeofenceAlert[];
}

export function GeofenceAlertTicker({ alerts }: GeofenceAlertTickerProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="absolute bottom-14 left-3 right-64 z-10 rounded-lg backdrop-blur-sm border border-red-500/20 px-3 py-1.5 overflow-hidden"
      style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}
    >
      <div className="flex items-center gap-2 text-[10px] font-mono animate-marquee">
        <span className="text-red-500 font-bold shrink-0">GEOFENCE</span>
        {alerts.slice(0, 5).map((a) => (
          <span key={a.id} className="text-white/60 shrink-0">
            {a.alertType === "breach" ? "⚠" : "✓"} {a.userName} — {a.eventName} ({Math.round(a.distanceM)}m){" "}
            {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        ))}
      </div>
    </div>
  );
}
