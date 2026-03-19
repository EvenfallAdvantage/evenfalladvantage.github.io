"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  lat: number;
  lon: number;
  riskLevel: string;
  address: string;
  isDark: boolean;
};

const RISK_CIRCLE_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Moderate: "#eab308",
  Low: "#22c55e",
  Negligible: "#94a3b8",
};

const LIGHT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export default function GeoRiskMap({ lat, lon, riskLevel, address, isDark }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up previous instance
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

    // Tile layer based on theme
    L.tileLayer(isDark ? DARK_TILES : LIGHT_TILES, {
      maxZoom: 19,
    }).addTo(map);

    // Zoom control bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Attribution bottom-left
    L.control.attribution({ position: "bottomleft", prefix: false })
      .addAttribution('&copy; <a href="https://openstreetmap.org">OSM</a>')
      .addTo(map);

    const color = RISK_CIRCLE_COLORS[riskLevel] || "#eab308";

    // Risk radius circle (1 mile ≈ 1609m)
    L.circle([lat, lon], {
      radius: 1609,
      color,
      fillColor: color,
      fillOpacity: 0.08,
      weight: 2,
      dashArray: "6 4",
    }).addTo(map);

    // Custom marker icon
    const markerIcon = L.divIcon({
      className: "",
      html: `<div style="
        width: 28px; height: 28px; border-radius: 50%;
        background: ${color}; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
      "><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    L.marker([lat, lon], { icon: markerIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-family:system-ui;font-size:12px;min-width:160px">
          <strong style="font-size:13px">${address || "Location"}</strong><br/>
          <span style="color:${color};font-weight:700">${riskLevel} Risk</span><br/>
          <span style="color:#888;font-size:11px">1-mile analysis radius</span>
        </div>`,
        { closeButton: false }
      );

    mapInstance.current = map;

    // Force resize after render
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [lat, lon, riskLevel, address, isDark]);

  return (
    <div
      ref={mapRef}
      className="w-full h-[240px] rounded-lg overflow-hidden border border-border/40"
      style={{ zIndex: 0 }}
    />
  );
}
