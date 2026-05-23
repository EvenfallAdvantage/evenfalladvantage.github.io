"use client";

/**
 * Intel drawer — slide-out panel on the tactical map containing:
 *   - RECON tab (sub-tabs for DNS / IP / CVE / Threats)
 *   - LIVE ALERTS tab (news + earthquakes ticker)
 *   - SOURCES tab (attribution table)
 *
 * Lazy-loaded (`next/dynamic` ssr:false) by the tactical map shell.
 * Mounts only when opened; unmounts on close to keep the bundle quiet.
 */

import { useState } from "react";
import { X, Search, Bell, Info } from "lucide-react";
import { AttributionModal } from "./attribution-modal";
import { DnsTab } from "./recon-tabs/dns-tab";
import { IpTab } from "./recon-tabs/ip-tab";
import { CveTab } from "./recon-tabs/cve-tab";
import { ThreatsTab } from "./recon-tabs/threats-tab";
import { LiveAlertsTab } from "./live-alerts-tab";

interface IntelDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Optional camera-flyto callback for ticker rows. */
  onLocate?: (lat: number, lng: number) => void;
}

type TopTab = "recon" | "alerts" | "sources";
type ReconTab = "dns" | "ip" | "cve" | "threats";

export function IntelDrawer({ open, onClose, onLocate }: IntelDrawerProps) {
  const [tab, setTab] = useState<TopTab>("recon");
  const [reconTab, setReconTab] = useState<ReconTab>("dns");
  const [showAttribution, setShowAttribution] = useState(false);

  if (!open) return null;

  return (
    <>
      {/* Slide-out panel; positioned absolute within the tactical-map shell.
          Mobile: full-width sheet. Desktop: 420px right-rail. */}
      <div
        className="absolute top-0 right-0 bottom-0 z-30 w-full sm:w-[420px] shadow-2xl flex flex-col"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--brand-primary, #0f1a2e) 96%, transparent)",
          borderLeft:
            "1px solid color-mix(in srgb, var(--brand-accent, #d59b3c) 25%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Intel</span>
            <button
              onClick={() => setShowAttribution(true)}
              className="text-white/30 hover:text-white/80"
              title="Data sources & attribution"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top tabs */}
        <div className="flex border-b border-white/10 shrink-0 text-[10px] font-mono uppercase tracking-wider">
          <TopTabButton
            active={tab === "recon"}
            onClick={() => setTab("recon")}
            icon={<Search className="h-3 w-3" />}
            label="Recon"
          />
          <TopTabButton
            active={tab === "alerts"}
            onClick={() => setTab("alerts")}
            icon={<Bell className="h-3 w-3" />}
            label="Alerts"
          />
          <TopTabButton
            active={tab === "sources"}
            onClick={() => setTab("sources")}
            icon={<Info className="h-3 w-3" />}
            label="Sources"
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab === "recon" && (
            <div className="space-y-3">
              <div className="flex gap-1 flex-wrap">
                <ReconTabButton
                  active={reconTab === "dns"}
                  onClick={() => setReconTab("dns")}
                  label="DNS"
                />
                <ReconTabButton
                  active={reconTab === "ip"}
                  onClick={() => setReconTab("ip")}
                  label="IP"
                />
                <ReconTabButton
                  active={reconTab === "cve"}
                  onClick={() => setReconTab("cve")}
                  label="CVE"
                />
                <ReconTabButton
                  active={reconTab === "threats"}
                  onClick={() => setReconTab("threats")}
                  label="Threats"
                />
              </div>
              <div className="border-t border-white/5 pt-3">
                {reconTab === "dns" && <DnsTab />}
                {reconTab === "ip" && <IpTab />}
                {reconTab === "cve" && <CveTab />}
                {reconTab === "threats" && <ThreatsTab />}
              </div>
            </div>
          )}
          {tab === "alerts" && <LiveAlertsTab onLocate={onLocate} />}
          {tab === "sources" && (
            <div className="text-[11px] font-mono text-white/60 space-y-2">
              <p>
                Intel features aggregate public data from sources listed in the
                attribution modal. Some sources require attribution on display
                or have commercial-use restrictions.
              </p>
              <button
                onClick={() => setShowAttribution(true)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--brand-accent, #d59b3c) 80%, transparent)",
                  color: "var(--brand-primary, #0f1a2e)",
                }}
              >
                View Sources
              </button>
              <p className="text-[10px] text-white/40 mt-3">
                Vendored from Osiris (github.com/simplifaisoul/osiris, MIT).
                See <code className="font-mono">docs/THIRD-PARTY-NOTICES.md</code>.
              </p>
            </div>
          )}
        </div>
      </div>

      {showAttribution && (
        <AttributionModal onClose={() => setShowAttribution(false)} />
      )}
    </>
  );
}

function TopTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors border-b-2"
      style={{
        color: active ? "var(--brand-accent, #d59b3c)" : "rgba(255,255,255,0.4)",
        borderColor: active ? "var(--brand-accent, #d59b3c)" : "transparent",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ReconTabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors"
      style={{
        backgroundColor: active
          ? "color-mix(in srgb, var(--brand-accent, #d59b3c) 25%, transparent)"
          : "transparent",
        color: active ? "var(--brand-accent, #d59b3c)" : "rgba(255,255,255,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {label}
    </button>
  );
}
