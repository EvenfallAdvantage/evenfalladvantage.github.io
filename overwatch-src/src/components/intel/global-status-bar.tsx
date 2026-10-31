"use client";

/**
 * Global operational status bar — fixed top-center pill on the tactical map.
 * Surfaces three live operational signals derived from the active company's map state:
 *
 *   - Active operations count
 *   - On-duty staff count (live GPS pins on shift)
 *   - Active alerts count (open company incidents + site-watch proximity alerts)
 *
 * Also houses quick-action buttons for sharing the current map view and opening
 * the Data Sources & Attribution modal. Shifts down automatically when the
 * aircraft TrackingChip occupies the top-center slot.
 */

import { Info, Link2 } from "lucide-react";

export type GlobalAlertTone = "nominal" | "warning" | "critical";

export interface GlobalStatusBarProps {
  enabled?: boolean;
  /** Shift down from top-3 to top-12 when the aircraft TrackingChip is active. */
  offsetTop?: boolean;
  activeOpsCount?: number;
  onDutyCount?: number;
  alertCount?: number;
  alertTone?: GlobalAlertTone;
  onShare?: () => void;
  onOpenAttribution?: () => void;
}

export function GlobalStatusBar({
  enabled = true,
  offsetTop = false,
  activeOpsCount = 0,
  onDutyCount = 0,
  alertCount = 0,
  alertTone = "nominal",
  onShare,
  onOpenAttribution,
}: GlobalStatusBarProps) {
  if (!enabled) return null;

  const alertDotColor =
    alertCount === 0
      ? "#10b981"
      : alertTone === "critical"
        ? "#ef4444"
        : "#f59e0b";

  return (
    <div
      data-testid="global-status-bar"
      className={`absolute ${
        offsetTop ? "top-24 lg:top-12" : "top-3"
      } left-1/2 -translate-x-1/2 z-10 max-w-[calc(100%-6rem)] sm:max-w-none pointer-events-auto rounded-full px-3 py-1.5 flex items-center gap-2.5 sm:gap-3 backdrop-blur-sm border border-white/10 text-[10px] font-mono uppercase tracking-wider whitespace-nowrap transition-[top] duration-150`}
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--brand-primary, #0f1a2e) 88%, transparent)",
        color: "rgba(255,255,255,0.7)",
      }}
    >
      {/* Active Ops */}
      <div
        className="flex items-center gap-1.5"
        title={`${activeOpsCount} active operation${activeOpsCount === 1 ? "" : "s"}`}
        data-testid="status-active-ops"
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: activeOpsCount > 0 ? "#10b981" : "#64748b" }}
        />
        <span className="text-white/85 font-semibold">{activeOpsCount}</span>
        <span className="hidden sm:inline text-white/45">
          {activeOpsCount === 1 ? "active op" : "active ops"}
        </span>
      </div>

      <span className="text-white/20">·</span>

      {/* On-Duty Staff */}
      <div
        className="flex items-center gap-1.5"
        title={`${onDutyCount} staff on duty`}
        data-testid="status-on-duty"
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: onDutyCount > 0 ? "#22d3ee" : "#64748b" }}
        />
        <span className="text-white/85 font-semibold">{onDutyCount}</span>
        <span className="hidden sm:inline text-white/45">on duty</span>
      </div>

      <span className="text-white/20">·</span>

      {/* Active Alerts (Open Incidents + Site Watch Alerts) */}
      <div
        className="flex items-center gap-1.5"
        title={
          alertCount > 0
            ? `${alertCount} active alert${alertCount === 1 ? "" : "s"}`
            : "No active alerts"
        }
        data-testid="status-alerts"
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: alertDotColor }}
        />
        <span
          className={
            alertCount > 0
              ? alertTone === "critical"
                ? "text-red-300 font-semibold"
                : "text-amber-300 font-semibold"
              : "text-white/85 font-semibold"
          }
        >
          {alertCount}
        </span>
        <span className="hidden sm:inline text-white/45">
          {alertCount === 1 ? "alert" : "alerts"}
        </span>
      </div>

      {(onShare || onOpenAttribution) && (
        <span className="text-white/15">|</span>
      )}

      {onShare && (
        <button
          type="button"
          onClick={onShare}
          className="-my-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-white/40 hover:text-white/85 transition-colors"
          title="Copy a link to this view"
          aria-label="Copy a link to this view"
        >
          <Link2 className="h-3 w-3" />
        </button>
      )}

      {onOpenAttribution && (
        <button
          type="button"
          onClick={onOpenAttribution}
          className="-my-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-white/40 hover:text-white/85 transition-colors"
          title="Data sources"
          aria-label="Data sources"
        >
          <Info className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
