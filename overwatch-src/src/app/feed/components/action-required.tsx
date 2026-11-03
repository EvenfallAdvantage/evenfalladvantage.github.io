"use client";

import { useEffect, useState } from "react";
import { Inbox, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOwnerIntel } from "@/lib/supabase/db";
import type { OwnerIntel } from "./shared";
import { approvalsHref, formsHref, staffTabFlag } from "@/lib/personnel/staff-tabs";

interface ActionRequiredProps {
  activeCompanyId: string;
  hiddenTabs?: readonly string[];
}

type Approvals = { timesheets: number; timeCorrections: number; leaveRequests: number; formReviews: number };

/** Deep-link to the queue that needs attention: Personnel → Approvals (first non-empty view), or Forms. */
export function actionRequiredHref(a: Approvals): string {
  if (a.timesheets > 0) return approvalsHref("timesheets");
  if (a.timeCorrections > 0) return approvalsHref("corrections");
  if (a.leaveRequests > 0) return approvalsHref("leave");
  if (a.formReviews > 0) return "/admin/staff?tab=forms";
  return approvalsHref("timesheets");
}

/** One clickable count per queue, each linking to its Personnel tab/view. Hidden tabs are dropped. */
export function approvalBadges(a: Approvals, hiddenTabs: readonly string[] = []) {
  const hidden = new Set(hiddenTabs);
  const approvalsOn = !hidden.has(staffTabFlag("approvals"));
  const formsOn = !hidden.has(staffTabFlag("forms"));
  return [
    approvalsOn && { key: "timesheets", label: "Timesheets", count: a.timesheets, href: approvalsHref("timesheets") },
    approvalsOn && { key: "corrections", label: "Time corrections", count: a.timeCorrections, href: approvalsHref("corrections") },
    approvalsOn && { key: "leave", label: "Leave requests", count: a.leaveRequests, href: approvalsHref("leave") },
    formsOn && { key: "forms", label: "Form reviews", count: a.formReviews, href: formsHref("submissions") },
  ].filter(Boolean) as { key: string; label: string; count: number; href: string }[];
}

export function ActionRequired({ activeCompanyId, hiddenTabs = [] }: ActionRequiredProps) {
  const [ownerIntel, setOwnerIntel] = useState<OwnerIntel | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    getOwnerIntel(activeCompanyId).then((oi) => {
      if (!cancelled) setOwnerIntel(oi);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  const approvals = ownerIntel?.approvals ?? { timesheets: 0, timeCorrections: 0, leaveRequests: 0, formReviews: 0, total: 0 };
  const badges = approvalBadges(approvals, hiddenTabs);
  if (!loaded || badges.length === 0) return null;

  const total = badges.reduce((n, b) => n + b.count, 0);

  if (total === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex items-center gap-3 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <p className="flex-1 text-xs text-muted-foreground">No pending approvals. You&apos;re all caught up.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 shrink-0">
            <Inbox className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-[12rem]">
            <p className="text-sm font-semibold">{total} pending approval{total !== 1 ? "s" : ""}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {badges.map((b) => (
                <Link
                  key={b.key}
                  href={b.href}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                    b.count > 0 ? "border-amber-500/30 text-foreground hover:bg-amber-500/10" : "border-border/40 text-muted-foreground/60 hover:text-foreground"
                  }`}
                >
                  <span className="font-mono font-semibold">{b.count}</span> {b.label}
                </Link>
              ))}
            </div>
          </div>
          <Link href={actionRequiredHref(approvals)} className="ml-auto">
            <Button size="sm" variant="outline" className="gap-1 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
              Review <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
