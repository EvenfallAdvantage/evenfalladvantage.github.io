"use client";

import { ArrowLeftRight, CalendarClock, CalendarOff, FileEdit } from "lucide-react";
import { SubTab, SubTabList } from "@/components/ui/sub-tabs";
import { Badge } from "@/components/ui/badge";
import type { ApprovalView } from "@/lib/personnel/staff-tabs";
import { TimesheetsTab } from "./timesheets-tab";
import { CorrectionsTab } from "./corrections-tab";
import { LeaveTab } from "./leave-tab";
import { ShiftSwapTab } from "@/app/schedule/components/shift-swap-tab";

interface ApprovalsTabProps {
  activeCompanyId: string;
  canManage: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  members: any[];
  view: ApprovalView;
  onViewChange: (v: ApprovalView) => void;
  counts: Partial<Record<ApprovalView, number>>;
}

const VIEWS: { key: ApprovalView; label: string; icon: typeof CalendarClock }[] = [
  { key: "timesheets", label: "Timesheets", icon: CalendarClock },
  { key: "corrections", label: "Corrections", icon: FileEdit },
  { key: "leave", label: "Leave", icon: CalendarOff },
  { key: "swaps", label: "Swaps", icon: ArrowLeftRight },
];

/** One place to review time: timesheets, clock corrections, leave and shift swaps. */
export function ApprovalsTab({ activeCompanyId, canManage, members, view, onViewChange, counts }: ApprovalsTabProps) {
  return (
    <div className="space-y-4" data-testid="approvals-tab">
      <SubTabList hostAction={false}>
        {VIEWS.map((v) => (
          <SubTab key={v.key} active={view === v.key} onClick={() => onViewChange(v.key)} icon={v.icon}>
            {v.label}
            {(counts[v.key] ?? 0) > 0 && (
              <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-amber-500/20 text-amber-600">{counts[v.key]}</Badge>
            )}
          </SubTab>
        ))}
      </SubTabList>
      {view === "timesheets" && <TimesheetsTab activeCompanyId={activeCompanyId} canManage={canManage} />}
      {view === "corrections" && <CorrectionsTab activeCompanyId={activeCompanyId} canManage={canManage} />}
      {view === "swaps" && <ShiftSwapTab />}
      {view === "leave" && <LeaveTab activeCompanyId={activeCompanyId} canManage={canManage} members={members} />}
    </div>
  );
}
