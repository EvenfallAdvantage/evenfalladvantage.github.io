"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CrimeIncident, SexOffender } from "@/lib/crime-incidents";

type Props = {
  lat: number;
  lon: number;
  riskLevel: string;
  address: string;
  isDark: boolean;
  incidents?: CrimeIncident[];
  offenders?: SexOffender[];
  loading?: boolean;
};

const RISK_CIRCLE_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Moderate: "#eab308",
  Low: "#22c55e",
  Negligible: "#94a3b8",
};

const INCIDENT_COLORS: Record<string, string> = {
  violent: "#ef4444",
  property: "#f59e0b",
  other: "#6b7280",
};

const LIGHT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function makeDot(color: string, size: number, symbol?: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid rgba(255,255,255,0.8);
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      font-size:${size - 6}px;color:white;
    ">${symbol || ""}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function GeoRiskMap({
  lat, lon, riskLevel, address, isDark,
  incidents = [], offenders = [], loading = false,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current, {
      center: [lat, lon],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(isDark ? DARK_TILES : LIGHT_TILES, { maxZoom: 19, crossOrigin: true }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false })
      .addAttribution('&copy; <a href="https://openstreetmap.org">OSM</a>')
      .addTo(map);

    const color = RISK_CIRCLE_COLORS[riskLevel] || "#eab308";

    // 1-mile risk radius
    L.circle([lat, lon], {
      radius: 1609,
      color,
      fillColor: color,
      fillOpacity: 0.06,
      weight: 2,
      dashArray: "6 4",
    }).addTo(map);

    // ── Crime Incident Markers ──
    incidents.forEach((inc) => {
      const ic = INCIDENT_COLORS[inc.type] || "#6b7280";
      L.marker([inc.lat, inc.lon], { icon: makeDot(ic, 14) })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui;font-size:11px;max-width:200px">
            <strong style="color:${ic}">${inc.category}</strong><br/>
            <span style="color:#999">${inc.date}</span><br/>
            <span>${inc.description}</span>
          </div>`,
          { closeButton: false, maxWidth: 220 }
        );
    });

    // ── Sex Offender Markers ──
    offenders.forEach((off) => {
      L.marker([off.lat, off.lon], { icon: makeDot("#a855f7", 18, "⚠") })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui;font-size:11px;max-width:220px">
            <strong style="color:#a855f7">${off.name}</strong><br/>
            <span style="color:#999">${off.address}</span><br/>
            <span>${off.offenses}</span><br/>
            <span style="font-size:10px;color:#888">Source: ${off.source}</span>
          </div>`,
          { closeButton: false, maxWidth: 240 }
        );
    });

    // ── Center Pin ──
    const pinIcon = L.divIcon({
      className: "",
      html: `<div style="
        width:28px;height:28px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
      "><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    L.marker([lat, lon], { icon: pinIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(
        `<div style="font-family:system-ui;font-size:12px;min-width:160px">
          <strong style="font-size:13px">${address || "Location"}</strong><br/>
          <span style="color:${color};font-weight:700">${riskLevel} Risk</span><br/>
          <span style="color:#888;font-size:11px">1-mile analysis radius</span>
        </div>`,
        { closeButton: false }
      );

    // ── Legend ──
    const legend = new L.Control({ position: "topright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div");
      const bg = isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.92)";
      const fg = isDark ? "#e2e8f0" : "#1e293b";
      const items: [string, string][] = [
        [color, "Target Location"],
      ];
      if (incidents.length > 0) {
        items.push(["#ef4444", `Violent (${incidents.filter((i) => i.type === "violent").length})`]);
        items.push(["#f59e0b", `Property (${incidents.filter((i) => i.type === "property").length})`]);
        items.push(["#6b7280", `Other (${incidents.filter((i) => i.type === "other").length})`]);
      }
      if (offenders.length > 0) {
        items.push(["#a855f7", `Offenders (${offenders.length})`]);
      }
      div.innerHTML = `<div style="
        background:${bg};color:${fg};padding:6px 10px;border-radius:6px;
        font-family:system-ui;font-size:10px;line-height:1.6;
        border:1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};
        box-shadow:0 1px 4px rgba(0,0,0,0.15);
      ">${items.map(([c, label]) =>
        `<div style="display:flex;align-items:center;gap:5px">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block;border:1px solid rgba(255,255,255,0.5)"></span>
          ${label}
        </div>`
      ).join("")}</div>`;
      return div;
    };
    legend.addTo(map);

    mapInstance.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [lat, lon, riskLevel, address, isDark, incidents, offenders]);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="w-full h-[300px] rounded-lg overflow-hidden border border-border/40"
        style={{ zIndex: 0 }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg z-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading nearby data...
          </div>
        </div>
      )}
    </div>
  );
}
