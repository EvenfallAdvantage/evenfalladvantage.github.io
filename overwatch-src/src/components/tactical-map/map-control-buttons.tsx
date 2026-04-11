"use client";

import { Maximize2, Minimize2, Loader2 } from "lucide-react";

interface MapControlButtonsProps {
  cameraHeading: number;
  isFullscreen: boolean;
  timeMachineOpen: boolean;
  dronePlannerOpen: boolean;
  isAdmin?: boolean;
  onResetNorth: () => void;
  onToggleFullscreen: () => void;
  onToggleTimeMachine: () => void;
  onToggleDronePlanner: () => void;
}

const btnBase = "w-10 h-10 rounded-full backdrop-blur-sm border border-white/10 flex items-center justify-center transition-colors";
const btnBg = "color-mix(in srgb, var(--brand-primary, #0f1a2e) 85%, transparent)";
const btnBgActive = "color-mix(in srgb, var(--brand-accent, #d59b3c) 20%, color-mix(in srgb, var(--brand-primary, #0f1a2e) 85%, transparent))";

export function MapControlButtons({
  cameraHeading, isFullscreen, timeMachineOpen, dronePlannerOpen, isAdmin,
  onResetNorth, onToggleFullscreen, onToggleTimeMachine, onToggleDronePlanner,
}: MapControlButtonsProps) {
  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
      {/* Compass */}
      <button onClick={onResetNorth} title="Reset to north (top-down view)"
        className={btnBase + " hover:border-white/30"} style={{ backgroundColor: btnBg }}>
        <svg width="28" height="28" viewBox="0 0 28 28"
          style={{ transform: `rotate(${-cameraHeading}rad)`, transition: "transform 0.15s ease-out" }}>
          <polygon points="14,2 17,14 14,12 11,14" fill="#ef4444" />
          <polygon points="14,26 11,14 14,16 17,14" fill="rgba(255,255,255,0.5)" />
          <circle cx="14" cy="14" r="2" fill="rgba(255,255,255,0.7)" />
          <text x="14" y="9" textAnchor="middle" fontSize="6" fontWeight="bold" fontFamily="monospace" fill="#ef4444">N</text>
        </svg>
      </button>

      {/* Fullscreen */}
      <button onClick={onToggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        className={btnBase + " text-white/60 hover:text-white hover:border-white/30"} style={{ backgroundColor: btnBg }}>
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      {/* Time Machine */}
      <button onClick={onToggleTimeMachine} title="Time Machine — replay past events"
        className={`${btnBase} ${timeMachineOpen ? "text-white border-white/30" : "text-white/60 hover:text-white hover:border-white/30"}`}
        style={{ backgroundColor: timeMachineOpen ? btnBgActive : btnBg }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" /><path d="M8 4v4l3 2" />
        </svg>
      </button>

      {/* Drone Planner (admin only) */}
      {isAdmin && (
        <button onClick={onToggleDronePlanner} title="Drone Flight Planner"
          className={`${btnBase} ${dronePlannerOpen ? "text-white border-white/30" : "text-white/60 hover:text-white hover:border-white/30"}`}
          style={{ backgroundColor: dronePlannerOpen ? btnBgActive : btnBg }}>
          <Loader2 className="h-4 w-4" style={{ animation: "none", transform: "rotate(45deg)" }} />
        </button>
      )}
    </div>
  );
}
