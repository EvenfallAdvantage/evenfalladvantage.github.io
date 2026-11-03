"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, AlertTriangle, Clock, ChevronDown, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getComplianceSummary, getExpiringCertifications, type ComplianceSummary, type ExpiringCert } from "@/lib/supabase/db";
import { groupCertsByPerson, bucketCounts } from "@/lib/dashboard/compliance";
import { logger } from "@/lib/logger";
import { WidgetEmpty, WidgetSkeleton } from "./widget-states";

interface ComplianceWidgetProps {
  activeCompanyId: string;
}

const PEOPLE_SHOWN = 5;

function daysLabel(d: number) {
  return d <= 0 ? "Expired" : `${d}d`;
}
function daysTone(d: number) {
  return d <= 0 ? "text-red-500" : d <= 30 ? "text-amber-500" : "text-muted-foreground";
}

export function ComplianceWidget({ activeCompanyId }: ComplianceWidgetProps) {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [expiring, setExpiring] = useState<ExpiringCert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    Promise.all([
      getComplianceSummary(activeCompanyId),
      getExpiringCertifications(activeCompanyId, 90),
    ]).then(([s, e]) => {
      if (!cancelled) { setSummary(s); setExpiring(e); }
    }).catch((err) => { logger.swallow("compliance-widget:load", err, "warn"); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  if (!loaded) return <WidgetSkeleton rows={4} />;
  if (!summary || summary.totalStaff === 0) return null;

  const hasIssues = summary.expired > 0 || summary.expiringSoon > 0;
  const people = groupCertsByPerson(expiring);
  const buckets = bucketCounts(expiring);

  return (
    <Card className={`border-border/40 ${hasIssues ? "border-amber-500/30" : ""}`}>
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Compliance
          </h3>
          {hasIssues ? (
            <Badge className="bg-amber-500/15 text-amber-500 text-[10px]">Action Needed</Badge>
          ) : (
            <Badge className="bg-green-500/15 text-green-500 text-[10px]">All Clear</Badge>
          )}
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { v: summary.fullyCompliant, l: "Compliant", c: "text-green-500" },
            { v: summary.expiringSoon, l: "Expiring", c: "text-amber-500" },
            { v: summary.expired, l: "Expired", c: "text-red-500" },
            { v: summary.noCerts, l: "No Certs", c: "text-muted-foreground" },
          ].map((x) => (
            <div key={x.l}>
              <p className={`text-lg font-bold font-mono ${x.c}`}>{x.v}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{x.l}</p>
            </div>
          ))}
        </div>

        {/* 30/60/90-day buckets */}
        {expiring.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Certificates by time to expiry">
            {[
              { n: buckets.expired, l: "Expired", c: "bg-red-500/10 text-red-500" },
              { n: buckets.d30, l: "≤ 30 days", c: "bg-amber-500/10 text-amber-500" },
              { n: buckets.d60, l: "31–60 days", c: "bg-muted text-muted-foreground" },
              { n: buckets.d90, l: "61–90 days", c: "bg-muted text-muted-foreground" },
            ].map((b) => (
              <span key={b.l} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${b.c} ${b.n === 0 ? "opacity-50" : ""}`}>
                {b.n} {b.l}
              </span>
            ))}
          </div>
        )}

        {/* People needing attention, one row each */}
        {people.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground">Needs attention</p>
            {people.slice(0, PEOPLE_SHOWN).map((p) => {
              const isOpen = open === p.userId;
              return (
                <div key={p.userId} className="rounded-lg bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : p.userId)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px]"
                  >
                    {p.expired > 0 ? <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" /> : <Clock className="h-3 w-3 text-amber-500 shrink-0" />}
                    <span className="flex-1 truncate font-medium">{p.userName}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {p.expired > 0 && <span className="text-red-500">{p.expired} expired</span>}
                      {p.expired > 0 && p.expiring > 0 && " · "}
                      {p.expiring > 0 && <span className="text-amber-500">{p.expiring} expiring</span>}
                    </span>
                    <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <ul className="border-t border-border/30 px-2.5 py-1.5 space-y-1">
                      {p.certs.map((c) => (
                        <li key={c.certId} className="flex items-center gap-2 text-[11px]">
                          <span className="flex-1 truncate text-muted-foreground">{c.certType}</span>
                          <span className="text-[10px] text-muted-foreground/70">{c.expiryDate?.slice(0, 10)}</span>
                          <span className={`font-mono text-[10px] ${daysTone(c.daysUntilExpiry)}`}>{daysLabel(c.daysUntilExpiry)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <Link href="/certifications" className="inline-block text-[10px] text-primary hover:underline">
              {people.length > PEOPLE_SHOWN ? `+${people.length - PEOPLE_SHOWN} more people · ` : ""}View all certifications
            </Link>
          </div>
        ) : (
          <WidgetEmpty icon={ShieldCheck} title="No certificates expiring in the next 90 days" />
        )}
      </CardContent>
    </Card>
  );
}
