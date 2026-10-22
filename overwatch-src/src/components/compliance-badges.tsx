"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Shield, Lock, Accessibility, Activity } from "lucide-react";
import { fetchUptime, formatPct, uptimeLevel, type UptimeSummary } from "@/lib/status/uptime";

const DOCS = "https://github.com/EvenfallAdvantage/evenfalladvantage.github.io/blob/main/docs/compliance";
const DOT: Record<string, string> = { green: "bg-emerald-400", amber: "bg-amber-300", red: "bg-red-400" };
const DOT_WORD: Record<string, string> = { green: "at or above target", amber: "slightly below target", red: "below target" };

const BADGE =
  "group flex min-h-[44px] min-w-[44px] items-center gap-2.5 rounded-lg border bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dd8c33]";

function Body({ icon, iconCls, label, sub }: { icon: ReactNode; iconCls: string; label: string; sub: ReactNode }) {
  return (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconCls}`} aria-hidden="true">{icon}</span>
      <span className="flex flex-col gap-0.5 leading-none">
        <span className="text-[11px] font-bold font-mono tracking-wider text-white">{label}</span>
        <span className="text-[10px] text-white/80">{sub}</span>
      </span>
    </>
  );
}

/** Footer compliance badges: each label is something we can evidence (docs/compliance). */
export function ComplianceBadges({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
  const [up, setUp] = useState<UptimeSummary | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    void fetchUptime(ac.signal).then(setUp);
    return () => ac.abort();
  }, []);
  const level = uptimeLevel(up?.uptime30d ?? null, up?.target, up?.checks30d ?? 0);
  const measured = level !== "none" && up?.uptime30d != null;
  const upSub = measured ? (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[level]}`} aria-hidden="true" />
      {formatPct(up!.uptime30d)} last 30 days
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">Live status</span>
  );
  const upName = measured
    ? `99.5% uptime target: measured ${formatPct(up!.uptime30d)} over the last 30 days, ${DOT_WORD[level]}. Open status page`
    : "99.5% uptime target. Open live status page";

  return (
    <ul aria-label="Compliance and reliability" className="flex flex-wrap items-stretch justify-center gap-3 sm:gap-4">
      <li data-badge="soc2">
        <a href={`${DOCS}/SOC2_READINESS_CHECKLIST.md`} target="_blank" rel="noopener noreferrer" className={`${BADGE} border-sky-400/30`}
          aria-label="SOC 2 aligned, audit in progress. Opens our security program (new tab)">
          <Body icon={<Shield className="h-4 w-4" />} iconCls="bg-sky-400/15 text-sky-300" label="SOC 2 Aligned" sub="Audit in progress" />
        </a>
      </li>
      <li data-badge="ccpa">
        <button type="button" onClick={onOpenPrivacy} className={`${BADGE} border-violet-400/30`}
          aria-label="CCPA privacy rights: export, delete and correct your data. Opens the privacy policy">
          <Body icon={<Lock className="h-4 w-4" />} iconCls="bg-violet-400/15 text-violet-300" label="CCPA Privacy Rights" sub="Export · delete · correct" />
        </button>
      </li>
      <li data-badge="wcag">
        <a href={`${DOCS}/WCAG_AUDIT_REPORT.md`} target="_blank" rel="noopener noreferrer" className={`${BADGE} border-[#dd8c33]/40`}
          aria-label="WCAG 2.2 AA tested, automated checks pass. Opens the accessibility report (new tab)">
          <Body icon={<Accessibility className="h-4 w-4" />} iconCls="bg-[#dd8c33]/15 text-[#f0a656]" label="WCAG 2.2 AA Tested" sub="Automated checks pass" />
        </a>
      </li>
      <li data-badge="uptime">
        <Link href="/status/" className={`${BADGE} border-emerald-400/30`} aria-label={upName}>
          <Body icon={<Activity className="h-4 w-4" />} iconCls="bg-emerald-400/15 text-emerald-300" label="99.5% Uptime Target" sub={upSub} />
        </Link>
      </li>
    </ul>
  );
}
