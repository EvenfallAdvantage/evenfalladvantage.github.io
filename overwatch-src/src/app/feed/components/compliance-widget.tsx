"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getComplianceSummary, getExpiringCertifications, type ComplianceSummary, type ExpiringCert } from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

interface ComplianceWidgetProps {
  activeCompanyId: string;
}

export function ComplianceWidget({ activeCompanyId }: ComplianceWidgetProps) {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [expiring, setExpiring] = useState<ExpiringCert[]>([]);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    Promise.all([
      getComplianceSummary(activeCompanyId),
      getExpiringCertifications(activeCompanyId, 90),
    ]).then(([s, e]) => {
      if (!cancelled) { setSummary(s); setExpiring(e); }
    }).catch((err) => { logger.swallow("compliance-widget:load", err, "warn"); });
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  if (!summary || summary.totalStaff === 0) return null;

  const hasIssues = summary.expired > 0 || summary.expiringSoon > 0;

  return (
    <Card className={`border-border/40 ${hasIssues ? "border-amber-500/30" : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Compliance
          </h3>
          {hasIssues ? (
            <Badge className="bg-amber-500/15 text-amber-500 text-[9px]">Action Needed</Badge>
          ) : (
            <Badge className="bg-green-500/15 text-green-500 text-[9px]">All Clear</Badge>
          )}
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold font-mono text-green-500">{summary.fullyCompliant}</p>
            <p className="text-[8px] text-muted-foreground uppercase">Compliant</p>
          </div>
          <div>
            <p className="text-lg font-bold font-mono text-amber-500">{summary.expiringSoon}</p>
            <p className="text-[8px] text-muted-foreground uppercase">Expiring</p>
          </div>
          <div>
            <p className="text-lg font-bold font-mono text-red-500">{summary.expired}</p>
            <p className="text-[8px] text-muted-foreground uppercase">Expired</p>
          </div>
          <div>
            <p className="text-lg font-bold font-mono text-muted-foreground">{summary.noCerts}</p>
            <p className="text-[8px] text-muted-foreground uppercase">No Certs</p>
          </div>
        </div>

        {/* Expiring soon list */}
        {expiring.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground">Expiring Soon</p>
            {expiring.slice(0, 5).map((cert) => (
              <div key={cert.certId} className="flex items-center gap-2 text-[11px] rounded-lg bg-muted/30 px-2.5 py-1.5">
                {cert.daysUntilExpiry <= 0 ? (
                  <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                ) : cert.daysUntilExpiry <= 30 ? (
                  <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="flex-1 truncate font-medium">{cert.userName}</span>
                <span className="text-muted-foreground truncate">{cert.certType}</span>
                <span className={`font-mono text-[10px] ${cert.daysUntilExpiry <= 0 ? "text-red-500" : cert.daysUntilExpiry <= 30 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {cert.daysUntilExpiry <= 0 ? "Expired" : `${cert.daysUntilExpiry}d`}
                </span>
              </div>
            ))}
            {expiring.length > 5 && (
              <Link href="/certifications" className="text-[10px] text-primary hover:underline">
                +{expiring.length - 5} more
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
