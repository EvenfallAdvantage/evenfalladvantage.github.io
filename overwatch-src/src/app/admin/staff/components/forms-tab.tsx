"use client";

import { SubTab, SubTabList } from "@/components/ui/sub-tabs";
import { FileText, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FormsView } from "@/lib/personnel/staff-tabs";
import { ReportsTab } from "./reports-tab";
import { PublicReportsTab } from "./public-reports-tab";

interface FormsTabProps {
  activeCompanyId: string;
  canManage: boolean;
  view: FormsView;
  onViewChange: (v: FormsView) => void;
  pendingSubmissions: number;
}

/** Personnel → Forms: internal submissions + Public Reports (formerly its own tab). */
export function FormsTab({ activeCompanyId, canManage, view, onViewChange, pendingSubmissions }: FormsTabProps) {
  const views: { key: FormsView; label: string; icon: React.ElementType; badge: number }[] = [
    { key: "submissions", label: "Submissions", icon: FileText, badge: pendingSubmissions },
    { key: "public", label: "Public Reports", icon: QrCode, badge: 0 },
  ];
  return (
    <div className="space-y-4">
      <SubTabList hostAction={false}>
        {views.map((v) => (
          <SubTab key={v.key} active={view === v.key} onClick={() => onViewChange(v.key)} icon={v.icon}>
            {v.label}
            {v.badge > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-amber-500/20 text-amber-600">{v.badge}</Badge>}
          </SubTab>
        ))}
      </SubTabList>
      {view === "submissions" && <ReportsTab activeCompanyId={activeCompanyId} canManage={canManage} />}
      {view === "public" && <PublicReportsTab activeCompanyId={activeCompanyId} canManage={canManage} />}
    </div>
  );
}
