"use client";

import { useState } from "react";
import { Plane, Download, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface Waypoint {
  lat: number;
  lng: number;
  altitude: number; // meters AGL
  speed: number; // m/s
}

interface DronePlannerProps {
  open: boolean;
  onClose: () => void;
  waypoints: Waypoint[];
  onWaypointsChange: (waypoints: Waypoint[]) => void;
  isAdmin: boolean;
}

export function DronePlanner({ open, onClose, waypoints, onWaypointsChange, isAdmin }: DronePlannerProps) {
  const [defaultAlt, setDefaultAlt] = useState(120); // 120m ≈ 400ft (FAA limit)
  const [defaultSpeed, setDefaultSpeed] = useState(10); // 10 m/s

  if (!open || !isAdmin) return null;

  const totalDistance = calculateTotalDistance(waypoints);
  const flightTime = calculateFlightTime(waypoints);

  function removeWaypoint(index: number) {
    onWaypointsChange(waypoints.filter((_, i) => i !== index));
  }

  function updateWaypointAlt(index: number, alt: number) {
    const updated = [...waypoints];
    updated[index] = { ...updated[index], altitude: alt };
    onWaypointsChange(updated);
  }

  function exportKML() {
    const kml = generateKML(waypoints);
    const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flight-plan-${new Date().toISOString().split("T")[0]}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="absolute top-3 left-14 z-20 w-72 rounded-xl backdrop-blur-md border border-white/10 overflow-hidden"
      style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 92%, transparent)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Plane className="h-3.5 w-3.5 text-white/50" />
          <span className="text-[10px] font-mono font-bold text-white/70 uppercase tracking-wider">Drone Flight Plan</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* Defaults */}
      <div className="px-3 py-2 border-b border-white/5 flex gap-2">
        <div>
          <span className="text-[8px] text-white/40 font-mono">ALT (m)</span>
          <Input value={defaultAlt} onChange={e => setDefaultAlt(Number(e.target.value))}
            type="number" className="h-6 text-[10px] w-16 mt-0.5" />
        </div>
        <div>
          <span className="text-[8px] text-white/40 font-mono">SPEED (m/s)</span>
          <Input value={defaultSpeed} onChange={e => setDefaultSpeed(Number(e.target.value))}
            type="number" className="h-6 text-[10px] w-16 mt-0.5" />
        </div>
      </div>

      {/* Instructions */}
      <div className="px-3 py-1.5 text-[9px] text-white/30 font-mono">
        Click on the map to add waypoints
      </div>

      {/* Waypoint list */}
      <div className="max-h-48 overflow-y-auto">
        {waypoints.map((wp, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono text-white/60 hover:bg-white/5">
            <span className="w-4 text-white/30">{i + 1}</span>
            <span className="flex-1 truncate">{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}</span>
            <Input value={wp.altitude} onChange={e => updateWaypointAlt(i, Number(e.target.value))}
              type="number" className="h-5 text-[9px] w-12" />
            <span className="text-[8px] text-white/20">m</span>
            <button onClick={() => removeWaypoint(i)} className="text-white/20 hover:text-red-400">
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Stats */}
      {waypoints.length >= 2 && (
        <div className="px-3 py-2 border-t border-white/5 flex justify-between text-[9px] font-mono text-white/50">
          <span>Dist: {(totalDistance / 1000).toFixed(1)} km</span>
          <span>Time: {Math.ceil(flightTime / 60)} min</span>
          <span>WPs: {waypoints.length}</span>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2 border-t border-white/5 flex gap-1.5">
        <Button size="sm" variant="ghost" className="h-7 text-[10px] flex-1 gap-1" onClick={exportKML}
          disabled={waypoints.length < 2}>
          <Download className="h-3 w-3" /> Export KML
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-400" onClick={() => onWaypointsChange([])}>
          Clear
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────

function calculateTotalDistance(waypoints: Waypoint[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  return total;
}

function calculateFlightTime(waypoints: Waypoint[]): number {
  let time = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    time += dist / (b.speed || 10);
  }
  return time;
}

function generateKML(waypoints: Waypoint[]): string {
  const coords = waypoints.map(w => `${w.lng},${w.lat},${w.altitude}`).join("\n            ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Overwatch Drone Flight Plan</name>
    <description>Generated ${new Date().toISOString()}</description>
    <Style id="flightPath">
      <LineStyle><color>ff0000ff</color><width>3</width></LineStyle>
    </Style>
    <Placemark>
      <name>Flight Path</name>
      <styleUrl>#flightPath</styleUrl>
      <LineString>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>
            ${coords}
        </coordinates>
      </LineString>
    </Placemark>
    ${waypoints.map((w, i) => `
    <Placemark>
      <name>WP${i + 1}</name>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${w.lng},${w.lat},${w.altitude}</coordinates>
      </Point>
    </Placemark>`).join("")}
  </Document>
</kml>`;
}
