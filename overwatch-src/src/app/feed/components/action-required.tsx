"use client";

import { useEffect, useState, useCallback } from "react";
import { Inbox, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOwnerIntel } from "@/lib/supabase/db";
import type { OwnerIntel } from "./shared";

interface ActionRequiredProps {
  activeCompanyId: string;
}

export function ActionRequired({ activeCompanyId }: ActionRequiredProps) {
  const [ownerIntel, setOwnerIntel] = useState<OwnerIntel | null>(null);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const oi = await getOwnerIntel(activeCompanyId);
      setOwnerIntel(oi);
    } catch {}
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    let cancelled = false;
    getOwnerIntel(activeCompanyId).then((oi) => {
      if (!cancelled) setOwnerIntel(oi);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  if (!ownerIntel?.approvals || ownerIntel.approvals.total === 0) return null;

  const { approvals } = ownerIntel;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
            <Inbox className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Action Required — {approvals.total} pending approval{approvals.total !== 1 ? "s" : ""}</p>
            <div className="flex flex-wrap gap-3 mt-1">
              {approvals.timesheets > 0 && <span className="text-xs text-muted-foreground">{approvals.timesheets} timesheet{approvals.timesheets !== 1 ? "s" : ""}</span>}
              {approvals.timeCorrections > 0 && <span className="text-xs text-muted-foreground">{approvals.timeCorrections} time correction{approvals.timeCorrections !== 1 ? "s" : ""}</span>}
              {approvals.leaveRequests > 0 && <span className="text-xs text-muted-foreground">{approvals.leaveRequests} leave request{approvals.leaveRequests !== 1 ? "s" : ""}</span>}
              {approvals.formReviews > 0 && <span className="text-xs text-muted-foreground">{approvals.formReviews} form{approvals.formReviews !== 1 ? "s" : ""}</span>}
            </div>
          </div>
          <Link href="/admin/staff">
            <Button size="sm" variant="outline" className="gap-1 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
              Review <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
